/**
 * Модальное окно интерактивной мини-проверки безопасности (Шаг 6).
 * Показывает набор вариантов под выбранный уровень сложности (лёгкий, нормальный или с ловушками)
 * и передаёт выбранные пункты в miniGameEngine.
 */

import { CheckSquare, ShieldCheck, Square, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getVisibleMiniGameOptions } from '../engine/miniGameEngine';
import type { DifficultyProfile, MiniGameDef, UiTexts } from '../engine/types';

interface MiniGameModalProps {
  miniGame: MiniGameDef | null;
  difficulty: DifficultyProfile;
  ui: UiTexts;
  onSubmit: (selectedIds: string[]) => void;
  onClose: () => void;
}

export function MiniGameModal({
  miniGame,
  difficulty,
  ui,
  onSubmit,
  onClose,
}: MiniGameModalProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    setSelectedIds([]);
  }, [miniGame?.id]);

  if (!miniGame) {
    return null;
  }

  const options = getVisibleMiniGameOptions(miniGame, difficulty.id);

  function toggleOption(optionId: string) {
    setSelectedIds((prev) =>
      prev.includes(optionId) ? prev.filter((id) => id !== optionId) : [...prev, optionId],
    );
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="minigame-modal-title"
      onClick={onClose}
    >
      <div
        className="ui-pop-in flex max-h-[88vh] w-full max-w-2xl flex-col border p-6 shadow-2xl"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-default)',
          borderRadius: 'var(--radius-card)',
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div
          className="flex items-start justify-between gap-4 border-b pb-4"
          style={{ borderColor: 'var(--border-default)' }}
        >
          <div className="flex items-start gap-3">
            <ShieldCheck
              className="mt-0.5 h-6 w-6 shrink-0"
              style={{ color: 'var(--accent-lime)' }}
              aria-hidden="true"
            />
            <div>
              <h2
                id="minigame-modal-title"
                className="text-lg font-semibold sm:text-xl"
                style={{ color: 'var(--text-primary)' }}
              >
                {miniGame.title}
              </h2>
              <p className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
                {ui.room.miniGameDifficultyNote}: {difficulty.params.miniGamesDifficulty} · {difficulty.title}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-[40px] items-center gap-1.5 border px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors hover:bg-white/10"
            style={{
              borderColor: 'var(--border-default)',
              borderRadius: 'var(--radius-control)',
              color: 'var(--text-secondary)',
            }}
          >
            <X className="h-4 w-4" aria-hidden="true" />
            <span>{ui.room.miniGameCloseButton}</span>
          </button>
        </div>

        <div className="mt-4 overflow-y-auto pr-1">
          <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            {miniGame.subtitle}
          </p>
          <p className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
            {miniGame.instruction}
          </p>

          <div className="mt-4 flex flex-col gap-2.5">
            {options.map((option) => {
              const checked = selectedIds.includes(option.id);
              return (
                <button
                  key={option.id}
                  type="button"
                  role="checkbox"
                  aria-checked={checked}
                  onClick={() => toggleOption(option.id)}
                  className="flex min-h-[46px] w-full cursor-pointer items-start gap-3 border px-4 py-3 text-left text-sm transition-colors hover:bg-white/10"
                  style={{
                    backgroundColor: checked ? 'var(--bg-surface-muted)' : 'var(--bg-surface)',
                    borderColor: checked ? 'var(--accent-primary)' : 'var(--border-default)',
                    borderRadius: 'var(--radius-control)',
                    color: 'var(--text-primary)',
                  }}
                >
                  {checked ? (
                    <CheckSquare
                      className="mt-0.5 h-4 w-4 shrink-0"
                      style={{ color: 'var(--accent-lime)' }}
                      aria-hidden="true"
                    />
                  ) : (
                    <Square
                      className="mt-0.5 h-4 w-4 shrink-0"
                      style={{ color: 'var(--text-secondary)' }}
                      aria-hidden="true"
                    />
                  )}
                  <span>{option.text}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div
          className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t pt-4"
          style={{ borderColor: 'var(--border-default)' }}
        >
          <span className="text-xs tabular-nums" style={{ color: 'var(--text-secondary)' }}>
            Выбрано пунктов: {selectedIds.length}
          </span>

          <button
            type="button"
            disabled={selectedIds.length === 0}
            onClick={() => onSubmit(selectedIds)}
            className="min-h-[42px] px-5 py-2 text-sm font-semibold whitespace-nowrap transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            style={{
              backgroundColor: 'var(--accent-primary)',
              color: 'var(--accent-text)',
              borderRadius: 'var(--radius-control)',
            }}
          >
            {miniGame.confirmButton}
          </button>
        </div>
      </div>
    </div>
  );
}
