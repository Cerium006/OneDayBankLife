/**
 * Экран комнаты в жанре point-and-click (вид от первого лица).
 * Отрисовывает фон комнаты и условные слои из public/rooms, кликабельные зоны (hotspots),
 * меню действий (Осмотреть / Взять / Использовать / Поговорить), верхний HUD со шкалами метрик,
 * таймером рабочего дня, текущей целью, подсказками по сложности, дневником (Tab),
 * картой точек (M) и экраном провала смены с откатом к чекпоинту.
 */

import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  BookOpen,
  Briefcase,
  ClipboardCheck,
  ClipboardList,
  Eye,
  Hand,
  HelpCircle,
  KeyRound,
  Lock,
  LogOut,
  Map as MapIcon,
  MessageSquare,
  RotateCcw,
  ShieldAlert,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { executeDialogChoice } from '../engine/dialogEngine';
import { evaluateMiniGameSubmission } from '../engine/miniGameEngine';
import {
  advanceDayTimer,
  applyMetricChanges,
  checkRoleFailure,
  restoreSaveFromCheckpoint,
  syncQuestsAndCheckpoint,
} from '../engine/questEngine';
import { loadSoundEnabled, playSoundEffect, saveSoundEnabled } from '../engine/soundEffects';
import { hasCompletedTutorial, markTutorialCompleted } from '../engine/storage';
import { getFlag, setFlag } from '../engine/worldFlags';
import {
  checkTransitionAccess,
  executeHotspotAction,
  getAvailableActions,
  isHotspotHighlighted,
  isHotspotVisible,
  matchesFlags,
} from '../engine/worldEngine';
import type {
  DialogChoice,
  DialogDefinition,
  DifficultyProfile,
  ExitDirection,
  GameSaveState,
  HotspotAction,
  InteractableType,
  ItemDefinition,
  MiniGameDef,
  RoleConfig,
  TutorialConfig,
  UiTexts,
  WorldConfig,
  WorldHotspot,
  WorldPoint,
} from '../engine/types';
import { theme } from '../theme';
import { DialogModal } from './DialogModal';
import { HudMetrics } from './HudMetrics';
import { JournalModal, type JournalTab } from './JournalModal';
import { MiniGameModal } from './MiniGameModal';
import { PointMap } from './PointMap';
import { ShiftReportModal } from './ShiftReportModal';
import { TutorialModal } from './TutorialModal';

interface RoomScreenProps {
  ui: UiTexts;
  world: WorldConfig;
  items: ItemDefinition[];
  dialogs: DialogDefinition[];
  miniGames: MiniGameDef[];
  tutorial: TutorialConfig;
  currentPoint: WorldPoint;
  saveState: GameSaveState;
  role: RoleConfig;
  otherRole: RoleConfig | null;
  difficulty: DifficultyProfile;
  onSaveUpdate: (nextSave: GameSaveState) => void;
  onRestartShift: () => void;
  onSwitchRole: (roleId: string) => void;
  onBackToMenu: () => void;
}

interface InspectNotice {
  title: string;
  subtitle: string;
  body: string;
  questNote?: string;
  isLocked?: boolean;
  image?: string;
  imageAlt?: string;
}

/** Подбирает иконку-стрелку в зависимости от стороны экрана */
function DirectionIcon({ direction }: { direction: ExitDirection }) {
  switch (direction) {
    case 'left':
      return <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden="true" />;
    case 'right':
      return <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />;
    case 'up':
      return <ArrowUp className="h-4 w-4 shrink-0" aria-hidden="true" />;
    case 'down':
      return <ArrowDown className="h-4 w-4 shrink-0" aria-hidden="true" />;
  }
}

/** Подбирает понятную иконку для кнопки в меню действий объекта */
function ActionIcon({ type }: { type: InteractableType }) {
  switch (type) {
    case 'inspect':
      return <Eye className="h-4 w-4 shrink-0" aria-hidden="true" />;
    case 'pickup':
      return <Hand className="h-4 w-4 shrink-0" aria-hidden="true" />;
    case 'use':
      return <KeyRound className="h-4 w-4 shrink-0" aria-hidden="true" />;
    case 'talk':
      return <MessageSquare className="h-4 w-4 shrink-0" aria-hidden="true" />;
  }
}

export function RoomScreen({
  ui,
  world,
  items,
  dialogs,
  miniGames,
  tutorial,
  currentPoint,
  saveState,
  role,
  otherRole,
  difficulty,
  onSaveUpdate,
  onRestartShift,
  onSwitchRole,
  onBackToMenu,
}: RoomScreenProps) {
  const stageWrapperRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);

  // Точный размер доступного контейнера под сцену, чтобы рамка комнаты подстраивалась под любой HUD
  const [wrapperSize, setWrapperSize] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });
  // Соотношение сторон текущей картинки комнаты (подстраивается автоматически при загрузке фото)
  const [stageAspectRatio, setStageAspectRatio] = useState<number>(16 / 9);
  // Смещение параллакса от положения курсора (от -1 до +1 по каждой оси)
  const [parallaxOffset, setParallaxOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  // Позиция курсора внутри сцены в процентах (нужна для подсветки на нормальной сложности)
  const [cursorPercent, setCursorPercent] = useState<{ x: number; y: number } | null>(null);
  // Идентификатор зоны, на которую сейчас наведён курсор
  const [hoveredHotspotId, setHoveredHotspotId] = useState<string | null>(null);
  // Выбранный объект, для которого сейчас открыто маленькое меню действий
  const [selectedHotspotId, setSelectedHotspotId] = useState<string | null>(null);
  // Открыта ли карта точек здания
  const [isMapOpen, setIsMapOpen] = useState<boolean>(false);
  // Открыт ли дневник (задачи / инвентарь) и какая вкладка выбрана
  const [isJournalOpen, setIsJournalOpen] = useState<boolean>(false);
  const [journalTab, setJournalTab] = useState<JournalTab>('tasks');
  // Активный ветвящийся диалог (идентификатор дерева и текущего узла)
  const [activeDialogId, setActiveDialogId] = useState<string | null>(null);
  const [activeDialogNodeId, setActiveDialogNodeId] = useState<string | null>(null);
  // Активная мини-проверка безопасности и окно итогового отчёта смены
  const [activeMiniGameId, setActiveMiniGameId] = useState<string | null>(null);
  const [isReportOpen, setIsReportOpen] = useState<boolean>(false);
  // Обучение: открывается автоматически при первом запуске и доступно в любой момент по кнопке HUD
  const [isTutorialOpen, setIsTutorialOpen] = useState<boolean>(() => !hasCompletedTutorial());
  // Показана ли подсказка текущей цели на нормальной сложности
  const [isNormalHintShown, setIsNormalHintShown] = useState<boolean>(false);
  // Плашка результата действия (осмотр, подбор предмета, диалог, закрытая дверь, событие дня)
  const [notice, setNotice] = useState<InspectNotice | null>(null);
  const [noticeImageFailed, setNoticeImageFailed] = useState<boolean>(false);
  const [failedNpcImages, setFailedNpcImages] = useState<Record<string, boolean>>({});
  const [isSoundEnabled, setIsSoundEnabled] = useState<boolean>(() => loadSoundEnabled());

  const npcById = useMemo(
    () => new Map(world.npcs.map((npc) => [npc.id, npc])),
    [world.npcs],
  );
  const itemById = useMemo(
    () => new Map(items.map((item) => [item.id, item])),
    [items],
  );

  const activeDialog = useMemo(
    () => dialogs.find((d) => d.id === activeDialogId) ?? null,
    [dialogs, activeDialogId],
  );
  const activeMiniGame = useMemo(
    () => miniGames.find((m) => m.id === activeMiniGameId) ?? null,
    [miniGames, activeMiniGameId],
  );

  const prefersReducedMotion = useMemo(() => {
    if (typeof window === 'undefined' || !window.matchMedia) {
      return false;
    }
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  // Проверяем, не провалена ли смена по какой-либо шкале метрики
  const roleFailure = useMemo(
    () => checkRoleFailure(role, saveState.metrics),
    [role, saveState.metrics],
  );

  // Отслеживаем свободное пространство под сцену, чтобы фото не обрезалось на любом экране
  useEffect(() => {
    const el = stageWrapperRef.current;
    if (!el || typeof ResizeObserver === 'undefined') {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) {
        return;
      }
      setWrapperSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      });
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Сбрасываем флаг ошибки превью при показе нового уведомления
  useEffect(() => {
    setNoticeImageFailed(false);
  }, [notice]);

  // При переходе в другую комнату закрываем старое меню действий и сбрасываем наведение
  useEffect(() => {
    setHoveredHotspotId(null);
    setSelectedHotspotId(null);
  }, [currentPoint.id]);

  // Если у роли есть вступительный диалог (Кира / Дарья Лисичкина) и он ещё не пройден —
  // открываем его сразу после закрытия стартового обучения
  const introCheckedForRoleRef = useRef<string | null>(null);
  useEffect(() => {
    if (isTutorialOpen) {
      return;
    }
    if (introCheckedForRoleRef.current === `${role.id}:${saveState.updatedAt}`) {
      return;
    }
    if (
      role.introDialogId &&
      role.introDoneFlag &&
      !getFlag(saveState.worldState, role.introDoneFlag, false)
    ) {
      const intro = dialogs.find((d) => d.id === role.introDialogId);
      if (intro) {
        introCheckedForRoleRef.current = `${role.id}:${saveState.updatedAt}`;
        setActiveDialogId(intro.id);
        setActiveDialogNodeId(intro.startNodeId);
      }
    }
  }, [
    isTutorialOpen,
    role.id,
    role.introDialogId,
    role.introDoneFlag,
    saveState.worldState,
    saveState.updatedAt,
    dialogs,
  ]);

  // Держим свежие ссылки на пропсы, чтобы таймер рабочего дня не сбрасывался при каждом клике
  const timerStateRef = useRef({
    saveState,
    role,
    difficulty,
    isPaused: false,
    onSaveUpdate,
  });
  timerStateRef.current = {
    saveState,
    role,
    difficulty,
    isPaused:
      isTutorialOpen ||
      isMapOpen ||
      isJournalOpen ||
      Boolean(activeDialog) ||
      Boolean(activeMiniGame) ||
      isReportOpen ||
      roleFailure.failed,
    onSaveUpdate,
  };

  // Каждые 12 секунд реального времени прибавляем +1 игровую минуту смены и проверяем события дня
  useEffect(() => {
    const intervalId = window.setInterval(() => {
      const current = timerStateRef.current;
      if (current.isPaused) {
        return;
      }

      const { nextSave: afterTimer, firedEvents } = advanceDayTimer(
        current.role,
        current.saveState,
        current.difficulty,
        1,
      );
      const { nextSave, newlyCompleted, newlyActivated } = syncQuestsAndCheckpoint(
        current.role,
        afterTimer,
      );

      current.onSaveUpdate(nextSave);

      if (firedEvents.length > 0) {
        const ev = firedEvents[0];
        const questParts: string[] = [];
        if (newlyCompleted.length > 0) {
          questParts.push(`Выполнена задача: ${newlyCompleted.map((q) => q.title).join(', ')}`);
        }
        if (newlyActivated.length > 0) {
          questParts.push(`Новая задача: ${newlyActivated.map((q) => q.title).join(', ')}`);
        }
        setNotice({
          title: ev.notificationTitle,
          subtitle: ui.room.hudTimeLabel,
          body: ev.notificationText,
          questNote: questParts.length > 0 ? questParts.join(' · ') : undefined,
        });
      }
    }, 12000);

    return () => window.clearInterval(intervalId);
  }, [ui.room.hudTimeLabel]);

  function handleCloseTutorial() {
    markTutorialCompleted();
    setIsTutorialOpen(false);
  }

  // Горячие клавиши: Tab — дневник/инвентарь, M — карта точек, Esc — закрыть окна или вернуться в меню
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (roleFailure.failed || isTutorialOpen) {
        return;
      }

      if (event.key === 'Tab') {
        event.preventDefault();
        setIsMapOpen(false);
        setSelectedHotspotId(null);
        setJournalTab('inventory');
        setIsJournalOpen((prev) => !prev);
        return;
      }

      if (event.key === 'Escape') {
        if (isReportOpen) {
          setIsReportOpen(false);
          return;
        }
        if (activeMiniGame) {
          setActiveMiniGameId(null);
          return;
        }
        if (activeDialog) {
          setActiveDialogId(null);
          setActiveDialogNodeId(null);
          return;
        }
        if (isJournalOpen) {
          setIsJournalOpen(false);
          return;
        }
        if (isMapOpen) {
          setIsMapOpen(false);
          return;
        }
        if (selectedHotspotId) {
          setSelectedHotspotId(null);
          return;
        }
        if (notice) {
          setNotice(null);
          return;
        }
        onBackToMenu();
        return;
      }

      if (event.key === 'm' || event.key === 'M' || event.key === 'ь' || event.key === 'Ь') {
        if (activeDialog || activeMiniGame || isReportOpen) {
          return;
        }
        setIsJournalOpen(false);
        setSelectedHotspotId(null);
        setIsMapOpen((prev) => !prev);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isTutorialOpen,
    activeDialog,
    activeMiniGame,
    isReportOpen,
    isJournalOpen,
    isMapOpen,
    selectedHotspotId,
    notice,
    roleFailure.failed,
    onBackToMenu,
  ]);

  // Отбираем слои комнаты, которые разрешены текущими флагами мира
  const visibleLayers = useMemo(
    () =>
      (currentPoint.layers ?? []).filter((layer) =>
        matchesFlags(layer.visibleWhen, saveState.worldState),
      ),
    [currentPoint.layers, saveState.worldState],
  );

  // Отбираем кликабельные зоны, которые видны с учётом флагов мира и уже подобранных предметов
  const visibleHotspots = useMemo(
    () =>
      currentPoint.hotspots.filter((hs) =>
        isHotspotVisible(hs, saveState.worldState, saveState.inventory),
      ),
    [currentPoint.hotspots, saveState.worldState, saveState.inventory],
  );

  const selectedHotspot = useMemo(
    () => visibleHotspots.find((hs) => hs.id === selectedHotspotId) ?? null,
    [visibleHotspots, selectedHotspotId],
  );

  // Находим главную текущую цель для показа в HUD
  const visibleQuests = useMemo(
    () =>
      role.quests.filter((q) => (saveState.questStatuses[q.id] ?? q.initialStatus) !== 'hidden'),
    [role.quests, saveState.questStatuses],
  );
  const completedQuestsCount = useMemo(
    () =>
      visibleQuests.filter((q) => (saveState.questStatuses[q.id] ?? q.initialStatus) === 'completed')
        .length,
    [visibleQuests, saveState.questStatuses],
  );
  const currentActiveQuest = useMemo(() => {
    const activeMain = visibleQuests.find(
      (q) => !q.optional && (saveState.questStatuses[q.id] ?? q.initialStatus) === 'active',
    );
    if (activeMain) {
      return activeMain;
    }
    return (
      visibleQuests.find((q) => (saveState.questStatuses[q.id] ?? q.initialStatus) === 'active') ??
      null
    );
  }, [visibleQuests, saveState.questStatuses]);

  const allRequiredQuestsCompleted = useMemo(() => {
    const required = role.quests.filter((q) => !q.optional);
    return (
      required.length > 0 &&
      required.every((q) => (saveState.questStatuses[q.id] ?? q.initialStatus) === 'completed')
    );
  }, [role.quests, saveState.questStatuses]);

  function handleStageMouseMove(event: MouseEvent<HTMLDivElement>) {
    const stageEl = stageRef.current;
    if (!stageEl) {
      return;
    }
    const rect = stageEl.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      return;
    }

    const relX = ((event.clientX - rect.left) / rect.width) * 100;
    const relY = ((event.clientY - rect.top) / rect.height) * 100;
    setCursorPercent({
      x: Math.max(0, Math.min(100, relX)),
      y: Math.max(0, Math.min(100, relY)),
    });

    if (!prefersReducedMotion) {
      const normX = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
      const normY = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
      setParallaxOffset({ x: normX, y: normY });
    }
  }

  function handleStageMouseLeave() {
    setParallaxOffset({ x: 0, y: 0 });
    setCursorPercent(null);
    setHoveredHotspotId(null);
  }

  /** Возвращает игрока к последнему сохранённому чекпоинту (например, после ошибки) */
  function handleRestoreCheckpoint() {
    playSoundEffect('click', isSoundEnabled);
    const restored = restoreSaveFromCheckpoint(saveState, role);
    setSelectedHotspotId(null);
    onSaveUpdate(restored);
    setNotice({
      title: ui.room.hudCheckpointButton,
      subtitle: role.title,
      body: 'Состояние смены возвращено к последней контрольной точке.',
    });
  }

  /** Переход через стрелку на краю экрана или по карте точек */
  function tryMoveToPoint(targetPointId: string, condition?: WorldHotspot['condition']) {
    const access = checkTransitionAccess(
      condition,
      saveState.worldState,
      saveState.inventory,
      ui.room.lockedDefaultMessage,
    );

    if (!access.allowed) {
      playSoundEffect('locked', isSoundEnabled);
      setNotice({
        title: ui.room.kindLabels.door,
        subtitle: currentPoint.title,
        body: access.reason ?? ui.room.lockedDefaultMessage,
        isLocked: true,
      });
      return;
    }

    playSoundEffect('move', isSoundEnabled);

    let nextWorld = setFlag(saveState.worldState, `visited_${targetPointId}`, true);
    if (targetPointId === 'server_room') {
      nextWorld = setFlag(nextWorld, 'serverEntered', true);
    }

    const updatedSave: GameSaveState = {
      ...saveState,
      currentPointId: targetPointId,
      worldState: nextWorld,
    };

    const { nextSave, newlyCompleted, newlyActivated } = syncQuestsAndCheckpoint(
      role,
      updatedSave,
    );
    onSaveUpdate(nextSave);

    if (newlyCompleted.length > 0 || newlyActivated.length > 0) {
      if (newlyCompleted.length > 0) {
        playSoundEffect('success', isSoundEnabled);
      }
      const questParts: string[] = [];
      if (newlyCompleted.length > 0) {
        questParts.push(`Выполнена задача: ${newlyCompleted.map((q) => q.title).join(', ')}`);
      }
      if (newlyActivated.length > 0) {
        questParts.push(`Новая задача: ${newlyActivated.map((q) => q.title).join(', ')}`);
      }
      setNotice({
        title: world.points.find((p) => p.id === targetPointId)?.title ?? targetPointId,
        subtitle: ui.room.tasksButton,
        body: questParts.join(' · '),
      });
    } else {
      setNotice(null);
    }
  }

  /** Клик по зоне: открываем маленькое меню доступных действий */
  function handleHotspotClick(event: MouseEvent<HTMLButtonElement>, hotspot: WorldHotspot) {
    event.stopPropagation();
    playSoundEffect('click', isSoundEnabled);
    setSelectedHotspotId((prev) => (prev === hotspot.id ? null : hotspot.id));
  }

  /** Выполнение одного из действий меню (Осмотреть / Взять / Использовать / Поговорить) */
  function handleExecuteAction(hotspot: WorldHotspot, action: HotspotAction) {
    setSelectedHotspotId(null);

    // Если к действию привязана мини-проверка безопасности — открываем её окно
    if (action.miniGameId) {
      const game = miniGames.find((m) => m.id === action.miniGameId);
      if (game) {
        playSoundEffect('click', isSoundEnabled);
        setNotice(null);
        setActiveMiniGameId(game.id);
        return;
      }
    }

    // Если у действия привязан ветвящийся диалог — открываем окно диалога
    if (action.dialogId) {
      const dialog = dialogs.find((d) => d.id === action.dialogId);
      if (dialog) {
        playSoundEffect('click', isSoundEnabled);
        setNotice(null);
        setActiveDialogId(dialog.id);
        setActiveDialogNodeId(dialog.startNodeId);
        return;
      }
    }

    const result = executeHotspotAction({
      hotspot,
      action,
      saveState,
      role,
      difficulty,
      defaultLockedMessage: ui.room.lockedDefaultMessage,
    });

    if (result.nextSave !== saveState) {
      onSaveUpdate(result.nextSave);
    }

    if (result.isLocked) {
      playSoundEffect('locked', isSoundEnabled);
    } else if (result.newlyCompletedQuests.length > 0) {
      playSoundEffect('success', isSoundEnabled);
    } else if (action.giveItemId) {
      playSoundEffect('pickup', isSoundEnabled);
    } else {
      playSoundEffect('click', isSoundEnabled);
    }

    const npcInfo = hotspot.npcId ? npcById.get(hotspot.npcId) : undefined;
    const givenItem = action.giveItemId ? itemById.get(action.giveItemId) : undefined;

    const questParts: string[] = [];
    if (result.newlyCompletedQuests.length > 0) {
      questParts.push(
        `Выполнена задача: ${result.newlyCompletedQuests.map((q) => q.title).join(', ')}`,
      );
    }
    if (result.newlyActivatedQuests.length > 0) {
      questParts.push(
        `Новая задача: ${result.newlyActivatedQuests.map((q) => q.title).join(', ')}`,
      );
    }

    setNotice({
      title: hotspot.label,
      subtitle: npcInfo ? npcInfo.roleTitle : ui.room.actionLabels[action.type],
      body: result.message,
      questNote: questParts.length > 0 ? questParts.join(' · ') : undefined,
      isLocked: result.isLocked,
      image: givenItem?.image ?? npcInfo?.avatar,
      imageAlt: givenItem?.name ?? npcInfo?.name,
    });
  }

  /** Обработка завершения мини-проверки безопасности */
  function handleSubmitMiniGame(selectedIds: string[]) {
    if (!activeMiniGame) {
      return;
    }

    const result = evaluateMiniGameSubmission({
      miniGame: activeMiniGame,
      selectedOptionIds: selectedIds,
      saveState,
      role,
      difficulty,
    });

    onSaveUpdate(result.nextSave);
    setActiveMiniGameId(null);
    playSoundEffect(result.isPerfect ? 'success' : 'alert', isSoundEnabled);

    const questParts: string[] = [];
    if (result.newlyCompletedQuests.length > 0) {
      questParts.push(
        `Выполнена задача: ${result.newlyCompletedQuests.map((q) => q.title).join(', ')}`,
      );
    }
    if (result.newlyActivatedQuests.length > 0) {
      questParts.push(
        `Новая задача: ${result.newlyActivatedQuests.map((q) => q.title).join(', ')}`,
      );
    }

    setNotice({
      title: activeMiniGame.title,
      subtitle: role.title,
      body: result.message,
      questNote: questParts.length > 0 ? questParts.join(' · ') : undefined,
    });
  }

  /** Обработка выбранного ответа в ветвящемся диалоге */
  const handleSelectDialogChoice = useCallback(
    (choice: DialogChoice) => {
      if (!activeDialog) {
        return;
      }

      const result = executeDialogChoice({
        dialog: activeDialog,
        choice,
        saveState,
        role,
        difficulty,
      });

      onSaveUpdate(result.nextSave);

      if (result.newlyCompletedQuests.length > 0) {
        playSoundEffect('success', isSoundEnabled);
      } else if (choice.giveItemId) {
        playSoundEffect('pickup', isSoundEnabled);
      } else {
        playSoundEffect('click', isSoundEnabled);
      }

      const questParts: string[] = [];
      if (result.newlyCompletedQuests.length > 0) {
        questParts.push(
          `Выполнена задача: ${result.newlyCompletedQuests.map((q) => q.title).join(', ')}`,
        );
      }
      if (result.newlyActivatedQuests.length > 0) {
        questParts.push(
          `Новая задача: ${result.newlyActivatedQuests.map((q) => q.title).join(', ')}`,
        );
      }

      if (result.isFinished) {
        const speakerName = activeDialog.speakerName;
        const speakerRole = activeDialog.speakerRole;
        const speakerAvatar = activeDialog.npcId
          ? npcById.get(activeDialog.npcId)?.avatar
          : undefined;
        setActiveDialogId(null);
        setActiveDialogNodeId(null);

        if (result.feedbackText || questParts.length > 0) {
          setNotice({
            title: speakerName,
            subtitle: speakerRole,
            body: result.feedbackText ?? 'Разговор завершён.',
            questNote: questParts.length > 0 ? questParts.join(' · ') : undefined,
            image: speakerAvatar,
            imageAlt: speakerName,
          });
        }
      } else {
        setActiveDialogNodeId(result.nextNodeId);
      }
    },
    [activeDialog, saveState, role, difficulty, onSaveUpdate, isSoundEnabled, npcById],
  );

  /** Срабатывает при истечении таймера терпения клиента на нормальной/сложной сложности */
  const handleClientTimeout = useCallback(() => {
    playSoundEffect('alert', isSoundEnabled);
    const nextMetrics = applyMetricChanges(role, saveState.metrics, { trust: -5 }, difficulty);
    onSaveUpdate({
      ...saveState,
      metrics: nextMetrics,
    });
  }, [role, saveState, difficulty, onSaveUpdate, isSoundEnabled]);

  function handleToggleSound() {
    setIsSoundEnabled((prev) => {
      const next = !prev;
      saveSoundEnabled(next);
      if (next) {
        playSoundEffect('click', true);
      }
      return next;
    });
  }

  const roomBackdropColor = theme.roomColors[currentPoint.id] ?? theme.colors.surfaceMuted;

  const parallaxTransform = prefersReducedMotion
    ? 'none'
    : `scale(1.03) translate3d(${(-parallaxOffset.x * 10).toFixed(2)}px, ${(-parallaxOffset.y * 6).toFixed(2)}px, 0)`;

  // Вычисляем точные размеры области сцены внутри доступного окна
  const computedStageStyle = useMemo(() => {
    if (wrapperSize.width > 0 && wrapperSize.height > 0) {
      const fitWidth = Math.min(wrapperSize.width, wrapperSize.height * stageAspectRatio);
      const fitHeight = fitWidth / stageAspectRatio;
      return {
        width: `${Math.floor(fitWidth)}px`,
        height: `${Math.floor(fitHeight)}px`,
        backgroundColor: roomBackdropColor,
        borderRadius: 'var(--radius-card)',
      };
    }

    return {
      aspectRatio: String(stageAspectRatio),
      width: `min(100%, calc((100vh - 130px) * ${stageAspectRatio}))`,
      backgroundColor: roomBackdropColor,
      borderRadius: 'var(--radius-card)',
    };
  }, [wrapperSize, stageAspectRatio, roomBackdropColor]);

  const showHintInline =
    Boolean(currentActiveQuest) &&
    (difficulty.id === 'easy' || (difficulty.id === 'normal' && isNormalHintShown));

  return (
    <div
      className="relative flex h-screen w-screen flex-col overflow-hidden select-none"
      style={{ backgroundColor: 'var(--bg-page)' }}
    >
      {/* Верхняя панель информации (HUD): комната, часы и метрики, текущая цель и кнопки */}
      <header
        className="z-20 border-b px-4 py-2 sm:px-6"
        style={{
          backgroundColor: 'var(--hud-overlay)',
          borderColor: 'var(--hud-border)',
          color: 'var(--hud-text)',
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold sm:text-lg">{currentPoint.title}</h1>
            <p className="truncate text-xs" style={{ color: 'var(--text-secondary)' }}>
              {currentPoint.subtitle} · {saveState.nickname} · {difficulty.title}
            </p>
          </div>

          <HudMetrics
            ui={ui}
            role={role}
            metrics={saveState.metrics}
            elapsedGameMinutes={saveState.elapsedGameMinutes}
          />

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setIsMapOpen(false);
                setSelectedHotspotId(null);
                setJournalTab('tasks');
                setIsJournalOpen(true);
              }}
              className="inline-flex min-h-[36px] items-center gap-1.5 border px-2.5 py-1 text-xs font-medium whitespace-nowrap tabular-nums transition-colors hover:bg-white/10"
              style={{
                borderColor: 'var(--hud-border)',
                borderRadius: 'var(--radius-control)',
                color: 'var(--hud-text)',
              }}
            >
              <ClipboardList className="h-4 w-4" aria-hidden="true" />
              <span>
                {ui.room.tasksButton} · {completedQuestsCount}/{visibleQuests.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setIsMapOpen(false);
                setSelectedHotspotId(null);
                setJournalTab('inventory');
                setIsJournalOpen(true);
              }}
              className="inline-flex min-h-[36px] items-center gap-1.5 border px-2.5 py-1 text-xs font-medium whitespace-nowrap tabular-nums transition-colors hover:bg-white/10"
              style={{
                borderColor: 'var(--hud-border)',
                borderRadius: 'var(--radius-control)',
                color: 'var(--hud-text)',
              }}
            >
              <Briefcase className="h-4 w-4" aria-hidden="true" />
              <span>
                {ui.room.inventoryButton}
                {saveState.inventory.length > 0 ? ` · ${saveState.inventory.length}` : ''}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setIsJournalOpen(false);
                setSelectedHotspotId(null);
                setIsMapOpen(true);
              }}
              className="inline-flex min-h-[36px] items-center gap-1.5 border px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-colors hover:bg-white/10"
              style={{
                borderColor: 'var(--hud-border)',
                borderRadius: 'var(--radius-control)',
                color: 'var(--hud-text)',
              }}
            >
              <MapIcon className="h-4 w-4" aria-hidden="true" />
              <span>{ui.room.mapButton}</span>
            </button>

            <button
              type="button"
              onClick={handleRestoreCheckpoint}
              className="inline-flex min-h-[36px] items-center gap-1.5 border px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-colors hover:bg-white/10"
              style={{
                borderColor: 'var(--hud-border)',
                borderRadius: 'var(--radius-control)',
                color: 'var(--hud-text)',
              }}
              title={ui.room.failRestartCheckpointButton}
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">{ui.room.hudCheckpointButton}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setSelectedHotspotId(null);
                setIsTutorialOpen(true);
              }}
              className="inline-flex min-h-[36px] items-center gap-1.5 border px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-colors hover:bg-white/10"
              style={{
                borderColor: 'var(--hud-border)',
                borderRadius: 'var(--radius-control)',
                color: 'var(--hud-text)',
              }}
            >
              <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">{ui.room.tutorialButton}</span>
            </button>

            <button
              type="button"
              onClick={handleToggleSound}
              aria-label={isSoundEnabled ? ui.room.soundOnButton : ui.room.soundOffButton}
              title={isSoundEnabled ? ui.room.soundOnButton : ui.room.soundOffButton}
              className="inline-flex min-h-[36px] cursor-pointer items-center justify-center border px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-colors hover:bg-white/10"
              style={{
                borderColor: 'var(--hud-border)',
                borderRadius: 'var(--radius-control)',
                color: isSoundEnabled ? 'var(--accent-lime)' : 'var(--text-secondary)',
              }}
            >
              {isSoundEnabled ? (
                <Volume2 className="h-4 w-4" aria-hidden="true" />
              ) : (
                <VolumeX className="h-4 w-4" aria-hidden="true" />
              )}
            </button>

            <button
              type="button"
              onClick={onBackToMenu}
              className="inline-flex min-h-[36px] cursor-pointer items-center gap-1.5 border px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-colors hover:bg-white/10"
              style={{
                borderColor: 'var(--hud-border)',
                borderRadius: 'var(--radius-control)',
                color: 'var(--hud-text)',
              }}
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              <span>{ui.room.backToMenuButton}</span>
            </button>
          </div>
        </div>

        {/* Полоса активной цели, подсказки и кнопки завершения смены */}
        <div
          className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t pt-2 text-xs"
          style={{ borderColor: 'var(--hud-border)' }}
        >
          <div className="min-w-0 flex-1">
            {currentActiveQuest ? (
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className="font-semibold" style={{ color: 'var(--accent-lime)' }}>
                  {ui.room.hudCurrentGoalLabel}:
                </span>
                <span className="font-medium" style={{ color: 'var(--hud-text)' }}>
                  {currentActiveQuest.title}
                </span>
                {showHintInline && (
                  <span style={{ color: 'var(--text-secondary)' }}>
                    — {ui.room.hudHintLabel}: {currentActiveQuest.hint}
                  </span>
                )}
              </div>
            ) : (
              <span className="font-semibold" style={{ color: 'var(--accent-lime)' }}>
                {ui.room.hudAllGoalsDoneLabel}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {currentActiveQuest && difficulty.id === 'normal' && (
              <button
                type="button"
                onClick={() => setIsNormalHintShown((prev) => !prev)}
                className="inline-flex items-center gap-1 border px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-colors hover:bg-white/10"
                style={{
                  borderColor: 'var(--hud-border)',
                  borderRadius: 'var(--radius-control)',
                  color: 'var(--hud-text)',
                }}
              >
                <HelpCircle className="h-3.5 w-3.5" aria-hidden="true" />
                <span>
                  {isNormalHintShown ? ui.room.hudHintHideButton : ui.room.hudHintShowButton}
                </span>
              </button>
            )}

            {allRequiredQuestsCompleted && (
              <button
                type="button"
                onClick={() => {
                  setNotice(null);
                  setIsReportOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold whitespace-nowrap transition-colors"
                style={{
                  backgroundColor: 'var(--success-primary)',
                  color: 'var(--accent-text)',
                  borderRadius: 'var(--radius-control)',
                }}
              >
                <ClipboardCheck className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{ui.room.finishShiftButton}</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Основная область сцены: подстраивается под свободное место и пропорции фото */}
      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden p-1 sm:p-2">
        <div
          ref={stageWrapperRef}
          className="flex h-full w-full items-center justify-center overflow-hidden"
        >
          <div
            ref={stageRef}
            onMouseMove={handleStageMouseMove}
            onMouseLeave={handleStageMouseLeave}
            onClick={() => setSelectedHotspotId(null)}
            className="relative overflow-hidden shadow-2xl"
            style={computedStageStyle}
          >
            {/* Слой с фоном комнаты, дополнительными слоями и кликабельными зонами */}
            <div
              className="absolute inset-0 transition-transform duration-150 ease-out"
              style={{ transform: parallaxTransform }}
            >
              <img
                src={currentPoint.background}
                alt={currentPoint.title}
                draggable={false}
                onLoad={(event) => {
                  const { naturalWidth, naturalHeight } = event.currentTarget;
                  if (naturalWidth > 0 && naturalHeight > 0) {
                    setStageAspectRatio(naturalWidth / naturalHeight);
                  }
                }}
                className="pointer-events-none h-full w-full object-fill"
              />

              {visibleLayers.map((layer) => (
                <img
                  key={layer.id}
                  src={layer.image}
                  alt=""
                  draggable={false}
                  className="pointer-events-none absolute object-contain"
                  style={{
                    left: `${layer.x}%`,
                    top: `${layer.y}%`,
                    width: `${layer.width}%`,
                    height: `${layer.height}%`,
                  }}
                />
              ))}

              {visibleHotspots.map((hotspot) => {
                const isHovered = hoveredHotspotId === hotspot.id;
                const isSelected = selectedHotspotId === hotspot.id;
                const isHighlighted = isHotspotHighlighted({
                  difficultyId: difficulty.id,
                  hotspot,
                  isHovered: isHovered || isSelected,
                  cursorPercent,
                });
                const accentColor = theme.hotspotColors[hotspot.kind];
                const npcSprite =
                  hotspot.kind === 'npc' && !hotspot.hideAvatarInRoom && hotspot.npcId
                    ? npcById.get(hotspot.npcId)
                    : undefined;
                const showNpcSprite = Boolean(npcSprite?.avatar && !failedNpcImages[npcSprite.id]);

                return (
                  <button
                    key={hotspot.id}
                    type="button"
                    aria-label={`${hotspot.label} (${ui.room.kindLabels[hotspot.kind]})`}
                    aria-expanded={isSelected}
                    onMouseEnter={() => setHoveredHotspotId(hotspot.id)}
                    onMouseLeave={() =>
                      setHoveredHotspotId((prev) => (prev === hotspot.id ? null : prev))
                    }
                    onFocus={() => setHoveredHotspotId(hotspot.id)}
                    onBlur={() =>
                      setHoveredHotspotId((prev) => (prev === hotspot.id ? null : prev))
                    }
                    onClick={(event) => handleHotspotClick(event, hotspot)}
                    className="absolute cursor-pointer transition-all duration-150"
                    style={{
                      left: `${hotspot.x}%`,
                      top: `${hotspot.y}%`,
                      width: `${hotspot.width}%`,
                      height: `${hotspot.height}%`,
                      borderRadius: '6px',
                      border: isSelected
                        ? `2px solid ${accentColor}`
                        : isHighlighted
                          ? `2px dashed ${accentColor}`
                          : '2px solid transparent',
                      backgroundColor: isSelected
                        ? `${accentColor}30`
                        : isHighlighted
                          ? `${accentColor}1F`
                          : 'transparent',
                    }}
                  >
                    {/* Спрайт-плейсхолдер персонажа прямо внутри его зоны в комнате */}
                    {showNpcSprite && npcSprite && (
                      <img
                        src={npcSprite.avatar}
                        alt=""
                        draggable={false}
                        referrerPolicy="no-referrer"
                        onError={() =>
                          setFailedNpcImages((prev) => ({ ...prev, [npcSprite.id]: true }))
                        }
                        className="pointer-events-none h-full w-full object-contain object-bottom drop-shadow-[0_6px_12px_rgba(0,0,0,0.45)]"
                      />
                    )}

                    {/* Подпись названия объекта или имени персонажа при наведении (если меню действий не открыто) */}
                    {isHovered && !isSelected && (
                      <span
                        className={`pointer-events-none absolute left-1/2 z-30 -translate-x-1/2 px-2.5 py-1 text-xs font-semibold whitespace-nowrap shadow-lg backdrop-blur-sm ${
                          hotspot.y < 14 ? '-bottom-9' : '-top-9'
                        }`}
                        style={{
                          backgroundColor: 'var(--hud-overlay)',
                          color: 'var(--hud-text)',
                          borderRadius: '6px',
                          border: '1px solid var(--hud-border)',
                        }}
                      >
                        {hotspot.label}
                        <span className="ml-1.5 font-normal" style={{ color: 'var(--text-secondary)' }}>
                          · {ui.room.kindLabels[hotspot.kind]}
                        </span>
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Кинематографическая виньетка по краям комнаты для плавного вписывания интерфейса */}
            <div
              className="pointer-events-none absolute inset-0 z-10"
              style={{
                background:
                  'radial-gradient(ellipse at center, transparent 62%, rgba(16, 20, 17, 0.44) 100%)',
                boxShadow: 'inset 0 0 0 1px rgba(233, 198, 156, 0.14)',
              }}
              aria-hidden="true"
            />

            {/* Маленькое меню действий (Осмотреть / Взять / Использовать / Поговорить) рядом с выбранным объектом */}
            {selectedHotspot && (
              <div
                role="menu"
                aria-label={selectedHotspot.label}
                onClick={(event) => event.stopPropagation()}
                className="ui-pop-in absolute z-30 min-w-[215px] max-w-[280px] -translate-x-1/2 border p-2 shadow-2xl backdrop-blur-md"
                style={{
                  left: `${Math.max(16, Math.min(84, selectedHotspot.x + selectedHotspot.width / 2))}%`,
                  ...(selectedHotspot.y + selectedHotspot.height > 62
                    ? { bottom: `${Math.max(8, 100 - selectedHotspot.y + 1.5)}%` }
                    : { top: `${Math.max(10, selectedHotspot.y + selectedHotspot.height + 1.5)}%` }),
                  backgroundColor: 'var(--hud-overlay)',
                  borderColor: 'var(--hud-border)',
                  color: 'var(--hud-text)',
                  borderRadius: 'var(--radius-control)',
                }}
              >
                <div className="flex items-center justify-between gap-2 border-b border-white/15 px-2 pb-1.5">
                  <span className="truncate text-xs font-semibold">{selectedHotspot.label}</span>
                  <button
                    type="button"
                    onClick={() => setSelectedHotspotId(null)}
                    aria-label={ui.room.actionMenuClose}
                    className="inline-flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded hover:bg-white/10"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>

                <div className="mt-1.5 flex flex-col gap-1">
                  {getAvailableActions(
                    selectedHotspot,
                    saveState.inventory,
                    saveState.worldState,
                  ).map((action, index) => (
                    <button
                      key={`${selectedHotspot.id}-${action.type}-${index}`}
                      type="button"
                      role="menuitem"
                      onClick={() => handleExecuteAction(selectedHotspot, action)}
                      className="flex min-h-[36px] w-full cursor-pointer items-center gap-2 rounded px-2.5 py-1.5 text-left text-xs font-medium whitespace-nowrap transition-colors hover:bg-white/15"
                    >
                      <ActionIcon type={action.type} />
                      <span>{action.label ?? ui.room.actionLabels[action.type]}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Стрелки перехода в соседние комнаты по краям экрана */}
            {currentPoint.exits.map((exit) => {
              const positionClass =
                exit.direction === 'left'
                  ? 'left-3 top-1/2 -translate-y-1/2'
                  : exit.direction === 'right'
                    ? 'right-3 top-1/2 -translate-y-1/2'
                    : exit.direction === 'up'
                      ? 'top-3 left-1/2 -translate-x-1/2'
                      : 'bottom-3 left-1/2 -translate-x-1/2';

              const isLockedExit =
                Boolean(exit.condition) &&
                !checkTransitionAccess(
                  exit.condition,
                  saveState.worldState,
                  saveState.inventory,
                  ui.room.lockedDefaultMessage,
                ).allowed;

              return (
                <button
                  key={`${exit.direction}-${exit.targetPointId}`}
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    setSelectedHotspotId(null);
                    tryMoveToPoint(exit.targetPointId, exit.condition);
                  }}
                  className={`absolute z-20 inline-flex min-h-[40px] cursor-pointer items-center gap-2 border px-3.5 py-2 text-xs font-semibold whitespace-nowrap shadow-lg backdrop-blur-sm transition-transform hover:scale-[1.03] ${positionClass}`}
                  style={{
                    backgroundColor: 'var(--hud-overlay)',
                    borderColor: isLockedExit ? 'rgba(252, 165, 165, 0.45)' : 'var(--hud-border)',
                    color: isLockedExit ? 'var(--danger-text)' : 'var(--hud-text)',
                    borderRadius: 'var(--radius-control)',
                  }}
                >
                  {isLockedExit ? (
                    <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  ) : (
                    <DirectionIcon direction={exit.direction} />
                  )}
                  <span>{exit.label}</span>
                </button>
              );
            })}

            {/* Всплывающая плашка результата действия, квестового обновления или события дня */}
            {notice && (
              <div
                role="status"
                onClick={(event) => event.stopPropagation()}
                className="ui-pop-in absolute bottom-14 left-1/2 z-30 w-[min(92%,560px)] -translate-x-1/2 border p-4 shadow-2xl backdrop-blur-md"
                style={{
                  backgroundColor: 'var(--hud-overlay)',
                  borderColor: notice.isLocked
                    ? 'var(--danger-primary)'
                    : notice.questNote
                      ? 'var(--accent-primary)'
                      : 'var(--hud-border)',
                  color: 'var(--hud-text)',
                  borderRadius: 'var(--radius-card)',
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-1 items-start gap-3.5">
                    {notice.image && !noticeImageFailed && (
                      <div
                        className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden border p-1"
                        style={{
                          backgroundColor: 'var(--bg-surface)',
                          borderColor: 'var(--hud-border)',
                          borderRadius: 'var(--radius-control)',
                        }}
                      >
                        <img
                          src={notice.image}
                          alt={notice.imageAlt ?? notice.title}
                          referrerPolicy="no-referrer"
                          onError={() => setNoticeImageFailed(true)}
                          className="h-full w-full object-contain"
                        />
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                        {notice.subtitle}
                      </div>
                      <div className="mt-0.5 text-base font-semibold">{notice.title}</div>
                      <p className="mt-1.5 text-sm" style={{ color: 'var(--hud-text)' }}>
                        {notice.body}
                      </p>
                      {notice.questNote && (
                        <p className="mt-2 text-xs font-semibold" style={{ color: 'var(--accent-lime)' }}>
                          {notice.questNote}
                        </p>
                      )}
                      {allRequiredQuestsCompleted && (
                        <button
                          type="button"
                          onClick={() => {
                            setNotice(null);
                            setIsReportOpen(true);
                          }}
                          className="mt-3 inline-flex min-h-[36px] cursor-pointer items-center gap-1.5 px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-all hover:brightness-110"
                          style={{
                            backgroundColor: 'var(--success-primary)',
                            color: 'var(--accent-text)',
                            borderRadius: 'var(--radius-control)',
                          }}
                        >
                          <ClipboardCheck className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>{ui.room.finishShiftButton}</span>
                        </button>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setNotice(null)}
                    aria-label="Закрыть сообщение"
                    className="inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded hover:bg-white/10"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Интерактивная карта точек здания из content/world.json */}
      <PointMap
        isOpen={isMapOpen}
        ui={ui}
        world={world}
        currentPoint={currentPoint}
        worldState={saveState.worldState}
        inventory={saveState.inventory}
        onNavigateToPoint={(targetId) => {
          const matchingExit = currentPoint.exits.find((e) => e.targetPointId === targetId);
          tryMoveToPoint(targetId, matchingExit?.condition);
        }}
        onClose={() => setIsMapOpen(false)}
      />

      {/* Дневник смены: задачи и инвентарь (Tab) */}
      <JournalModal
        isOpen={isJournalOpen}
        initialTab={journalTab}
        ui={ui}
        role={role}
        difficulty={difficulty}
        questStatuses={saveState.questStatuses}
        allItems={items}
        ownedItemIds={saveState.inventory}
        onRestartCheckpoint={handleRestoreCheckpoint}
        onClose={() => setIsJournalOpen(false)}
      />

      {/* Окно ветвящегося диалога с персонажем */}
      <DialogModal
        dialog={activeDialog}
        currentNodeId={activeDialogNodeId}
        speakerAvatar={activeDialog?.npcId ? npcById.get(activeDialog.npcId)?.avatar : undefined}
        nickname={saveState.nickname}
        worldState={saveState.worldState}
        inventory={saveState.inventory}
        ui={ui}
        clientTimerSeconds={role.id === 'manager' ? difficulty.params.clientTimeSeconds : 0}
        onClientTimeout={handleClientTimeout}
        onSelectChoice={handleSelectDialogChoice}
        onClose={() => {
          setActiveDialogId(null);
          setActiveDialogNodeId(null);
        }}
      />

      {/* Пошаговое окно обучения (показывается при первом входе и по кнопке «Обучение») */}
      <TutorialModal
        isOpen={isTutorialOpen}
        tutorial={tutorial}
        onClose={handleCloseTutorial}
      />

      {/* Интерактивная мини-проверка безопасности */}
      <MiniGameModal
        miniGame={activeMiniGame}
        difficulty={difficulty}
        ui={ui}
        onSubmit={handleSubmitMiniGame}
        onClose={() => setActiveMiniGameId(null)}
      />

      {/* Итоговый отчёт в конце смены (без чисел — только выводы) */}
      <ShiftReportModal
        isOpen={isReportOpen}
        role={role}
        otherRole={otherRole}
        nickname={saveState.nickname}
        worldState={saveState.worldState}
        ui={ui}
        onSwitchRole={(nextRoleId) => {
          setIsReportOpen(false);
          setNotice(null);
          onSwitchRole(nextRoleId);
        }}
        onBackToMenu={() => {
          setIsReportOpen(false);
          onBackToMenu();
        }}
        onStayInRoom={() => setIsReportOpen(false)}
      />

      {/* Экран провала смены при достижении критической отметки шкалы */}
      {roleFailure.failed && (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="fail-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs"
        >
          <div
            className="w-full max-w-md border p-6 shadow-2xl"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--danger-text)',
              borderRadius: 'var(--radius-card)',
            }}
          >
            <div className="flex items-center gap-3">
              <ShieldAlert
                className="h-7 w-7 shrink-0"
                style={{ color: 'var(--danger-text)' }}
                aria-hidden="true"
              />
              <h2
                id="fail-modal-title"
                className="text-xl font-bold"
                style={{ color: 'var(--text-primary)' }}
              >
                {roleFailure.title}
              </h2>
            </div>

            <p className="mt-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
              {roleFailure.message}
            </p>

            <div className="mt-6 flex flex-col gap-2.5">
              <button
                type="button"
                onClick={handleRestoreCheckpoint}
                className="min-h-[42px] w-full px-4 py-2 text-sm font-semibold transition-all hover:brightness-110"
                style={{
                  backgroundColor: 'var(--accent-primary)',
                  color: 'var(--accent-text)',
                  borderRadius: 'var(--radius-control)',
                }}
              >
                {ui.room.failRestartCheckpointButton}
              </button>
              <button
                type="button"
                onClick={() => {
                  setNotice(null);
                  onRestartShift();
                }}
                className="min-h-[42px] w-full border px-4 py-2 text-sm font-medium transition-colors hover:bg-white/10"
                style={{
                  borderColor: 'var(--border-default)',
                  borderRadius: 'var(--radius-control)',
                  color: 'var(--text-primary)',
                }}
              >
                {ui.room.failRestartShiftButton}
              </button>
              <button
                type="button"
                onClick={onBackToMenu}
                className="min-h-[42px] w-full border px-4 py-2 text-sm font-medium transition-colors hover:bg-white/10"
                style={{
                  borderColor: 'var(--border-default)',
                  borderRadius: 'var(--radius-control)',
                  color: 'var(--text-secondary)',
                }}
              >
                {ui.room.failBackToMenuButton}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
