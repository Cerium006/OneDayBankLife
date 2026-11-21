/**
 * Движок ветвящихся диалогов (Шаг 4).
 * Не хранит тексты разговоров в коде — работает с деревьями узлов из content/dialogs.json,
 * фильтрует ответы по флагам и предметам, меняет метрики и обновляет квесты с чекпоинтами.
 */

import { applyMetricChanges, syncQuestsAndCheckpoint } from './questEngine';
import type {
  DialogChoice,
  DialogDefinition,
  DialogNode,
  DifficultyProfile,
  GameSaveState,
  QuestDef,
  RoleConfig,
  WorldState,
} from './types';
import { matchesFlags, setFlags } from './worldFlags';

/** Подставляет никнейм игрока вместо меток {ник} и {nickname} в репликах */
export function resolveDialogText(template: string, nickname: string): string {
  return template.replace(/\{ник\}|\{nickname\}/g, nickname);
}

/** Отбирает варианты ответа, доступные игроку по текущим флагам мира и инвентарю */
export function getAvailableDialogChoices(
  node: DialogNode,
  worldState: WorldState,
  inventory: string[],
): DialogChoice[] {
  return node.choices.filter((choice) => {
    if (choice.requireFlags && !matchesFlags(choice.requireFlags, worldState)) {
      return false;
    }
    if (choice.requireItemId && !inventory.includes(choice.requireItemId)) {
      return false;
    }
    return true;
  });
}

export interface DialogChoiceResult {
  nextSave: GameSaveState;
  nextNodeId: string | null;
  isFinished: boolean;
  feedbackText?: string;
  newlyCompletedQuests: QuestDef[];
  newlyActivatedQuests: QuestDef[];
}

/**
 * Выполняет выбранный игроком вариант ответа:
 * выдаёт предмет, записывает флаги, меняет метрики, пересчитывает квесты и чекпоинт,
 * затем возвращает следующий узел диалога (или сигнал о завершении разговора).
 */
export function executeDialogChoice(params: {
  dialog: DialogDefinition;
  choice: DialogChoice;
  saveState: GameSaveState;
  role: RoleConfig;
  difficulty: DifficultyProfile;
}): DialogChoiceResult {
  const { dialog, choice, saveState, role, difficulty } = params;

  let nextInventory = saveState.inventory;
  let nextWorldState = saveState.worldState;
  let nextMetrics = saveState.metrics;

  if (choice.giveItemId && !nextInventory.includes(choice.giveItemId)) {
    nextInventory = [...nextInventory, choice.giveItemId];
  }

  if (choice.setFlags) {
    nextWorldState = setFlags(nextWorldState, choice.setFlags);
  }

  if (choice.metricChanges) {
    nextMetrics = applyMetricChanges(role, nextMetrics, choice.metricChanges, difficulty);
  }

  const intermediateSave: GameSaveState = {
    ...saveState,
    inventory: nextInventory,
    worldState: nextWorldState,
    metrics: nextMetrics,
  };

  const { nextSave, newlyCompleted, newlyActivated } = syncQuestsAndCheckpoint(
    role,
    intermediateSave,
  );

  const hasNextNode =
    Boolean(choice.nextNodeId) &&
    choice.nextNodeId !== 'END' &&
    Boolean(dialog.nodes[choice.nextNodeId as string]);

  return {
    nextSave,
    nextNodeId: hasNextNode ? (choice.nextNodeId as string) : null,
    isFinished: !hasNextNode,
    feedbackText: choice.feedbackText,
    newlyCompletedQuests: newlyCompleted,
    newlyActivatedQuests: newlyActivated,
  };
}
