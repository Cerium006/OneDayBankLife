/**
 * Модуль сохранения прогресса в память браузера (localStorage).
 * Все данные хранятся только на устройстве игрока и никуда не отправляются.
 */

import {
  createCheckpointSnapshot,
  createInitialMetrics,
  createInitialQuestStatuses,
  evaluateQuests,
} from './questEngine';
import type { GameSaveState, RoleConfig, WorldState } from './types';

// Уникальные ключи, под которыми игра хранит данные в localStorage браузера
const STORAGE_KEY = 'bank_day_sim_save_v1';
const TUTORIAL_KEY = 'bank_day_sim_tutorial_v1';

/** Начальные значения флагов общего мира и текущей смены по умолчанию */
export function createDefaultWorldState(): WorldState {
  return {
    // Флаги текущей смены
    entranceCleared: false,
    kiraBriefed: false,
    managerBriefed: false,
    marinaNameKnown: false,
    ticketNumberKnown: false,
    permitShown: false,
    stickyNoticed: false,
    fraudStopped: false,
    clientDanyaServed: false,
    clientNinaServed: false,
    clientOrlovServed: false,
    clientLenaServed: false,
    clientAnnaServed: false,
    stickyPasswordFound: false,
    badgePickedUp: false,
    reconInfoFound: false,
    reconScheduleFound: false,
    wifiChecked: false,
    serverDoorUnlocked: false,
    serverEntered: false,
    monitorChecked: false,
    stickyRemoved: false,
    usbReported: false,
    hallClientsChecked: false,
    guardMistake: false,
    phishingChecked: false,
    // Межролевые флаги общего мира (передаются между ролями)
    stickyPasswordLeft: false,
    usbPlanted: false,
    guardFooled: false,
    wifiWeak: false,
    reportDelivered: false,
  };
}

/**
 * Создаёт чистое сохранение при запуске новой смены.
 * Межролевые флаги общего мира сохраняются,
 * а метрики, квесты, таймер и инвентарь запускаются с нуля для выбранной роли.
 */
export function createNewSaveState(params: {
  nickname: string;
  role: RoleConfig;
  difficultyId: string;
  previousSave: GameSaveState | null;
}): GameSaveState {
  const { nickname, role, difficultyId, previousSave } = params;

  const baseWorld = createDefaultWorldState();
  const nextWorldState: WorldState = previousSave?.worldState
    ? {
        ...baseWorld,
        stickyPasswordLeft: Boolean(previousSave.worldState.stickyPasswordLeft),
        usbPlanted: Boolean(previousSave.worldState.usbPlanted),
        guardFooled: Boolean(previousSave.worldState.guardFooled),
        wifiWeak: Boolean(previousSave.worldState.wifiWeak),
        reportDelivered: Boolean(previousSave.worldState.reportDelivered),
        activeRole: role.id,
        entranceCleared: role.id === 'manager',
      }
    : {
        ...baseWorld,
        activeRole: role.id,
        entranceCleared: role.id === 'manager',
      };

  const initialMetrics = createInitialMetrics(role);
  const initialQuests = createInitialQuestStatuses(role);
  const evaluated = evaluateQuests(role, nextWorldState, initialQuests);

  const initialSave: GameSaveState = {
    version: 4,
    nickname: nickname.trim(),
    activeRoleId: role.id,
    difficultyId,
    currentPointId: role.startPoint,
    worldState: nextWorldState,
    inventory: [...(role.startingItems ?? [])],
    metrics: initialMetrics,
    questStatuses: evaluated.nextStatuses,
    elapsedGameMinutes: 0,
    triggeredEventIds: [],
    rolesProgress: previousSave?.rolesProgress ? { ...previousSave.rolesProgress } : {},
    updatedAt: new Date().toISOString(),
  };

  return {
    ...initialSave,
    checkpoint: createCheckpointSnapshot(initialSave),
  };
}

/**
 * Читает сохранённый прогресс из localStorage.
 * Недостающие поля от старых версий аккуратно дополняются по описанию роли.
 */
export function loadSaveState(roles: RoleConfig[], fallbackPointId: string): GameSaveState | null {
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

    const matchedRole = roles.find((r) => r.id === parsed.activeRoleId) ?? roles[0];
    const mergedWorld: WorldState =
      parsed.worldState && typeof parsed.worldState === 'object'
        ? { ...createDefaultWorldState(), ...parsed.worldState, activeRole: matchedRole?.id ?? parsed.activeRoleId }
        : { ...createDefaultWorldState(), activeRole: matchedRole?.id ?? parsed.activeRoleId };

    const defaultMetrics = matchedRole ? createInitialMetrics(matchedRole) : {};
    const mergedMetrics =
      parsed.metrics && typeof parsed.metrics === 'object'
        ? { ...defaultMetrics, ...parsed.metrics }
        : defaultMetrics;

    const defaultQuests = matchedRole ? createInitialQuestStatuses(matchedRole) : {};
    const mergedQuests =
      parsed.questStatuses && typeof parsed.questStatuses === 'object'
        ? { ...defaultQuests, ...parsed.questStatuses }
        : defaultQuests;
    const evaluated = matchedRole
      ? evaluateQuests(matchedRole, mergedWorld, mergedQuests)
      : { nextStatuses: mergedQuests };

    const rawCheckpoint = parsed.checkpoint;
    const normalizedCheckpoint =
      rawCheckpoint && typeof rawCheckpoint === 'object'
        ? {
            currentPointId:
              typeof rawCheckpoint.currentPointId === 'string' && rawCheckpoint.currentPointId.trim()
                ? rawCheckpoint.currentPointId
                : fallbackPointId,
            worldState:
              rawCheckpoint.worldState && typeof rawCheckpoint.worldState === 'object'
                ? { ...createDefaultWorldState(), ...rawCheckpoint.worldState, activeRole: matchedRole?.id ?? parsed.activeRoleId }
                : mergedWorld,
            inventory: Array.isArray(rawCheckpoint.inventory) ? rawCheckpoint.inventory : [],
            metrics:
              rawCheckpoint.metrics && typeof rawCheckpoint.metrics === 'object'
                ? { ...defaultMetrics, ...rawCheckpoint.metrics }
                : defaultMetrics,
            questStatuses:
              rawCheckpoint.questStatuses && typeof rawCheckpoint.questStatuses === 'object'
                ? { ...defaultQuests, ...rawCheckpoint.questStatuses }
                : defaultQuests,
            elapsedGameMinutes:
              typeof rawCheckpoint.elapsedGameMinutes === 'number'
                ? rawCheckpoint.elapsedGameMinutes
                : 0,
            triggeredEventIds: Array.isArray(rawCheckpoint.triggeredEventIds)
              ? rawCheckpoint.triggeredEventIds
              : [],
          }
        : undefined;

    return {
      version: 4,
      nickname: parsed.nickname,
      activeRoleId: parsed.activeRoleId,
      difficultyId: parsed.difficultyId,
      currentPointId:
        typeof parsed.currentPointId === 'string' && parsed.currentPointId.trim()
          ? parsed.currentPointId
          : fallbackPointId,
      worldState: mergedWorld,
      inventory: Array.isArray(parsed.inventory) ? parsed.inventory : [],
      metrics: mergedMetrics,
      questStatuses: evaluated.nextStatuses,
      elapsedGameMinutes:
        typeof parsed.elapsedGameMinutes === 'number' ? parsed.elapsedGameMinutes : 0,
      triggeredEventIds: Array.isArray(parsed.triggeredEventIds) ? parsed.triggeredEventIds : [],
      checkpoint: normalizedCheckpoint,
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
 * Проверяет, прошёл ли или пропустил игрок стартовое обучение.
 */
export function hasCompletedTutorial(): boolean {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return false;
    }
    return window.localStorage.getItem(TUTORIAL_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Отмечает обучение как пройденное, чтобы оно не открывалось автоматически повторно.
 */
export function markTutorialCompleted(): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }
    window.localStorage.setItem(TUTORIAL_KEY, '1');
  } catch (error) {
    console.error('[Обучение] Не удалось сохранить отметку о прохождении:', error);
  }
}

/**
 * Полностью удаляет сохранённый прогресс (кнопка «Сбросить прогресс»).
 */
export function clearSaveState(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    window.localStorage.removeItem(TUTORIAL_KEY);
  } catch (error) {
    console.error('[Сохранение] Не удалось очистить localStorage:', error);
  }
}
