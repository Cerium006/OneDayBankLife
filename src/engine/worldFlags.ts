/**
 * Хранилище и функции работы с флагами мира (worldState).
 * Флаги — это простые переключатели (true/false или числа), по которым игра понимает,
 * что уже сделал игрок, и какие предметы или слои комнат нужно показать или скрыть.
 */

import type { WorldFlagValue, WorldState } from './types';

/**
 * Читает значение флага мира по его имени.
 * Если флаг ещё не был записан, возвращает значение по умолчанию (или undefined).
 */
export function getFlag<T extends WorldFlagValue = WorldFlagValue>(
  worldState: WorldState,
  flagName: string,
  defaultValue?: T,
): WorldFlagValue | undefined {
  if (Object.prototype.hasOwnProperty.call(worldState, flagName)) {
    return worldState[flagName];
  }
  return defaultValue;
}

/**
 * Записывает новое значение одного флага мира, возвращая обновлённую копию worldState
 * (не мутирует старый объект, чтобы React сразу перерисовал изменившуюся комнату).
 */
export function setFlag(
  worldState: WorldState,
  flagName: string,
  value: WorldFlagValue,
): WorldState {
  return {
    ...worldState,
    [flagName]: value,
  };
}

/**
 * Записывает сразу несколько флагов мира за один шаг (например, из действия объекта).
 */
export function setFlags(
  worldState: WorldState,
  updates: Record<string, WorldFlagValue>,
): WorldState {
  return {
    ...worldState,
    ...updates,
  };
}

/**
 * Проверяет, совпадают ли все требуемые флаги мира (используется для показа слоёв и объектов).
 */
export function matchesFlags(
  requiredFlags: Record<string, WorldFlagValue> | undefined,
  worldState: WorldState,
): boolean {
  if (!requiredFlags) {
    return true;
  }

  for (const [key, expected] of Object.entries(requiredFlags)) {
    if (worldState[key] !== expected) {
      return false;
    }
  }
  return true;
}
