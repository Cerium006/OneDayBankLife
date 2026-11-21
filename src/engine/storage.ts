/**
 * Модуль сохранения прогресса в память браузера (localStorage).
 * Все данные хранятся только на устройстве игрока и никуда не отправляются.
 */

import type { GameSaveState, WorldState } from './types';

// Уникальный ключ, под которым игра хранит данные в localStorage браузера
const STORAGE_KEY = 'bank_day_sim_save_v1';

/** Начальные значения флагов общего мира по умолчанию */
export function createDefaultWorldState(): WorldState {
  return {
    stickyPasswordFound: false,
    badgePickedUp: false,
    stickyPasswordLeft: false,
    usbPlanted: false,
    guardFooled: false,
    wifiWeak: false,
    reportDelivered: false,
  };
}

/**
 * Создаёт чистое сохранение при запуске новой смены.
 * Межролевые флаги общего мира (например, оставленный стикер или отчёт) сохраняются,
 * а флаги подобранных в текущей смене предметов сбрасываются вместе с пустым инвентарём.
 */
export function createNewSaveState(params: {
  nickname: string;
  roleId: string;
  difficultyId: string;
  startPointId: string;
  previousSave: GameSaveState | null;
}): GameSaveState {
  const { nickname, roleId, difficultyId, startPointId, previousSave } = params;

  const baseWorld = createDefaultWorldState();
  const nextWorldState: WorldState = previousSave?.worldState
    ? {
        ...baseWorld,
        stickyPasswordLeft: Boolean(previousSave.worldState.stickyPasswordLeft),
        usbPlanted: Boolean(previousSave.worldState.usbPlanted),
        guardFooled: Boolean(previousSave.worldState.guardFooled),
        wifiWeak: Boolean(previousSave.worldState.wifiWeak),
        reportDelivered: Boolean(previousSave.worldState.reportDelivered),
      }
    : baseWorld;

  return {
    version: 3,
    nickname: nickname.trim(),
    activeRoleId: roleId,
    difficultyId,
    currentPointId: startPointId,
    worldState: nextWorldState,
    inventory: [],
    rolesProgress: previousSave?.rolesProgress ? { ...previousSave.rolesProgress } : {},
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Читает сохранённый прогресс из localStorage.
 * Недостающие флаги аккуратно дополняются значениями по умолчанию.
 */
export function loadSaveState(fallbackPointId: string): GameSaveState | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<GameSaveState>;

    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      typeof parsed.nickname !== 'string' ||
      !parsed.nickname.trim() ||
      typeof parsed.activeRoleId !== 'string' ||
      typeof parsed.difficultyId !== 'string'
    ) {
      console.warn('[Сохранение] Обнаружены неполные данные в localStorage. Игнорируем старое сохранение.');
      return null;
    }

    return {
      version: 3,
      nickname: parsed.nickname,
      activeRoleId: parsed.activeRoleId,
      difficultyId: parsed.difficultyId,
      currentPointId:
        typeof parsed.currentPointId === 'string' && parsed.currentPointId.trim()
          ? parsed.currentPointId
          : fallbackPointId,
      worldState:
        parsed.worldState && typeof parsed.worldState === 'object'
          ? { ...createDefaultWorldState(), ...parsed.worldState }
          : createDefaultWorldState(),
      inventory: Array.isArray(parsed.inventory) ? parsed.inventory : [],
      rolesProgress:
        parsed.rolesProgress && typeof parsed.rolesProgress === 'object'
          ? parsed.rolesProgress
          : {},
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString(),
    };
  } catch (error) {
    console.error('[Сохранение] Не удалось прочитать данные из localStorage:', error);
    return null;
  }
}

/**
 * Сохраняет текущее состояние игры в localStorage.
 */
export function saveGameState(state: GameSaveState): void {
  try {
    const updated: GameSaveState = {
      ...state,
      updatedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error('[Сохранение] Не удалось записать данные в localStorage:', error);
  }
}

/**
 * Полностью удаляет сохранённый прогресс (кнопка «Сбросить прогресс»).
 */
export function clearSaveState(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('[Сохранение] Не удалось очистить localStorage:', error);
  }
}
