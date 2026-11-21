/**
 * Движок квестов, метрик роли, таймера рабочего дня и чекпоинтов.
 * Не содержит никаких текстов сюжета — работает только с правилами из JSON-файлов ролей.
 */

import type {
  DayEventDef,
  DifficultyProfile,
  GameSaveState,
  QuestDef,
  QuestStatus,
  RoleConfig,
  RoleMetricDef,
  ShiftCheckpoint,
  WorldState,
} from './types';
import { matchesFlags, setFlags } from './worldFlags';

/** Создаёт стартовые значения шкал метрик по описанию профессии */
export function createInitialMetrics(role: RoleConfig): Record<string, number> {
  const result: Record<string, number> = {};
  for (const metric of role.metrics) {
    result[metric.id] = metric.initial;
  }
  return result;
}

/** Создаёт стартовые статусы всех задач профессии */
export function createInitialQuestStatuses(role: RoleConfig): Record<string, QuestStatus> {
  const result: Record<string, QuestStatus> = {};
  for (const quest of role.quests) {
    result[quest.id] = quest.initialStatus;
  }
  return result;
}

/**
 * Пересчитывает статусы задач (hidden -> active -> completed / failed)
 * на основании текущих флагов мира.
 */
export function evaluateQuests(
  role: RoleConfig,
  worldState: WorldState,
  currentStatuses: Record<string, QuestStatus>,
): {
  nextStatuses: Record<string, QuestStatus>;
  newlyCompleted: QuestDef[];
  newlyActivated: QuestDef[];
} {
  const nextStatuses: Record<string, QuestStatus> = { ...currentStatuses };
  const newlyCompleted: QuestDef[] = [];
  const newlyActivated: QuestDef[] = [];

  for (const quest of role.quests) {
    const prevStatus: QuestStatus = nextStatuses[quest.id] ?? quest.initialStatus;

    // Если задача уже завершена или провалена — не меняем её обратно
    if (prevStatus === 'completed' || prevStatus === 'failed') {
      continue;
    }

    let status: QuestStatus = prevStatus;

    // Сначала проверяем активацию скрытой задачи
    if (status === 'hidden' && quest.activateWhen && matchesFlags(quest.activateWhen, worldState)) {
      status = 'active';
      newlyActivated.push(quest);
    }

    // Затем проверяем условия провала или выполнения
    if (status === 'active') {
      if (quest.failWhen && matchesFlags(quest.failWhen, worldState)) {
        status = 'failed';
      } else if (quest.completeWhen && matchesFlags(quest.completeWhen, worldState)) {
        status = 'completed';
        newlyCompleted.push(quest);
      }
    }

    nextStatuses[quest.id] = status;
  }

  return { nextStatuses, newlyCompleted, newlyActivated };
}

/**
 * Применяет изменения метрик (например, +15 к подозрению или -35 к безопасности).
 * Учитывает множитель роста подозрения из выбранного уровня сложности.
 */
export function applyMetricChanges(
  role: RoleConfig,
  currentMetrics: Record<string, number>,
  changes: Record<string, number> | undefined,
  difficulty: DifficultyProfile,
): Record<string, number> {
  if (!changes) {
    return currentMetrics;
  }

  const next = { ...currentMetrics };

  for (const [metricId, rawDelta] of Object.entries(changes)) {
    const def = role.metrics.find((m) => m.id === metricId);
    if (!def) {
      continue;
    }

    let delta = rawDelta;
    if (def.applySuspicionMultiplier && delta > 0) {
      delta = Math.round(delta * difficulty.params.suspicionMultiplier);
    }

    const baseValue = typeof next[metricId] === 'number' ? next[metricId] : def.initial;
    const clamped = Math.max(def.min, Math.min(def.max, baseValue + delta));
    next[metricId] = clamped;
  }

  return next;
}

/** Проверяет, не достигла ли какая-нибудь шкала критического порога провала */
export function checkRoleFailure(
  role: RoleConfig,
  metrics: Record<string, number>,
): { failed: boolean; title?: string; message?: string; metric?: RoleMetricDef } {
  for (const def of role.metrics) {
    if (!def.failAt) {
      continue;
    }
    const value = typeof metrics[def.id] === 'number' ? metrics[def.id] : def.initial;
    const triggered =
      def.failAt.operator === '>='
        ? value >= def.failAt.value
        : value <= def.failAt.value;

    if (triggered) {
      return {
        failed: true,
        title: def.failAt.title,
        message: def.failAt.message,
        metric: def,
      };
    }
  }

  return { failed: false };
}

/**
 * Создаёт снимок состояния смены (чекпоинт), чтобы при провале можно было вернуться назад,
 * не начиная всю главу с нуля.
 */
export function createCheckpointSnapshot(saveState: GameSaveState): ShiftCheckpoint {
  return {
    currentPointId: saveState.currentPointId,
    worldState: { ...saveState.worldState },
    inventory: [...saveState.inventory],
    metrics: { ...saveState.metrics },
    questStatuses: { ...saveState.questStatuses },
    elapsedGameMinutes: saveState.elapsedGameMinutes,
    triggeredEventIds: [...saveState.triggeredEventIds],
  };
}

/** Восстанавливает состояние смены из последнего чекпоинта (или сбрасывает на старт роли) */
export function restoreSaveFromCheckpoint(
  saveState: GameSaveState,
  role: RoleConfig,
): GameSaveState {
  if (saveState.checkpoint) {
    const cp = saveState.checkpoint;
    return {
      ...saveState,
      currentPointId: cp.currentPointId,
      worldState: { ...cp.worldState },
      inventory: [...cp.inventory],
      metrics: { ...cp.metrics },
      questStatuses: { ...cp.questStatuses },
      elapsedGameMinutes: cp.elapsedGameMinutes,
      triggeredEventIds: [...cp.triggeredEventIds],
    };
  }

  return {
    ...saveState,
    currentPointId: role.startPoint,
    inventory: [],
    metrics: createInitialMetrics(role),
    questStatuses: createInitialQuestStatuses(role),
    elapsedGameMinutes: 0,
    triggeredEventIds: [],
  };
}

/**
 * Пересчитывает квесты после любого действия и при выполнении задачи обновляет чекпоинт.
 */
export function syncQuestsAndCheckpoint(
  role: RoleConfig,
  saveState: GameSaveState,
): {
  nextSave: GameSaveState;
  newlyCompleted: QuestDef[];
  newlyActivated: QuestDef[];
} {
  const { nextStatuses, newlyCompleted, newlyActivated } = evaluateQuests(
    role,
    saveState.worldState,
    saveState.questStatuses,
  );

  let nextSave: GameSaveState = {
    ...saveState,
    questStatuses: nextStatuses,
  };

  // Если все обязательные (не optional) задачи профессии выполнены, отмечаем главу пройденной
  const requiredQuests = role.quests.filter((q) => !q.optional);
  const allRequiredCompleted =
    requiredQuests.length > 0 &&
    requiredQuests.every((q) => nextStatuses[q.id] === 'completed');

  if (allRequiredCompleted && !nextSave.rolesProgress[role.id]?.completed) {
    nextSave = {
      ...nextSave,
      rolesProgress: {
        ...nextSave.rolesProgress,
        [role.id]: {
          completed: true,
          completedAt: new Date().toISOString(),
        },
      },
    };
  }

  if (newlyCompleted.length > 0) {
    nextSave = {
      ...nextSave,
      checkpoint: createCheckpointSnapshot(nextSave),
    };
  }

  return { nextSave, newlyCompleted, newlyActivated };
}

/**
 * Продвигает таймер рабочего дня и проверяет события по времени и флагам.
 */
export function advanceDayTimer(
  role: RoleConfig,
  saveState: GameSaveState,
  difficulty: DifficultyProfile,
  addMinutes: number,
): {
  nextSave: GameSaveState;
  firedEvents: DayEventDef[];
} {
  const nextMinutes = saveState.elapsedGameMinutes + addMinutes;
  const firedEvents: DayEventDef[] = [];

  let nextWorld = saveState.worldState;
  let nextMetrics = saveState.metrics;
  const nextTriggered = [...saveState.triggeredEventIds];

  for (const ev of role.dayEvents ?? []) {
    if (nextTriggered.includes(ev.id)) {
      continue;
    }
    if (nextMinutes < ev.triggerMinute) {
      continue;
    }
    if (ev.requireFlags && !matchesFlags(ev.requireFlags, nextWorld)) {
      continue;
    }

    nextTriggered.push(ev.id);
    if (ev.setFlags) {
      nextWorld = setFlags(nextWorld, ev.setFlags);
    }
    if (ev.metricChanges) {
      nextMetrics = applyMetricChanges(role, nextMetrics, ev.metricChanges, difficulty);
    }
    firedEvents.push(ev);
  }

  const nextSave: GameSaveState = {
    ...saveState,
    elapsedGameMinutes: nextMinutes,
    worldState: nextWorld,
    metrics: nextMetrics,
    triggeredEventIds: nextTriggered,
  };

  return { nextSave, firedEvents };
}

/** Форматирует игровое время дня в виде ЧЧ:ММ (например, 09:15) */
export function formatShiftTime(startTimeMinutes: number, elapsedGameMinutes: number): string {
  const total = Math.floor(startTimeMinutes + elapsedGameMinutes) % (24 * 60);
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}
