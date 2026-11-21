/**
 * Универсальный движок комнат, переходов и взаимодействий с объектами (Interactable).
 * Работает только с данными из JSON и флагами мира — не содержит названий конкретных квестов.
 */

import { applyMetricChanges, syncQuestsAndCheckpoint } from './questEngine';
import type {
  DifficultyProfile,
  GameSaveState,
  HotspotAction,
  QuestDef,
  RoleConfig,
  TransitionCondition,
  WorldConfig,
  WorldHotspot,
  WorldPoint,
  WorldState,
} from './types';
import { matchesFlags, setFlag, setFlags } from './worldFlags';

export { matchesFlags } from './worldFlags';

/**
 * Проверяет, должен ли объект (hotspot) отображаться в комнате
 * с учётом флагов мира и уже подобранных в инвентарь предметов.
 */
export function isHotspotVisible(
  hotspot: WorldHotspot,
  worldState: WorldState,
  inventory: string[],
): boolean {
  if (!matchesFlags(hotspot.visibleWhen, worldState)) {
    return false;
  }

  if (hotspot.hideIfHasItem && inventory.includes(hotspot.hideIfHasItem)) {
    return false;
  }

  return true;
}

/**
 * Возвращает список действий (Осмотреть / Взять / Использовать / Поговорить),
 * которые сейчас доступны для данного объекта.
 */
export function getAvailableActions(
  hotspot: WorldHotspot,
  inventory: string[],
  worldState: WorldState,
): HotspotAction[] {
  const configured = hotspot.actions ?? [];

  if (configured.length > 0) {
    return configured.filter((action) => {
      if (action.type === 'pickup' && action.giveItemId && inventory.includes(action.giveItemId)) {
        return false;
      }
      if (action.requireFlags && !matchesFlags(action.requireFlags, worldState)) {
        return false;
      }
      return true;
    });
  }

  if (hotspot.description) {
    return [
      {
        type: hotspot.interactType ?? 'inspect',
        resultText: hotspot.description,
        targetPointId: hotspot.targetPointId,
      },
    ];
  }

  return [];
}

/** Результат выполнения одного действия над объектом */
export interface ActionExecutionResult {
  nextSave: GameSaveState;
  message: string;
  isLocked: boolean;
  movedToPointId?: string;
  newlyCompletedQuests: QuestDef[];
  newlyActivatedQuests: QuestDef[];
}

/**
 * Выполняет выбранное действие (Осмотреть / Взять / Использовать / Поговорить):
 * - проверяет предмет из инвентаря;
 * - выдаёт предмет ровно один раз;
 * - обновляет флаги мира (worldState) и метрики роли;
 * - пересчитывает квесты и при выполнении задачи обновляет чекпоинт.
 */
export function executeHotspotAction(params: {
  hotspot?: WorldHotspot;
  action: HotspotAction;
  saveState: GameSaveState;
  role: RoleConfig;
  difficulty: DifficultyProfile;
  defaultLockedMessage: string;
}): ActionExecutionResult {
  const { hotspot, action, saveState, role, difficulty, defaultLockedMessage } = params;

  if (action.targetPointId && hotspot?.condition) {
    const access = checkTransitionAccess(
      hotspot.condition,
      saveState.worldState,
      saveState.inventory,
      defaultLockedMessage,
    );
    if (!access.allowed) {
      return {
        nextSave: saveState,
        message: access.reason ?? defaultLockedMessage,
        isLocked: true,
        newlyCompletedQuests: [],
        newlyActivatedQuests: [],
      };
    }
  }

  if (action.requireItemId && !saveState.inventory.includes(action.requireItemId)) {
    return {
      nextSave: saveState,
      message: action.lockedText ?? defaultLockedMessage,
      isLocked: true,
      newlyCompletedQuests: [],
      newlyActivatedQuests: [],
    };
  }

  let nextInventory = saveState.inventory;
  let nextWorldState = saveState.worldState;
  let nextMetrics = saveState.metrics;
  let nextPointId = saveState.currentPointId;

  if (action.giveItemId && !nextInventory.includes(action.giveItemId)) {
    nextInventory = [...nextInventory, action.giveItemId];
  }

  if (action.setFlags) {
    nextWorldState = setFlags(nextWorldState, action.setFlags);
  }

  if (action.metricChanges) {
    nextMetrics = applyMetricChanges(role, nextMetrics, action.metricChanges, difficulty);
  }

  if (action.targetPointId) {
    nextPointId = action.targetPointId;
    nextWorldState = setFlag(nextWorldState, `visited_${action.targetPointId}`, true);
  }

  const intermediateSave: GameSaveState = {
    ...saveState,
    currentPointId: nextPointId,
    inventory: nextInventory,
    worldState: nextWorldState,
    metrics: nextMetrics,
  };

  const { nextSave, newlyCompleted, newlyActivated } = syncQuestsAndCheckpoint(
    role,
    intermediateSave,
  );

  return {
    nextSave,
    message: action.resultText,
    isLocked: false,
    movedToPointId: action.targetPointId,
    newlyCompletedQuests: newlyCompleted,
    newlyActivatedQuests: newlyActivated,
  };
}

/**
 * Проверяет, можно ли пройти через дверь или выход с учётом флагов мира и инвентаря.
 */
export function checkTransitionAccess(
  condition: TransitionCondition | undefined,
  worldState: WorldState,
  inventory: string[],
  defaultLockedMessage: string,
): { allowed: boolean; reason?: string } {
  if (!condition) {
    return { allowed: true };
  }

  if (condition.requiredFlag && !matchesFlags(condition.requiredFlag, worldState)) {
    return {
      allowed: false,
      reason: condition.lockedMessage ?? defaultLockedMessage,
    };
  }

  if (condition.requiredItem && !inventory.includes(condition.requiredItem)) {
    return {
      allowed: false,
      reason: condition.lockedMessage ?? defaultLockedMessage,
    };
  }

  return { allowed: true };
}

/** Находит комнату по id, а если её нет — возвращает первую доступную */
export function resolveWorldPoint(world: WorldConfig, pointId: string): WorldPoint {
  return world.points.find((p) => p.id === pointId) ?? world.points[0];
}

/** Возвращает список уникальных связей (рёбер) между точками для отрисовки карты здания */
export function getWorldConnections(world: WorldConfig): Array<{ fromId: string; toId: string }> {
  const seen = new Set<string>();
  const connections: Array<{ fromId: string; toId: string }> = [];

  for (const point of world.points) {
    for (const exit of point.exits) {
      const pairKey = [point.id, exit.targetPointId].sort().join('::');
      if (!seen.has(pairKey)) {
        seen.add(pairKey);
        connections.push({ fromId: point.id, toId: exit.targetPointId });
      }
    }
  }

  return connections;
}

/**
 * Определяет, должна ли кликабельная зона подсвечиваться сейчас
 * в зависимости от выбранного уровня сложности.
 */
export function isHotspotHighlighted(params: {
  difficultyId: string;
  hotspot: WorldHotspot;
  isHovered: boolean;
  cursorPercent: { x: number; y: number } | null;
}): boolean {
  const { difficultyId, hotspot, isHovered, cursorPercent } = params;

  if (difficultyId === 'easy') {
    return true;
  }

  if (difficultyId === 'hard') {
    return false;
  }

  if (isHovered) {
    return true;
  }

  if (!cursorPercent) {
    return false;
  }

  const centerX = hotspot.x + hotspot.width / 2;
  const centerY = hotspot.y + hotspot.height / 2;
  const dx = cursorPercent.x - centerX;
  const dy = cursorPercent.y - centerY;
  const distance = Math.hypot(dx, dy);

  const proximityThreshold = Math.max(hotspot.width, hotspot.height) / 2 + 10;
  return distance <= proximityThreshold;
}
