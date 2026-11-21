/**
 * Общие типы данных движка игры «День из жизни банка».
 * Этот файл задаёт «чертёж» всех данных: как устроены роли, уровни сложности,
 * предметы инвентаря, комнаты-точки (world.json), интерактивные объекты и сохранение.
 */

/** Профиль уровня сложности из content/difficulty.json */
export interface DifficultyProfile {
  id: string;
  title: string;
  description: string;
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

/** Описание профессии (роли) из content/roles/*.json */
export interface RoleConfig {
  id: string;
  order: number;
  title: string;
  shortSummary: string;
  description: string;
  durationEstimate: string;
  primaryMetricLabel: string;
  startPoint: string;
  initialMetrics: Record<string, number>;
}

/** Предмет инвентаря из content/items.json */
export interface ItemDefinition {
  id: string;
  name: string;
  description: string;
}

/**
 * Флаги общего мира (worldState).
 * Они сохраняются между прохождениями: действия пентестера меняют смену менеджера и наоборот.
 */
export type WorldFlagValue = boolean | number | string;
export type WorldState = Record<string, WorldFlagValue>;

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
  lockedText?: string;
  setFlags?: Record<string, WorldFlagValue>;
  targetPointId?: string;
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
}

/** Полная конфигурация карты мира из content/world.json */
export interface WorldConfig {
  npcs: WorldNpc[];
  points: WorldPoint[];
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
    mapButton: string;
    mapCloseButton: string;
    mapTitle: string;
    mapHint: string;
    mapCurrentBadge: string;
    mapConnectedHint: string;
    mapFarHint: string;
    inventoryButton: string;
    inventoryTitle: string;
    inventoryCloseButton: string;
    inventoryEmpty: string;
    inventoryCountLabel: string;
    kindLabels: Record<HotspotKind, string>;
    actionLabels: Record<InteractableType, string>;
    actionMenuClose: string;
    inspectActionHint: string;
    lockedDefaultMessage: string;
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

/** Полное сохранение игрока в localStorage */
export interface GameSaveState {
  version: number;
  nickname: string;
  activeRoleId: string;
  difficultyId: string;
  currentPointId: string;
  worldState: WorldState;
  inventory: string[];
  rolesProgress: Record<string, RoleProgress>;
  updatedAt: string;
}

/** Все загруженные и проверенные данные контента игры */
export interface LoadedGameContent {
  ui: UiTexts;
  difficulty: DifficultyConfig;
  roles: RoleConfig[];
  items: ItemDefinition[];
  world: WorldConfig;
}
