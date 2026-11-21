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
import { setFlags } from './worldFlags';

const DIFFICULTY_RANK: Record<string, number> = {
  easy: 1,
  normal: 2,
  hard: 3,
};

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

export interface MiniGameResult {
  nextSave: GameSaveState;
  isPerfect: boolean;
  message: string;
  newlyCompletedQuests: QuestDef[];
  newlyActivatedQuests: QuestDef[];
}

/**
 * Проверяет ответ игрока в мини-проверке, записывает флаги завершения,
 * применяет изменение метрик и обновляет квесты с чекпоинтом.
 */
export function evaluateMiniGameSubmission(params: {
  miniGame: MiniGameDef;
  selectedOptionIds: string[];
  saveState: GameSaveState;
  role: RoleConfig;
  difficulty: DifficultyProfile;
}): MiniGameResult {
  const { miniGame, selectedOptionIds, saveState, role, difficulty } = params;
  const visibleOptions = getVisibleMiniGameOptions(miniGame, difficulty.id);
  const selectedSet = new Set(selectedOptionIds);

  const isPerfect = visibleOptions.every((opt) =>
    opt.isCorrect ? selectedSet.has(opt.id) : !selectedSet.has(opt.id),
  );

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
