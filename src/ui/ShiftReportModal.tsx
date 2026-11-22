/**
 * Экран итогового отчёта в конце смены (Шаг 6).
 * По сценарию показывает только качественные выводы без чисел и баллов:
 * «Что получилось», «Где ошибка», «Как в реальной работе» и «Чему вы научились».
 */

import {
  AlertTriangle,
  ArrowRightLeft,
  BookOpen,
  BriefcaseBusiness,
  CheckCircle2,
  LogOut,
  Square,
  Volume2,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { buildShiftReport } from '../engine/reportEngine';
import { playVoiceover, stopVoiceover } from '../engine/soundEffects';
import type { RoleConfig, UiTexts, WorldState } from '../engine/types';

interface ShiftReportModalProps {
  isOpen: boolean;
  role: RoleConfig;
  otherRole: RoleConfig | null;
  nickname: string;
  worldState: WorldState;
  ui: UiTexts;
  isSoundEnabled?: boolean;
  onSwitchRole: (roleId: string) => void;
  onBackToMenu: () => void;
  onStayInRoom: () => void;
}

export function ShiftReportModal({
  isOpen,
  role,
  otherRole,
  nickname,
  worldState,
  ui,
  isSoundEnabled = true,
  onSwitchRole,
  onBackToMenu,
  onStayInRoom,
}: ShiftReportModalProps) {
  const [playingUrl, setPlayingUrl] = useState<string | null>(null);

  const report = buildShiftReport(role, worldState);
  const autoVoiceUrl =
    report.whatWorkedVoiceUrls.find(Boolean) ?? report.realWorldVoiceUrl;

  useEffect(() => {
    if (!isOpen) {
      stopVoiceover();
      setPlayingUrl(null);
      return;
    }

    if (isSoundEnabled && autoVoiceUrl) {
      const started = playVoiceover(autoVoiceUrl, true, () => setPlayingUrl(null));
      setPlayingUrl(started ? autoVoiceUrl : null);
    }

    return () => {
      stopVoiceover();
      setPlayingUrl(null);
    };
  }, [isOpen, isSoundEnabled, autoVoiceUrl]);

  if (!isOpen) {
    return null;
  }

  function handleToggleVoice(url: string | undefined) {
    if (!url) {
      return;
    }
    if (playingUrl === url) {
      stopVoiceover();
      setPlayingUrl(null);
      return;
    }
    const started = playVoiceover(url, true, () => setPlayingUrl(null));
    setPlayingUrl(started ? url : null);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="shift-report-title"
    >
      <div
        className="ui-pop-in flex max-h-[90vh] w-full max-w-3xl flex-col border p-6 shadow-2xl sm:p-8"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-default)',
          borderRadius: 'var(--radius-card)',
        }}
      >
        {/* Шапка отчёта */}
        <div
          className="border-b pb-4"
          style={{ borderColor: 'var(--border-default)' }}
        >
          <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            <span>{nickname}</span>
            <span aria-hidden="true"> · </span>
            <span>{role.title}</span>
          </div>
          <h2
            id="shift-report-title"
            className="mt-1 text-2xl font-bold"
            style={{ color: 'var(--text-primary)' }}
          >
            {report.title}
          </h2>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
            {report.subtitle}
          </p>
        </div>

        {/* Четыре блока качественного анализа */}
        <div className="mt-5 space-y-5 overflow-y-auto pr-1">
          {/* 1. Что получилось */}
          <section
            className="border p-4"
            style={{
              backgroundColor: 'var(--bg-surface-muted)',
              borderColor: 'var(--border-default)',
              borderRadius: 'var(--radius-control)',
            }}
          >
            <div className="flex items-center gap-2">
              <CheckCircle2
                className="h-5 w-5 shrink-0"
                style={{ color: 'var(--success-text)' }}
                aria-hidden="true"
              />
              <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                {ui.room.reportWhatWorkedTitle}
              </h3>
            </div>
            <ul className="mt-2.5 space-y-2 text-sm" style={{ color: 'var(--text-primary)' }}>
              {report.whatWorkedItems.map((item, idx) => {
                const voiceUrl = report.whatWorkedVoiceUrls[idx];
                const isThisPlaying = Boolean(voiceUrl && playingUrl === voiceUrl);
                return (
                  <li key={idx} className="flex items-start justify-between gap-2 leading-relaxed">
                    <span>{item}</span>
                    {voiceUrl && (
                      <button
                        type="button"
                        onClick={() => handleToggleVoice(voiceUrl)}
                        aria-label={isThisPlaying ? 'Остановить озвучку' : 'Прослушать вывод'}
                        className="inline-flex shrink-0 cursor-pointer items-center gap-1 border px-2 py-0.5 text-xs transition-colors hover:bg-white/10"
                        style={{
                          borderColor: isThisPlaying ? 'var(--accent-primary)' : 'var(--border-default)',
                          borderRadius: 'var(--radius-control)',
                          color: isThisPlaying ? 'var(--accent-lime)' : 'var(--text-secondary)',
                        }}
                      >
                        {isThisPlaying ? (
                          <Square className="h-3 w-3" aria-hidden="true" />
                        ) : (
                          <Volume2 className="h-3.5 w-3.5" aria-hidden="true" />
                        )}
                        <span>{isThisPlaying ? 'Стоп' : 'Слушать'}</span>
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>

          {/* 2. Где ошибка */}
          <section
            className="border p-4"
            style={{
              backgroundColor: 'var(--bg-surface-muted)',
              borderColor: report.hasMistakes
                ? 'var(--warning-primary)'
                : 'var(--border-default)',
              borderRadius: 'var(--radius-control)',
            }}
          >
            <div className="flex items-center gap-2">
              <AlertTriangle
                className="h-5 w-5 shrink-0"
                style={{
                  color: report.hasMistakes
                    ? 'var(--warning-primary)'
                    : 'var(--success-text)',
                }}
                aria-hidden="true"
              />
              <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                {ui.room.reportMistakesTitle}
              </h3>
            </div>
            {report.hasMistakes ? (
              <ul className="mt-2.5 space-y-2 text-sm" style={{ color: 'var(--text-primary)' }}>
                {report.mistakeItems.map((item, idx) => {
                  const voiceUrl = report.mistakeVoiceUrls[idx];
                  const isThisPlaying = Boolean(voiceUrl && playingUrl === voiceUrl);
                  return (
                    <li key={idx} className="flex items-start justify-between gap-2 leading-relaxed">
                      <span>{item}</span>
                      {voiceUrl && (
                        <button
                          type="button"
                          onClick={() => handleToggleVoice(voiceUrl)}
                          aria-label={isThisPlaying ? 'Остановить озвучку' : 'Прослушать вывод'}
                          className="inline-flex shrink-0 cursor-pointer items-center gap-1 border px-2 py-0.5 text-xs transition-colors hover:bg-white/10"
                          style={{
                            borderColor: isThisPlaying
                              ? 'var(--accent-primary)'
                              : 'var(--border-default)',
                            borderRadius: 'var(--radius-control)',
                            color: isThisPlaying ? 'var(--accent-lime)' : 'var(--text-secondary)',
                          }}
                        >
                          {isThisPlaying ? (
                            <Square className="h-3 w-3" aria-hidden="true" />
                          ) : (
                            <Volume2 className="h-3.5 w-3.5" aria-hidden="true" />
                          )}
                          <span>{isThisPlaying ? 'Стоп' : 'Слушать'}</span>
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-2.5 text-sm leading-relaxed" style={{ color: 'var(--text-primary)' }}>
                {report.noMistakesText}
              </p>
            )}
          </section>

          {/* 3. Как в реальной работе */}
          <section
            className="border p-4"
            style={{
              backgroundColor: 'var(--bg-surface-muted)',
              borderColor: 'var(--border-default)',
              borderRadius: 'var(--radius-control)',
            }}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <BriefcaseBusiness
                  className="h-5 w-5 shrink-0"
                  style={{ color: 'var(--accent-lime)' }}
                  aria-hidden="true"
                />
                <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {ui.room.reportRealWorldTitle}
                </h3>
              </div>
              {report.realWorldVoiceUrl && (
                <button
                  type="button"
                  onClick={() => handleToggleVoice(report.realWorldVoiceUrl)}
                  aria-label={
                    playingUrl === report.realWorldVoiceUrl
                      ? 'Остановить озвучку'
                      : 'Прослушать итог'
                  }
                  className="inline-flex shrink-0 cursor-pointer items-center gap-1 border px-2 py-0.5 text-xs transition-colors hover:bg-white/10"
                  style={{
                    borderColor:
                      playingUrl === report.realWorldVoiceUrl
                        ? 'var(--accent-primary)'
                        : 'var(--border-default)',
                    borderRadius: 'var(--radius-control)',
                    color:
                      playingUrl === report.realWorldVoiceUrl
                        ? 'var(--accent-lime)'
                        : 'var(--text-secondary)',
                  }}
                >
                  {playingUrl === report.realWorldVoiceUrl ? (
                    <Square className="h-3 w-3" aria-hidden="true" />
                  ) : (
                    <Volume2 className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  <span>{playingUrl === report.realWorldVoiceUrl ? 'Стоп' : 'Слушать'}</span>
                </button>
              )}
            </div>
            <p className="mt-2.5 text-sm leading-relaxed" style={{ color: 'var(--text-primary)' }}>
              {report.realWorld}
            </p>
          </section>

          {/* 4. Чему вы научились */}
          {report.takeaways.length > 0 && (
            <section
              className="border p-4"
              style={{
                backgroundColor: 'var(--bg-surface-muted)',
                borderColor: 'var(--border-default)',
                borderRadius: 'var(--radius-control)',
              }}
            >
              <div className="flex items-center gap-2">
                <BookOpen
                  className="h-5 w-5 shrink-0"
                  style={{ color: 'var(--accent-lime)' }}
                  aria-hidden="true"
                />
                <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {ui.room.reportTakeawaysTitle}
                </h3>
              </div>
              <ol className="mt-2.5 space-y-1.5 text-sm" style={{ color: 'var(--text-primary)' }}>
                {report.takeaways.map((lesson, idx) => (
                  <li key={idx} className="flex gap-2">
                    <span
                      className="font-semibold tabular-nums"
                      style={{ color: 'var(--accent-lime)' }}
                    >
                      {idx + 1}.
                    </span>
                    <span>{lesson}</span>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </div>

        {/* Нижняя панель переходов: смена роли в общем мире, возврат или меню */}
        <div
          className="mt-5 flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between"
          style={{ borderColor: 'var(--border-default)' }}
        >
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            {ui.room.reportSharedWorldNotice}
          </p>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={onStayInRoom}
              className="min-h-[40px] cursor-pointer border px-3.5 py-2 text-xs font-medium whitespace-nowrap transition-colors hover:bg-white/10 sm:text-sm"
              style={{
                borderColor: 'var(--border-default)',
                borderRadius: 'var(--radius-control)',
                color: 'var(--text-secondary)',
              }}
            >
              {ui.room.reportStayButton}
            </button>

            <button
              type="button"
              onClick={onBackToMenu}
              className="inline-flex min-h-[40px] cursor-pointer items-center gap-1.5 border px-3.5 py-2 text-xs font-medium whitespace-nowrap transition-colors hover:bg-white/10 sm:text-sm"
              style={{
                borderColor: 'var(--border-default)',
                borderRadius: 'var(--radius-control)',
                color: 'var(--text-primary)',
              }}
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              <span>{ui.room.reportBackToMenuButton}</span>
            </button>

            {otherRole && (
              <button
                type="button"
                onClick={() => onSwitchRole(otherRole.id)}
                className="inline-flex min-h-[40px] cursor-pointer items-center gap-2 px-4 py-2 text-xs font-semibold whitespace-nowrap transition-all hover:brightness-110 sm:text-sm"
                style={{
                  backgroundColor: 'var(--accent-primary)',
                  color: 'var(--accent-text)',
                  borderRadius: 'var(--radius-control)',
                }}
              >
                <ArrowRightLeft className="h-4 w-4" aria-hidden="true" />
                <span>
                  {ui.room.reportSwitchRoleButton}: {otherRole.title}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
