/**
 * Окно ветвящегося диалога с персонажем.
 * Показывает имя, должность, портрет, реплику собеседника с подстановкой никнейма,
 * доступные варианты ответа (поддерживает выбор цифрами 1–4) и таймер ожидания клиента
 * на нормальном и сложном уровне сложности.
 */

import { Clock, MessageSquare, Square, Volume2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getAvailableDialogChoices, resolveDialogText } from '../engine/dialogEngine';
import { playVoiceover, stopVoiceover } from '../engine/soundEffects';
import type {
  DialogChoice,
  DialogDefinition,
  UiTexts,
  WorldState,
} from '../engine/types';

interface DialogModalProps {
  dialog: DialogDefinition | null;
  currentNodeId: string | null;
  speakerAvatar?: string;
  nickname: string;
  worldState: WorldState;
  inventory: string[];
  ui: UiTexts;
  isSoundEnabled?: boolean;
  clientTimerSeconds?: number;
  onClientTimeout?: () => void;
  onSelectChoice: (choice: DialogChoice) => void;
  onClose: () => void;
}

const CLIENT_TIMED_DIALOG_IDS = new Set([
  'danya_client',
  'nina_client',
  'orlov_client',
  'lena_client',
  'anna_client',
]);

function getSpeakerInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
  }
  return (parts[0]?.slice(0, 2) ?? '?').toUpperCase();
}

function formatTimerClock(seconds: number): string {
  const safe = Math.max(0, seconds);
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function DialogModal({
  dialog,
  currentNodeId,
  speakerAvatar,
  nickname,
  worldState,
  inventory,
  ui,
  isSoundEnabled = true,
  clientTimerSeconds = 0,
  onClientTimeout,
  onSelectChoice,
  onClose,
}: DialogModalProps) {
  const [avatarFailed, setAvatarFailed] = useState<boolean>(false);
  const isTimedClientDialog = Boolean(
    dialog && clientTimerSeconds > 0 && CLIENT_TIMED_DIALOG_IDS.has(dialog.id),
  );
  const [remainingSeconds, setRemainingSeconds] = useState<number>(clientTimerSeconds);
  const [timedOutOnce, setTimedOutOnce] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);

  const currentVoiceUrl =
    dialog && currentNodeId ? dialog.nodes[currentNodeId]?.voiceUrl : undefined;

  useEffect(() => {
    setAvatarFailed(false);
    setRemainingSeconds(clientTimerSeconds);
    setTimedOutOnce(false);
  }, [dialog?.id, speakerAvatar, clientTimerSeconds]);

  // Автоматическое воспроизведение озвучки текущей реплики с очисткой при переходе/закрытии
  useEffect(() => {
    if (!dialog || !currentNodeId || !currentVoiceUrl || !isSoundEnabled) {
      stopVoiceover();
      setIsSpeaking(false);
      return;
    }

    const started = playVoiceover(currentVoiceUrl, true, () => setIsSpeaking(false));
    setIsSpeaking(started);

    return () => {
      stopVoiceover();
      setIsSpeaking(false);
    };
  }, [dialog?.id, currentNodeId, currentVoiceUrl, isSoundEnabled]);

  // Отсчёт таймера терпения клиента, если он задан профилем сложности
  useEffect(() => {
    if (!isTimedClientDialog || timedOutOnce) {
      return;
    }

    const timerId = window.setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(timerId);
  }, [isTimedClientDialog, timedOutOnce]);

  useEffect(() => {
    if (isTimedClientDialog && remainingSeconds === 0 && !timedOutOnce) {
      setTimedOutOnce(true);
      onClientTimeout?.();
    }
  }, [isTimedClientDialog, remainingSeconds, timedOutOnce, onClientTimeout]);

  // Быстрый выбор ответа цифрами 1..9 с клавиатуры
  useEffect(() => {
    if (!dialog || !currentNodeId) {
      return;
    }
    const activeNode = dialog.nodes[currentNodeId];
    if (!activeNode) {
      return;
    }
    const visibleChoices = getAvailableDialogChoices(activeNode, worldState, inventory);

    function handleKeyDown(event: KeyboardEvent) {
      const num = Number.parseInt(event.key, 10);
      if (!Number.isNaN(num) && num >= 1 && num <= visibleChoices.length) {
        event.preventDefault();
        onSelectChoice(visibleChoices[num - 1]);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dialog, currentNodeId, worldState, inventory, onSelectChoice]);

  if (!dialog || !currentNodeId) {
    return null;
  }

  const node = dialog.nodes[currentNodeId];
  if (!node) {
    return null;
  }

  const availableChoices = getAvailableDialogChoices(node, worldState, inventory);
  const replicaText = resolveDialogText(node.text, nickname);
  const initials = getSpeakerInitials(dialog.speakerName);
  const showAvatar = Boolean(speakerAvatar && !avatarFailed);
  const timerPercent =
    isTimedClientDialog && clientTimerSeconds > 0
      ? Math.round((remainingSeconds / clientTimerSeconds) * 100)
      : 100;
  const isTimerLow = isTimedClientDialog && remainingSeconds <= 20;

  function handleToggleReplayVoice() {
    if (!node.voiceUrl) {
      return;
    }
    if (isSpeaking) {
      stopVoiceover();
      setIsSpeaking(false);
    } else {
      const started = playVoiceover(node.voiceUrl, true, () => setIsSpeaking(false));
      setIsSpeaking(started);
    }
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/70 p-4 backdrop-blur-xs sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialog-speaker-name"
      onClick={onClose}
    >
      <div
        className="ui-pop-in w-full max-w-2xl border p-5 shadow-2xl sm:p-6"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-default)',
          borderRadius: 'var(--radius-card)',
        }}
        onClick={(event) => event.stopPropagation()}
      >
        {/* Шапка собеседника */}
        <div
          className="flex items-start justify-between gap-4 border-b pb-4"
          style={{ borderColor: 'var(--border-default)' }}
        >
          <div className="flex items-center gap-3.5">
            <div
              className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden border text-base font-bold"
              style={{
                backgroundColor: 'var(--bg-surface-muted)',
                borderColor: 'var(--accent-primary)',
                borderRadius: 'var(--radius-control)',
                color: 'var(--accent-lime)',
              }}
              aria-hidden={!showAvatar}
            >
              {showAvatar ? (
                <img
                  src={speakerAvatar}
                  alt={dialog.speakerName}
                  referrerPolicy="no-referrer"
                  onError={() => setAvatarFailed(true)}
                  className="h-full w-full object-cover object-[50%_22%]"
                />
              ) : (
                initials
              )}
            </div>
            <div>
              <h2
                id="dialog-speaker-name"
                className="text-lg font-semibold"
                style={{ color: 'var(--text-primary)' }}
              >
                {dialog.speakerName}
              </h2>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                {dialog.speakerRole}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label={ui.room.dialogCloseButton}
            className="inline-flex min-h-[38px] cursor-pointer items-center gap-1.5 border px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors hover:bg-white/10"
            style={{
              borderColor: 'var(--border-default)',
              borderRadius: 'var(--radius-control)',
              color: 'var(--text-secondary)',
            }}
          >
            <X className="h-4 w-4" aria-hidden="true" />
            <span>{ui.room.dialogCloseButton}</span>
          </button>
        </div>

        {/* Полоса таймера терпения клиента (работает на нормальной и сложной сложности) */}
        {isTimedClientDialog && (
          <div className="mt-3">
            <div className="flex items-center justify-between gap-2 text-xs tabular-nums">
              <span
                className="inline-flex items-center gap-1.5 font-medium"
                style={{
                  color: timedOutOnce
                    ? 'var(--danger-text)'
                    : isTimerLow
                      ? 'var(--warning-primary)'
                      : 'var(--text-secondary)',
                }}
              >
                <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{ui.room.clientTimerLabel}</span>
              </span>
              <span
                className="font-semibold"
                style={{ color: isTimerLow ? 'var(--warning-primary)' : 'var(--text-primary)' }}
              >
                {formatTimerClock(remainingSeconds)}
              </span>
            </div>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-sm bg-white/15">
              <div
                className="h-full transition-all duration-300"
                style={{
                  width: `${timerPercent}%`,
                  backgroundColor: timedOutOnce
                    ? 'var(--danger-primary)'
                    : isTimerLow
                      ? 'var(--warning-primary)'
                      : 'var(--accent-primary)',
                }}
              />
            </div>
            {timedOutOnce && (
              <p className="mt-1.5 text-xs" style={{ color: 'var(--danger-text)' }}>
                {ui.room.clientTimerTimeoutNote}
              </p>
            )}
          </div>
        )}

        {/* Реплика персонажа */}
        <div
          className="mt-4 border p-4 text-base leading-relaxed"
          style={{
            backgroundColor: 'var(--bg-surface-muted)',
            borderColor: 'var(--border-default)',
            borderRadius: 'var(--radius-control)',
            color: 'var(--text-primary)',
          }}
        >
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <div
              className="flex items-center gap-1.5 text-xs font-medium"
              style={{ color: 'var(--text-secondary)' }}
            >
              <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{dialog.speakerName}</span>
            </div>

            {node.voiceUrl && (
              <button
                type="button"
                onClick={handleToggleReplayVoice}
                aria-label={isSpeaking ? 'Остановить озвучку' : 'Прослушать реплику'}
                className="inline-flex cursor-pointer items-center gap-1 border px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-colors hover:bg-white/10"
                style={{
                  borderColor: isSpeaking ? 'var(--accent-primary)' : 'var(--border-default)',
                  borderRadius: 'var(--radius-control)',
                  color: isSpeaking ? 'var(--accent-lime)' : 'var(--text-secondary)',
                }}
              >
                {isSpeaking ? (
                  <Square className="h-3 w-3" aria-hidden="true" />
                ) : (
                  <Volume2 className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                <span>{isSpeaking ? 'Стоп' : 'Озвучка'}</span>
              </button>
            )}
          </div>
          <p>{replicaText}</p>
        </div>

        {/* Варианты ответа игрока */}
        <div className="mt-4">
          <div className="mb-2 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
            {ui.room.dialogChoicesHint}
          </div>
          <div className="flex flex-col gap-2">
            {availableChoices.map((choice, idx) => (
              <button
                key={choice.id}
                type="button"
                onClick={() => onSelectChoice(choice)}
                className="flex min-h-[44px] w-full cursor-pointer items-center gap-3 border px-4 py-2.5 text-left text-sm font-medium transition-colors hover:bg-white/10"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-default)',
                  borderRadius: 'var(--radius-control)',
                  color: 'var(--text-primary)',
                }}
              >
                <span
                  className="font-semibold tabular-nums"
                  style={{ color: 'var(--accent-lime)' }}
                >
                  {idx + 1}.
                </span>
                <span>{resolveDialogText(choice.text, nickname)}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
