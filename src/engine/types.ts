/**
 * Общие типы данных движка игры «День из жизни банка».
 * Этот файл задаёт «чертёж» всех данных: как устроены роли, уровни сложности,
 * предметы инвентаря, комнаты-точки (world.json), квесты, метрики и сохранение.
 */

/** Профиль уровня сложности из content/difficulty.json */
export interface DifficultyProfile {
  id: string;
  title: string;
  description: string;
  icon?: string;
  params: {
    hintsMode: string;
    suspicionGrowthLabel: string;
    suspicionMultiplier: number;
    clientTimeLabel: string;
    clientTimeSeconds: number;
    objectHighlight: string;
    miniGamesDifficulty: string;
  };
}

export interface DifficultyConfig {
  defaultDifficultyId: string;
  profiles: DifficultyProfile[];
}

/**
 * Значения флагов мира (worldState): булевы (да/нет), числа или строки.
 */
export type WorldFlagValue = boolean | number | string;
export type WorldState = Record<string, WorldFlagValue>;

/** Описание одной шкалы (метрики) профессии в файле роли */
export interface RoleMetricDef {
  id: string;
  label: string;
  min: number;
  max: number;
  initial: number;
  tone: 'dangerUp' | 'goodUp';
  applySuspicionMultiplier?: boolean;
  failAt?: {
    operator: '>=' | '<=';
    value: number;
    title: string;
    message: string;
  };
}

/** Состояние задачи в журнале игрока */
export type QuestStatus = 'hidden' | 'active' | 'completed' | 'failed';

/** Описание одной задачи (квеста) в файле роли */
export interface QuestDef {
  id: string;
  order: number;
  title: string;
  description: string;
  hint: string;
  optional?: boolean;
  initialStatus: 'hidden' | 'active';
  activateWhen?: Record<string, WorldFlagValue>;
  completeWhen?: Record<string, WorldFlagValue>;
  failWhen?: Record<string, WorldFlagValue>;
}

/** Событие рабочего дня, срабатывающее по игровому времени и флагам */
export interface DayEventDef {
  id: string;
  triggerMinute: number;
  requireFlags?: Record<string, WorldFlagValue>;
  setFlags?: Record<string, WorldFlagValue>;
  metricChanges?: Record<string, number>;
  notificationTitle: string;
  notificationText: string;
}

/** Условный вывод для итогового отчёта в конце смены */
export interface ReportRule {
  when?: Record<string, WorldFlagValue>;
  text: string;
}

/** Структура итогового качественного отчёта профессии (без чисел, только выводы) */
export interface RoleReportConfig {
  title: string;
  subtitle: string;
  whatWorked: ReportRule[];
  whatWorkedFallback: string;
  mistakes: ReportRule[];
  noMistakesText: string;
  realWorld: string;
  takeaways: string[];
}

/** Один пункт выбора внутри интерактивной мини-проверки безопасности */
export interface MiniGameOption {
  id: string;
  text: string;
  isCorrect: boolean;
  minDifficulty?: 'easy' | 'normal' | 'hard';
}

/** Описание мини-проверки безопасности из content/minigames.json */
export interface MiniGameDef {
  id: string;
  title: string;
  subtitle: string;
  instruction: string;
  confirmButton: string;
  successMessage: string;
  mistakeMessage: string;
  setFlagsOnComplete?: Record<string, WorldFlagValue>;
  successMetricChanges?: Record<string, number>;
  mistakeMetricChanges?: Record<string, number>;
  options: MiniGameOption[];
}

export interface MiniGamesConfig {
  miniGames: MiniGameDef[];
}

/** Описание профессии (роли) из content/roles/*.json */
export interface RoleConfig {
  id: string;
  order: number;
  title: string;
  icon?: string;
  shortSummary: string;
  description: string;
  durationEstimate: string;
  primaryMetricLabel: string;
  startPoint: string;
  startTimeMinutes: number;
  introDialogId?: string;
  introDoneFlag?: string;
  startingItems?: string[];
  metrics: RoleMetricDef[];
  quests: QuestDef[];
  dayEvents?: DayEventDef[];
  report?: RoleReportConfig;
}

/** Предмет инвентаря из content/items.json */
export interface ItemDefinition {
  id: string;
  name: string;
  description: string;
  image?: string;
}

/** Условие доступности перехода или зоны по флагам мира / предметам */
export interface TransitionCondition {
  requiredFlag?: Record<string, WorldFlagValue>;
  requiredItem?: string;
  lockedMessage?: string;
}

/** Тип кликабельной зоны в комнате (для визуального стиля подсветки) */
export type HotspotKind = 'object' | 'npc' | 'door';

/** Тип взаимодействия с интерактивным объектом (Interactable) */
export type InteractableType = 'inspect' | 'pickup' | 'use' | 'talk';

/** Одно действие в выпадающем меню интерактивного объекта */
export interface HotspotAction {
  type: InteractableType;
  label?: string;
  resultText: string;
  giveItemId?: string;
  requireItemId?: string;
  requireFlags?: Record<string, WorldFlagValue>;
  lockedText?: string;
  setFlags?: Record<string, WorldFlagValue>;
  metricChanges?: Record<string, number>;
  targetPointId?: string;
  dialogId?: string;
  miniGameId?: string;
}

/** Кликабельная зона (интерактивный объект), заданная в процентах от размера картинки комнаты */
export interface WorldHotspot {
  id: string;
  label: string;
  kind: HotspotKind;
  interactType?: InteractableType;
  x: number;
  y: number;
  width: number;
  height: number;
  description?: string;
  npcId?: string;
  hideAvatarInRoom?: boolean;
  targetPointId?: string;
  visibleWhen?: Record<string, WorldFlagValue>;
  hideIfHasItem?: string;
  condition?: TransitionCondition;
  actions?: HotspotAction[];
}

/** Дополнительный графический слой комнаты, зависящий от флагов мира */
export interface WorldLayer {
  id: string;
  image: string;
  x: number;
  y: number;
  width: number;
  height: number;
  visibleWhen?: Record<string, WorldFlagValue>;
}

/** Направление стрелки выхода на краю экрана */
export type ExitDirection = 'left' | 'right' | 'up' | 'down';

/** Переход в соседнюю точку здания */
export interface WorldExit {
  direction: ExitDirection;
  targetPointId: string;
  label: string;
  condition?: TransitionCondition;
}

/** Одна точка (комната-экран) из content/world.json */
export interface WorldPoint {
  id: string;
  title: string;
  subtitle: string;
  background: string;
  mapCoords: {
    x: number;
    y: number;
  };
  exits: WorldExit[];
  layers?: WorldLayer[];
  hotspots: WorldHotspot[];
}

/** Персонаж (NPC), стоящий в одной из точек здания */
export interface WorldNpc {
  id: string;
  name: string;
  roleTitle: string;
  pointId: string;
  description: string;
  avatar?: string;
}

/** Полная конфигурация карты мира из content/world.json */
export interface WorldConfig {
  npcs: WorldNpc[];
  points: WorldPoint[];
}

/** Один вариант ответа игрока в ветвящемся диалоге */
export interface DialogChoice {
  id: string;
  text: string;
  nextNodeId?: string;
  requireFlags?: Record<string, WorldFlagValue>;
  requireItemId?: string;
  giveItemId?: string;
  setFlags?: Record<string, WorldFlagValue>;
  metricChanges?: Record<string, number>;
  feedbackText?: string;
}

/** Один узел (реплика NPC и варианты ответа) из content/dialogs.json */
export interface DialogNode {
  id: string;
  text: string;
  choices: DialogChoice[];
}

/** Полное дерево одного диалога с персонажем */
export interface DialogDefinition {
  id: string;
  npcId?: string;
  speakerName: string;
  speakerRole: string;
  startNodeId: string;
  nodes: Record<string, DialogNode>;
}

export interface DialogsConfig {
  dialogs: DialogDefinition[];
}

/** Набор всех текстов интерфейса из content/ui.json */
export interface UiTexts {
  appTitle: string;
  appSubtitle: string;
  menu: {
    continueSectionTitle: string;
    continueButton: string;
    resetButton: string;
    newGameSectionTitle: string;
    nicknameLabel: string;
    nicknamePlaceholder: string;
    nicknameErrorEmpty: string;
    nicknameErrorTooShort: string;
    roleLabel: string;
    roleCompletedLabel: string;
    difficultyLabel: string;
    startButton: string;
    tutorialButton: string;
    sharedWorldNoteTitle: string;
    sharedWorldNoteBody: string;
  };
  difficultyLabels: {
    hints: string;
    suspicionRate: string;
    clientTimer: string;
    objectHighlight: string;
    miniGames: string;
  };
  confirmReset: {
    title: string;
    message: string;
    confirmButton: string;
    cancelButton: string;
  };
  room: {
    backToMenuButton: string;
    tutorialButton: string;
    mapButton: string;
    mapCloseButton: string;
    mapTitle: string;
    mapHint: string;
    mapCurrentBadge: string;
    mapConnectedHint: string;
    mapFarHint: string;
    inventoryButton: string;
    tasksButton: string;
    journalTitle: string;
    journalTasksTab: string;
    journalInventoryTab: string;
    journalCloseButton: string;
    inventoryEmpty: string;
    inventoryCountLabel: string;
    tasksEmpty: string;
    taskStatusLabels: Record<QuestStatus, string>;
    taskOptionalLabel: string;
    hudCurrentGoalLabel: string;
    hudAllGoalsDoneLabel: string;
    hudHintShowButton: string;
    hudHintHideButton: string;
    hudHintLabel: string;
    hudTimeLabel: string;
    hudCheckpointButton: string;
    failRestartCheckpointButton: string;
    failRestartShiftButton: string;
    failBackToMenuButton: string;
    kindLabels: Record<HotspotKind, string>;
    actionLabels: Record<InteractableType, string>;
    actionMenuClose: string;
    inspectActionHint: string;
    lockedDefaultMessage: string;
    dialogCloseButton: string;
    dialogChoicesHint: string;
    finishShiftButton: string;
    reportWhatWorkedTitle: string;
    reportMistakesTitle: string;
    reportRealWorldTitle: string;
    reportTakeawaysTitle: string;
    reportSwitchRoleButton: string;
    reportBackToMenuButton: string;
    reportStayButton: string;
    reportSharedWorldNotice: string;
    miniGameCloseButton: string;
    miniGameDifficultyNote: string;
    soundOnButton: string;
    soundOffButton: string;
    clientTimerLabel: string;
    clientTimerTimeoutNote: string;
    mapVisitedLabel: string;
    metricStatusLabels: {
      safe: string;
      warning: string;
      critical: string;
    };
  };
  errors: {
    contentLoadTitle: string;
    contentLoadHint: string;
  };
}

/** Прогресс игрока по конкретной роли */
export interface RoleProgress {
  completed: boolean;
  completedAt?: string;
}

/** Контрольная точка смены (для отката при провале или ошибке) */
export interface ShiftCheckpoint {
  currentPointId: string;
  worldState: WorldState;
  inventory: string[];
  metrics: Record<string, number>;
  questStatuses: Record<string, QuestStatus>;
  elapsedGameMinutes: number;
  triggeredEventIds: string[];
}

/** Полное сохранение игрока в localStorage */
export interface GameSaveState {
  version: number;
  nickname: string;
  activeRoleId: string;
  difficultyId: string;
  currentPointId: string;
  worldState: WorldState;
  inventory: string[];
  metrics: Record<string, number>;
  questStatuses: Record<string, QuestStatus>;
  elapsedGameMinutes: number;
  triggeredEventIds: string[];
  checkpoint?: ShiftCheckpoint;
  rolesProgress: Record<string, RoleProgress>;
  updatedAt: string;
}

/** Иконка шага интерактивного обучения */
export type TutorialStepIcon = 'mouse' | 'map' | 'briefcase' | 'gauge' | 'roles';

/** Интерактивная мини-практика внутри шага обучения */
export type TutorialPracticeConfig =
  | {
      kind: 'hotspot_demo';
      title: string;
      instruction: string;
      hotspotLabel: string;
      inspectLabel: string;
      inspectResult: string;
      actionLabel: string;
      actionResult: string;
    }
  | {
      kind: 'map_demo';
      title: string;
      instruction: string;
      roomFrom: string;
      roomTo: string;
      unlockButton: string;
      unlockedBadge: string;
      lockedMessage: string;
      movedMessage: string;
    }
  | {
      kind: 'journal_demo';
      title: string;
      instruction: string;
      tasksTabLabel: string;
      inventoryTabLabel: string;
      sampleQuestTitle: string;
      sampleItemName: string;
      sampleItemImage: string;
      pickupButton: string;
      statusActive: string;
      statusDone: string;
    }
  | {
      kind: 'metrics_demo';
      title: string;
      instruction: string;
      safeChoiceLabel: string;
      riskChoiceLabel: string;
      suspicionLabel: string;
      securityLabel: string;
      safeResult: string;
      riskResult: string;
    }
  | {
      kind: 'shared_world_demo';
      title: string;
      instruction: string;
      roleOneLabel: string;
      roleTwoLabel: string;
      togglePlantLabel: string;
      cleanStateText: string;
      plantedStateText: string;
      plantedItemImage: string;
    };

/** Один шаг обучения из content/tutorial.json */
export interface TutorialStep {
  id: string;
  icon: TutorialStepIcon;
  title: string;
  description: string;
  tip?: string;
  practice?: TutorialPracticeConfig;
}

/** Конфигурация окна обучения из content/tutorial.json */
export interface TutorialConfig {
  title: string;
  subtitle: string;
  prevButton: string;
  nextButton: string;
  finishButton: string;
  skipButton: string;
  stepCounterLabel: string;
  practicePromptLabel?: string;
  practiceDoneLabel?: string;
  steps: TutorialStep[];
}

/** Все загруженные и проверенные данные контента игры */
export interface LoadedGameContent {
  ui: UiTexts;
  difficulty: DifficultyConfig;
  roles: RoleConfig[];
  items: ItemDefinition[];
  world: WorldConfig;
  dialogs: DialogsConfig;
  miniGames: MiniGamesConfig;
  tutorial: TutorialConfig;
}
