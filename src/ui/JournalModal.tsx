/**
 * Дневник смены с двумя вкладками: «Задачи» и «Инвентарь».
 * Открывается по кнопкам HUD («Задачи» / «Инвентарь») или клавишей Tab.
 * Показывает статусы квестов, подсказки (на лёгкой и нормальной сложности) и собранные предметы.
 */

import { Briefcase, CheckCircle2, Circle, ClipboardList, RotateCcw, X, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import type {
  DifficultyProfile,
  ItemDefinition,
  QuestStatus,
  RoleConfig,
  UiTexts,
} from '../engine/types';

export type JournalTab = 'tasks' | 'inventory';

interface JournalModalProps {
  isOpen: boolean;
  initialTab: JournalTab;
  ui: UiTexts;
  role: RoleConfig;
  difficulty: DifficultyProfile;
  questStatuses: Record<string, QuestStatus>;
  allItems: ItemDefinition[];
  ownedItemIds: string[];
  onRestartCheckpoint: () => void;
  onClose: () => void;
}

/** Возвращает иконку и цвет текста для статуса задачи в журнале */
function QuestStatusMark({
  status,
  label,
}: {
  status: QuestStatus;
  label: string;
}) {
  if (status === 'completed') {
    return (
      <span
        className="inline-flex items-center gap-1 text-xs font-semibold whitespace-nowrap"
        style={{ color: 'var(--success-text)' }}
      >
        <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span>{label}</span>
      </span>
    );
  }

  if (status === 'failed') {
    return (
      <span
        className="inline-flex items-center gap-1 text-xs font-semibold whitespace-nowrap"
        style={{ color: 'var(--danger-text)' }}
      >
        <XCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span>{label}</span>
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center gap-1 text-xs font-semibold whitespace-nowrap"
      style={{ color: 'var(--accent-lime)' }}
    >
      <Circle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}

export function JournalModal({
  isOpen,
  initialTab,
  ui,
  role,
  difficulty,
  questStatuses,
  allItems,
  ownedItemIds,
  onRestartCheckpoint,
  onClose,
}: JournalModalProps) {
  const [activeTab, setActiveTab] = useState<JournalTab>(initialTab);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  // Синхронизируем выбранную вкладку каждый раз при открытии дневника конкретной кнопкой
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  if (!isOpen) {
    return null;
  }

  // Скрытые квесты (initialStatus: 'hidden') показываются в списке только после активации
  const visibleQuests = role.quests.filter((quest) => {
    const status = questStatuses[quest.id] ?? quest.initialStatus;
    return status !== 'hidden';
  });

  const completedCount = visibleQuests.filter(
    (q) => (questStatuses[q.id] ?? q.initialStatus) === 'completed',
  ).length;

  const ownedItems = ownedItemIds
    .map((id) => allItems.find((item) => item.id === id))
    .filter((item): item is ItemDefinition => Boolean(item));

  const hintsAllowed = difficulty.id !== 'hard';

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="journal-modal-title"
      onClick={onClose}
    >
      <div
        className="ui-pop-in flex max-h-[86vh] w-full max-w-2xl flex-col border p-6 shadow-2xl"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-default)',
          borderRadius: 'var(--radius-card)',
        }}
        onClick={(event) => event.stopPropagation()}
      >
        {/* Заголовок и кнопка закрытия */}
        <div
          className="flex items-center justify-between gap-4 border-b pb-4"
          style={{ borderColor: 'var(--border-default)' }}
        >
          <div>
            <h2
              id="journal-modal-title"
              className="text-xl font-semibold"
              style={{ color: 'var(--text-primary)' }}
            >
              {ui.room.journalTitle}
            </h2>
            <p className="mt-0.5 text-xs tabular-nums" style={{ color: 'var(--text-secondary)' }}>
              {role.title} · {completedCount}/{visibleQuests.length}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-[40px] items-center gap-1.5 border px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors hover:bg-white/10"
            style={{
              borderColor: 'var(--border-default)',
              borderRadius: 'var(--radius-control)',
              color: 'var(--text-primary)',
            }}
          >
            <X className="h-4 w-4" aria-hidden="true" />
            <span>{ui.room.journalCloseButton}</span>
          </button>
        </div>

        {/* Переключатель вкладок: Задачи / Инвентарь */}
        <div
          role="tablist"
          aria-label={ui.room.journalTitle}
          className="mt-4 flex gap-2 border-b pb-3"
          style={{ borderColor: 'var(--border-default)' }}
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'tasks'}
            onClick={() => setActiveTab('tasks')}
            className="inline-flex min-h-[38px] items-center gap-2 border px-3.5 py-1.5 text-sm font-medium whitespace-nowrap tabular-nums transition-colors"
            style={{
              backgroundColor:
                activeTab === 'tasks' ? 'var(--accent-primary)' : 'var(--bg-surface-muted)',
              borderColor:
                activeTab === 'tasks' ? 'var(--accent-primary)' : 'var(--border-default)',
              color: activeTab === 'tasks' ? 'var(--accent-text)' : 'var(--text-primary)',
              borderRadius: 'var(--radius-control)',
            }}
          >
            <ClipboardList className="h-4 w-4" aria-hidden="true" />
            <span>
              {ui.room.journalTasksTab} · {completedCount}/{visibleQuests.length}
            </span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'inventory'}
            onClick={() => setActiveTab('inventory')}
            className="inline-flex min-h-[38px] items-center gap-2 border px-3.5 py-1.5 text-sm font-medium whitespace-nowrap tabular-nums transition-colors"
            style={{
              backgroundColor:
                activeTab === 'inventory' ? 'var(--accent-primary)' : 'var(--bg-surface-muted)',
              borderColor:
                activeTab === 'inventory' ? 'var(--accent-primary)' : 'var(--border-default)',
              color: activeTab === 'inventory' ? 'var(--accent-text)' : 'var(--text-primary)',
              borderRadius: 'var(--radius-control)',
            }}
          >
            <Briefcase className="h-4 w-4" aria-hidden="true" />
            <span>
              {ui.room.journalInventoryTab} · {ownedItems.length}
            </span>
          </button>
        </div>

        {/* Содержимое активной вкладки */}
        <div className="mt-4 flex-1 overflow-y-auto pr-1">
          {activeTab === 'tasks' ? (
            visibleQuests.length === 0 ? (
              <div
                className="border p-6 text-center text-sm"
                style={{
                  backgroundColor: 'var(--bg-surface-muted)',
                  borderColor: 'var(--border-default)',
                  borderRadius: 'var(--radius-control)',
                  color: 'var(--text-secondary)',
                }}
              >
                {ui.room.tasksEmpty}
              </div>
            ) : (
              <ul className="space-y-3">
                {visibleQuests.map((quest) => {
                  const status = questStatuses[quest.id] ?? quest.initialStatus;
                  const statusLabel = ui.room.taskStatusLabels[status];

                  return (
                    <li
                      key={quest.id}
                      className="border p-4"
                      style={{
                        backgroundColor: 'var(--bg-surface-muted)',
                        borderColor:
                          status === 'completed'
                            ? 'var(--success-primary)'
                            : status === 'failed'
                              ? 'var(--danger-text)'
                              : 'var(--border-default)',
                        borderRadius: 'var(--radius-control)',
                      }}
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <div className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                          {quest.title}
                          {quest.optional && (
                            <span
                              className="ml-2 text-xs font-normal"
                              style={{ color: 'var(--text-secondary)' }}
                            >
                              · {ui.room.taskOptionalLabel}
                            </span>
                          )}
                        </div>
                        <QuestStatusMark status={status} label={statusLabel} />
                      </div>

                      <p className="mt-1.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
                        {quest.description}
                      </p>

                      {hintsAllowed && status === 'active' && (
                        <p
                          className="mt-2 border-t pt-2 text-xs"
                          style={{
                            borderColor: 'var(--border-default)',
                            color: 'var(--text-primary)',
                          }}
                        >
                          <strong className="font-semibold">{ui.room.hudHintLabel}: </strong>
                          {quest.hint}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            )
          ) : ownedItems.length === 0 ? (
            <div
              className="border p-6 text-center text-sm"
              style={{
                backgroundColor: 'var(--bg-surface-muted)',
                borderColor: 'var(--border-default)',
                borderRadius: 'var(--radius-control)',
                color: 'var(--text-secondary)',
              }}
            >
              {ui.room.inventoryEmpty}
            </div>
          ) : (
            <ul className="space-y-3">
              {ownedItems.map((item) => {
                const showImage = Boolean(item.image && !failedImages[item.id]);

                return (
                  <li
                    key={item.id}
                    className="flex items-start gap-3.5 border p-4"
                    style={{
                      backgroundColor: 'var(--bg-surface-muted)',
                      borderColor: 'var(--border-default)',
                      borderRadius: 'var(--radius-control)',
                    }}
                  >
                    <div
                      className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden border p-1.5"
                      style={{
                        backgroundColor: 'var(--bg-surface)',
                        borderColor: 'var(--border-default)',
                        borderRadius: 'var(--radius-control)',
                      }}
                    >
                      {showImage ? (
                        <img
                          src={item.image}
                          alt={item.name}
                          referrerPolicy="no-referrer"
                          onError={() =>
                            setFailedImages((prev) => ({ ...prev, [item.id]: true }))
                          }
                          className="h-full w-full object-contain"
                        />
                      ) : (
                        <Briefcase
                          className="h-6 w-6"
                          style={{ color: 'var(--accent-lime)' }}
                          aria-hidden="true"
                        />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {item.name}
                      </div>
                      <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                        {item.description}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Нижняя панель с возвратом к последнему чекпоинту */}
        <div
          className="mt-4 flex items-center justify-between gap-3 border-t pt-4"
          style={{ borderColor: 'var(--border-default)' }}
        >
          <span className="text-xs tabular-nums" style={{ color: 'var(--text-secondary)' }}>
            {ui.room.inventoryCountLabel}: {ownedItems.length}
          </span>
          <button
            type="button"
            onClick={() => {
              onClose();
              onRestartCheckpoint();
            }}
            className="inline-flex min-h-[38px] items-center gap-1.5 border px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors hover:bg-white/10"
            style={{
              borderColor: 'var(--border-default)',
              borderRadius: 'var(--radius-control)',
              color: 'var(--text-primary)',
            }}
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{ui.room.failRestartCheckpointButton}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
