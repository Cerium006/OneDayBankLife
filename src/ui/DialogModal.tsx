/**
 * Окно ветвящегося диалога с персонажем (Шаг 4).
 * Показывает имя, должность и реплику собеседника, подставляя никнейм игрока,
 * и предлагает только те варианты ответа, которые разрешены текущими флагами и инвентарём.
 */

import { MessageSquare, X } from 'lucide-react';
import { getAvailableDialogChoices, resolveDialogText } from '../engine/dialogEngine';
import type {
  DialogChoice,
  DialogDefinition,
  UiTexts,
  WorldState,
} from '../engine/types';

interface DialogModalProps {
  dialog: DialogDefinition | null;
  currentNodeId: string | null;
  nickname: string;
  worldState: WorldState;
  inventory: string[];
  ui: UiTexts;
  onSelectChoice: (choice: DialogChoice) => void;
  onClose: () => void;
}

/** Возвращает 1–2 первые буквы имени для временного квадратного портрета */
function getSpeakerInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
  }
  return (parts[0]?.slice(0, 2) ?? '?').toUpperCase();
}

export function DialogModal({
  dialog,
  currentNodeId,
  nickname,
  worldState,
  inventory,
  ui,
  onSelectChoice,
  onClose,
}: DialogModalProps) {
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

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-slate-950/65 p-4 backdrop-blur-xs sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialog-speaker-name"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl border p-5 shadow-2xl sm:p-6"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-default)',
          borderRadius: 'var(--radius-card)',
        }}
        onClick={(event) => event.stopPropagation()}
      >
        {/* Шапка собеседника: квадратный аватар, имя, роль и кнопка выхода */}
        <div
          className="flex items-start justify-between gap-4 border-b pb-4"
          style={{ borderColor: 'var(--border-default)' }}
        >
          <div className="flex items-center gap-3.5">
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center border text-base font-bold"
              style={{
                backgroundColor: 'var(--bg-surface-muted)',
                borderColor: 'var(--accent-primary)',
                borderRadius: 'var(--radius-control)',
                color: 'var(--accent-primary)',
              }}
              aria-hidden="true"
            >
              {initials}
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
            className="inline-flex min-h-[38px] items-center gap-1.5 border px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors hover:bg-slate-100"
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
          <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
            <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{dialog.speakerName}</span>
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
                className="flex min-h-[44px] w-full cursor-pointer items-center gap-3 border px-4 py-2.5 text-left text-sm font-medium transition-colors hover:bg-slate-100"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-default)',
                  borderRadius: 'var(--radius-control)',
                  color: 'var(--text-primary)',
                }}
              >
                <span
                  className="font-semibold tabular-nums"
                  style={{ color: 'var(--accent-primary)' }}
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
