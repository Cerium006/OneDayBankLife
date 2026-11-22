/**
 * Движок интерактивных мини-проверок безопасности (Шаг 6).
 * Подстраивает набор вариантов под выбранный уровень сложности (простые / средние / с ловушками)
 * и пересчитывает флаги мира, метрики и квесты после завершения проверки.
 */

import { applyMetricChanges, syncQuestsAndCheckpoint } from './questEngine';
import type {
  DifficultyProfile,
  GameSaveState,
  MiniGameDef,
  MiniGameOption,
  QuestDef,
  RoleConfig,
} from './types';
import { getFlag, setFlags } from './worldFlags';

const DIFFICULTY_RANK: Record<string, number> = {
  easy: 1,
  normal: 2,
  hard: 3,
};

/** Перемешивает массив в случайном порядке (алгоритм Фишера — Йейтса) */
export function shuffleArray<T>(items: readonly T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** Возвращает варианты проверки, соответствующие выбранному уровню сложности */
export function getVisibleMiniGameOptions(
  miniGame: MiniGameDef,
  difficultyId: string,
): MiniGameOption[] {
  const playerRank = DIFFICULTY_RANK[difficultyId] ?? 2;
  return miniGame.options.filter((option) => {
    const reqRank = option.minDifficulty ? (DIFFICULTY_RANK[option.minDifficulty] ?? 1) : 1;
    return playerRank >= reqRank;
  });
}

/**
 * Формирует случайный набор и порядок вариантов ответа для проверки в конце смены:
 * перемешивает подходящие по сложности пункты и при наличии sampleSizeByDifficulty
 * отбирает сбалансированную случайную выборку правильных и ошибочных вариантов.
 */
export function pickRandomizedMiniGameOptions(
  miniGame: MiniGameDef,
  difficultyId: string,
): MiniGameOption[] {
  const visible = getVisibleMiniGameOptions(miniGame, difficultyId);
  const diffKey =
    difficultyId === 'easy' || difficultyId === 'normal' || difficultyId === 'hard'
      ? difficultyId
      : 'normal';
  const targetCount = miniGame.sampleSizeByDifficulty?.[diffKey];

  if (!targetCount || targetCount >= visible.length) {
    return shuffleArray(visible);
  }

  const correctPool = shuffleArray(visible.filter((opt) => opt.isCorrect));
  const wrongPool = shuffleArray(visible.filter((opt) => !opt.isCorrect));

  const desiredCorrect = Math.min(correctPool.length, Math.max(1, Math.ceil(targetCount / 2)));
  const desiredWrong = Math.min(wrongPool.length, targetCount - desiredCorrect);

  const picked: MiniGameOption[] = [
    ...correctPool.slice(0, desiredCorrect),
    ...wrongPool.slice(0, desiredWrong),
  ];

  if (picked.length < targetCount) {
    const usedIds = new Set(picked.map((o) => o.id));
    const remaining = shuffleArray(visible.filter((o) => !usedIds.has(o.id)));
    picked.push(...remaining.slice(0, targetCount - picked.length));
  }

  return shuffleArray(picked);
}

export interface MiniGameResult {
  nextSave: GameSaveState;
  isPerfect: boolean;
  alreadyCompleted?: boolean;
  message: string;
  newlyCompletedQuests: QuestDef[];
  newlyActivatedQuests: QuestDef[];
}

/**
 * Проверяет ответ игрока в мини-проверке, записывает флаги завершения,
 * применяет изменение метрик (строго однократно при onceFlag) и обновляет квесты с чекпоинтом.
 */
export function evaluateMiniGameSubmission(params: {
  miniGame: MiniGameDef;
  selectedOptionIds: string[];
  presentedOptionIds?: string[];
  saveState: GameSaveState;
  role: RoleConfig;
  difficulty: DifficultyProfile;
}): MiniGameResult {
  const { miniGame, selectedOptionIds, presentedOptionIds, saveState, role, difficulty } = params;
  const visibleOptions = getVisibleMiniGameOptions(miniGame, difficulty.id);
  const presentedSet =
    presentedOptionIds && presentedOptionIds.length > 0 ? new Set(presentedOptionIds) : null;
  const activeOptions = presentedSet
    ? visibleOptions.filter((opt) => presentedSet.has(opt.id))
    : visibleOptions;

  const selectedSet = new Set(selectedOptionIds);
  const isPerfect = activeOptions.every((opt) =>
    opt.isCorrect ? selectedSet.has(opt.id) : !selectedSet.has(opt.id),
  );

  // Защита от фарма метрик: повторный запуск уже завершённой проверки не меняет показатели
  const alreadyCompleted = Boolean(
    miniGame.onceFlag && getFlag(saveState.worldState, miniGame.onceFlag, false) === true,
  );
  if (alreadyCompleted) {
    return {
      nextSave: saveState,
      isPerfect,
      alreadyCompleted: true,
      message: 'Эта проверка уже завершена в текущей смене — показатели больше не начисляются.',
      newlyCompletedQuests: [],
      newlyActivatedQuests: [],
    };
  }

  let nextWorldState = saveState.worldState;
  if (miniGame.setFlagsOnComplete) {
    nextWorldState = setFlags(nextWorldState, miniGame.setFlagsOnComplete);
  }

  const metricChanges = isPerfect
    ? miniGame.successMetricChanges
    : miniGame.mistakeMetricChanges;
  const nextMetrics = applyMetricChanges(role, saveState.metrics, metricChanges, difficulty);

  const intermediateSave: GameSaveState = {
    ...saveState,
    worldState: nextWorldState,
    metrics: nextMetrics,
  };

  const { nextSave, newlyCompleted, newlyActivated } = syncQuestsAndCheckpoint(
    role,
    intermediateSave,
  );

  return {
    nextSave,
    isPerfect,
    message: isPerfect ? miniGame.successMessage : miniGame.mistakeMessage,
    newlyCompletedQuests: newlyCompleted,
    newlyActivatedQuests: newlyActivated,
  };
}
