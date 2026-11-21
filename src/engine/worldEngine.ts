/**
 * Универсальный движок комнат, переходов и взаимодействий с объектами (Interactable).
 * Работает только с данными из JSON и флагами мира — не содержит названий конкретных квестов.
 */

import type {
  GameSaveState,
  HotspotAction,
  TransitionCondition,
  WorldConfig,
  WorldHotspot,
  WorldPoint,
  WorldState,
} from './types';
import { matchesFlags, setFlags } from './worldFlags';

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
 * Действие «Взять» автоматически скрывается, если предмет уже есть в инвентаре (нельзя взять дважды).
 */
export function getAvailableActions(
  hotspot: WorldHotspot,
  inventory: string[],
): HotspotAction[] {
  const configured = hotspot.actions ?? [];

  if (configured.length > 0) {
    return configured.filter((action) => {
      if (action.type === 'pickup' && action.giveItemId && inventory.includes(action.giveItemId)) {
        return false;
      }
      return true;
    });
  }

  // Запасной вариант, если у зоны не прописан массив actions в JSON
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
}

/**
 * Выполняет выбранное действие (Осмотреть / Взять / Использовать / Поговорить):
 * - проверяет, нужен ли предмет из инвентаря;
 * - при подборе добавляет предмет ровно один раз;
 * - обновляет флаги мира через worldFlags;
 * - при необходимости переводит игрока в другую комнату.
 */
export function executeHotspotAction(params: {
  action: HotspotAction;
  saveState: GameSaveState;
  defaultLockedMessage: string;
}): ActionExecutionResult {
  const { action, saveState, defaultLockedMessage } = params;

  // 1. Проверяем требование к предмету (например, для двери в серверную нужен бейдж)
  if (action.requireItemId && !saveState.inventory.includes(action.requireItemId)) {
    return {
      nextSave: saveState,
      message: action.lockedText ?? defaultLockedMessage,
      isLocked: true,
    };
  }

  let nextInventory = saveState.inventory;
  let nextWorldState = saveState.worldState;
  let nextPointId = saveState.currentPointId;

  // 2. Если действие выдаёт предмет — добавляем только если его ещё нет в инвентаре
  if (action.giveItemId && !nextInventory.includes(action.giveItemId)) {
    nextInventory = [...nextInventory, action.giveItemId];
  }

  // 3. Обновляем флаги мира, если они указаны в действии
  if (action.setFlags) {
    nextWorldState = setFlags(nextWorldState, action.setFlags);
  }

  // 4. Если действие открывает переход в другую комнату — обновляем текущую точку
  if (action.targetPointId) {
    nextPointId = action.targetPointId;
  }

  return {
    nextSave: {
      ...saveState,
      currentPointId: nextPointId,
      inventory: nextInventory,
      worldState: nextWorldState,
    },
    message: action.resultText,
    isLocked: false,
    movedToPointId: action.targetPointId,
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
