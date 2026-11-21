/**
 * Экран комнаты в жанре point-and-click (вид от первого лица).
 * Отрисовывает фон комнаты и условные слои из public/rooms, кликабельные зоны (hotspots)
 * в процентах от размера картинки, маленькое меню действий (Осмотреть / Взять / Использовать / Поговорить),
 * стрелки перехода по краям, инвентарь (Tab) и карту точек.
 */

import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Briefcase,
  Eye,
  Hand,
  KeyRound,
  LogOut,
  Map as MapIcon,
  MessageSquare,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import {
  checkTransitionAccess,
  executeHotspotAction,
  getAvailableActions,
  isHotspotHighlighted,
  isHotspotVisible,
  matchesFlags,
} from '../engine/worldEngine';
import type {
  DifficultyProfile,
  ExitDirection,
  GameSaveState,
  HotspotAction,
  InteractableType,
  ItemDefinition,
  RoleConfig,
  UiTexts,
  WorldConfig,
  WorldHotspot,
  WorldPoint,
} from '../engine/types';
import { theme } from '../theme';
import { InventoryModal } from './InventoryModal';
import { PointMap } from './PointMap';

interface RoomScreenProps {
  ui: UiTexts;
  world: WorldConfig;
  items: ItemDefinition[];
  currentPoint: WorldPoint;
  saveState: GameSaveState;
  role: RoleConfig;
  difficulty: DifficultyProfile;
  onSaveUpdate: (nextSave: GameSaveState) => void;
  onBackToMenu: () => void;
}

interface InspectNotice {
  title: string;
  subtitle: string;
  body: string;
  isLocked?: boolean;
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
  currentPoint,
  saveState,
  role,
  difficulty,
  onSaveUpdate,
  onBackToMenu,
}: RoomScreenProps) {
  const stageRef = useRef<HTMLDivElement | null>(null);

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
  // Открыто ли окно инвентаря
  const [isInventoryOpen, setIsInventoryOpen] = useState<boolean>(false);
  // Плашка результата действия (или сообщения о закрытой двери)
  const [notice, setNotice] = useState<InspectNotice | null>(null);

  const prefersReducedMotion = useMemo(() => {
    if (typeof window === 'undefined' || !window.matchMedia) {
      return false;
    }
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  // При переходе в другую комнату закрываем старое меню действий и сбрасываем наведение
  useEffect(() => {
    setHoveredHotspotId(null);
    setSelectedHotspotId(null);
  }, [currentPoint.id]);

  // Горячие клавиши: Tab — инвентарь, M — карта точек, Esc — закрыть окна или вернуться в меню
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Tab') {
        event.preventDefault();
        setIsMapOpen(false);
        setSelectedHotspotId(null);
        setIsInventoryOpen((prev) => !prev);
        return;
      }

      if (event.key === 'Escape') {
        if (isInventoryOpen) {
          setIsInventoryOpen(false);
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
        setIsInventoryOpen(false);
        setSelectedHotspotId(null);
        setIsMapOpen((prev) => !prev);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isInventoryOpen, isMapOpen, selectedHotspotId, notice, onBackToMenu]);

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

  /** Переход через стрелку на краю экрана или по карте точек */
  function tryMoveToPoint(targetPointId: string, condition?: WorldHotspot['condition']) {
    const access = checkTransitionAccess(
      condition,
      saveState.worldState,
      saveState.inventory,
      ui.room.lockedDefaultMessage,
    );

    if (!access.allowed) {
      setNotice({
        title: ui.room.kindLabels.door,
        subtitle: currentPoint.title,
        body: access.reason ?? ui.room.lockedDefaultMessage,
        isLocked: true,
      });
      return;
    }

    setNotice(null);
    onSaveUpdate({
      ...saveState,
      currentPointId: targetPointId,
    });
  }

  /** Клик по зоне: открываем маленькое меню доступных действий */
  function handleHotspotClick(event: MouseEvent<HTMLButtonElement>, hotspot: WorldHotspot) {
    event.stopPropagation();
    setSelectedHotspotId((prev) => (prev === hotspot.id ? null : hotspot.id));
  }

  /** Выполнение одного из действий меню (Осмотреть / Взять / Использовать / Поговорить) */
  function handleExecuteAction(hotspot: WorldHotspot, action: HotspotAction) {
    const result = executeHotspotAction({
      action,
      saveState,
      defaultLockedMessage: ui.room.lockedDefaultMessage,
    });

    setSelectedHotspotId(null);

    if (result.nextSave !== saveState) {
      onSaveUpdate(result.nextSave);
    }

    const npcInfo = hotspot.npcId
      ? world.npcs.find((n) => n.id === hotspot.npcId)
      : undefined;

    setNotice({
      title: hotspot.label,
      subtitle: npcInfo ? npcInfo.roleTitle : ui.room.actionLabels[action.type],
      body: result.message,
      isLocked: result.isLocked,
    });
  }

  const roomBackdropColor = theme.roomColors[currentPoint.id] ?? theme.colors.surfaceMuted;

  const parallaxTransform = prefersReducedMotion
    ? 'none'
    : `scale(1.03) translate3d(${(-parallaxOffset.x * 10).toFixed(2)}px, ${(-parallaxOffset.y * 6).toFixed(2)}px, 0)`;

  return (
    <div className="relative flex h-screen w-screen flex-col overflow-hidden bg-slate-950 select-none">
      {/* Верхняя панель информации (HUD) поверх комнаты */}
      <header
        className="z-20 flex flex-wrap items-center justify-between gap-4 border-b px-4 py-2.5 sm:px-6"
        style={{
          backgroundColor: 'var(--hud-overlay)',
          borderColor: 'var(--hud-border)',
          color: 'var(--hud-text)',
        }}
      >
        <div className="min-w-0">
          <h1 className="truncate text-base font-semibold sm:text-lg">{currentPoint.title}</h1>
          <p className="truncate text-xs text-slate-300">{currentPoint.subtitle}</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="hidden text-xs text-slate-300 lg:block">
            <span>{saveState.nickname}</span>
            <span aria-hidden="true"> · </span>
            <span>{role.title}</span>
            <span aria-hidden="true"> · </span>
            <span>{difficulty.title}</span>
          </div>

          <button
            type="button"
            onClick={() => {
              setIsMapOpen(false);
              setSelectedHotspotId(null);
              setIsInventoryOpen(true);
            }}
            className="inline-flex min-h-[38px] items-center gap-1.5 border px-3 py-1.5 text-xs font-medium whitespace-nowrap tabular-nums transition-colors hover:bg-white/10"
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
              setIsInventoryOpen(false);
              setSelectedHotspotId(null);
              setIsMapOpen(true);
            }}
            className="inline-flex min-h-[38px] items-center gap-1.5 border px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors hover:bg-white/10"
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
            onClick={onBackToMenu}
            className="inline-flex min-h-[38px] items-center gap-1.5 border px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors hover:bg-white/10"
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
      </header>

      {/* Основная область сцены: подстраивается под пропорции фото, чтобы % координаты зон точно совпадали */}
      <div className="relative flex flex-1 items-center justify-center overflow-hidden p-0 sm:p-2">
        <div
          ref={stageRef}
          onMouseMove={handleStageMouseMove}
          onMouseLeave={handleStageMouseLeave}
          onClick={() => setSelectedHotspotId(null)}
          className="relative max-h-full max-w-full overflow-hidden shadow-2xl"
          style={{
            aspectRatio: String(stageAspectRatio),
            width: `min(100%, calc((100vh - 76px) * ${stageAspectRatio}))`,
            backgroundColor: roomBackdropColor,
            borderRadius: 'var(--radius-card)',
          }}
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
                  {/* Подпись названия объекта или имени персонажа при наведении (если меню действий не открыто) */}
                  {isHovered && !isSelected && (
                    <span
                      className="pointer-events-none absolute -top-9 left-1/2 z-30 -translate-x-1/2 px-2.5 py-1 text-xs font-semibold whitespace-nowrap shadow-md"
                      style={{
                        backgroundColor: 'var(--hud-overlay)',
                        color: 'var(--hud-text)',
                        borderRadius: '6px',
                        border: '1px solid var(--hud-border)',
                      }}
                    >
                      {hotspot.label}
                      <span className="ml-1.5 font-normal text-slate-300">
                        · {ui.room.kindLabels[hotspot.kind]}
                      </span>
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Маленькое меню действий (Осмотреть / Взять / Использовать / Поговорить) рядом с выбранным объектом */}
          {selectedHotspot && (
            <div
              role="menu"
              aria-label={selectedHotspot.label}
              onClick={(event) => event.stopPropagation()}
              className="absolute z-30 min-w-[200px] max-w-[260px] -translate-x-1/2 border p-2 shadow-2xl backdrop-blur-sm"
              style={{
                left: `${Math.max(15, Math.min(85, selectedHotspot.x + selectedHotspot.width / 2))}%`,
                top: `${Math.max(12, Math.min(68, selectedHotspot.y + selectedHotspot.height + 2))}%`,
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
                  className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded hover:bg-white/10"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>

              <div className="mt-1.5 flex flex-col gap-1">
                {getAvailableActions(selectedHotspot, saveState.inventory).map((action, index) => (
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

            return (
              <button
                key={`${exit.direction}-${exit.targetPointId}`}
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setSelectedHotspotId(null);
                  tryMoveToPoint(exit.targetPointId, exit.condition);
                }}
                className={`absolute z-20 inline-flex min-h-[40px] cursor-pointer items-center gap-2 border px-3.5 py-2 text-xs font-semibold whitespace-nowrap shadow-lg backdrop-blur-xs transition-colors hover:bg-slate-900 ${positionClass}`}
                style={{
                  backgroundColor: 'var(--hud-overlay)',
                  borderColor: 'var(--hud-border)',
                  color: 'var(--hud-text)',
                  borderRadius: 'var(--radius-control)',
                }}
              >
                <DirectionIcon direction={exit.direction} />
                <span>{exit.label}</span>
              </button>
            );
          })}

          {/* Всплывающая плашка результата действия (осмотр, подбор предмета, диалог, закрытая дверь) */}
          {notice && (
            <div
              role="status"
              onClick={(event) => event.stopPropagation()}
              className="absolute bottom-14 left-1/2 z-30 w-[min(92%,540px)] -translate-x-1/2 border p-4 shadow-xl backdrop-blur-sm"
              style={{
                backgroundColor: 'var(--hud-overlay)',
                borderColor: notice.isLocked ? 'var(--danger-primary)' : 'var(--hud-border)',
                color: 'var(--hud-text)',
                borderRadius: 'var(--radius-card)',
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs text-slate-300">{notice.subtitle}</div>
                  <div className="mt-0.5 text-base font-semibold">{notice.title}</div>
                  <p className="mt-1.5 text-sm text-slate-100">{notice.body}</p>
                </div>

                <button
                  type="button"
                  onClick={() => setNotice(null)}
                  aria-label="Закрыть сообщение"
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded hover:bg-white/10"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Интерактивная карта точек здания из content/world.json */}
      <PointMap
        isOpen={isMapOpen}
        ui={ui}
        world={world}
        currentPoint={currentPoint}
        onNavigateToPoint={(targetId) => {
          const matchingExit = currentPoint.exits.find((e) => e.targetPointId === targetId);
          tryMoveToPoint(targetId, matchingExit?.condition);
        }}
        onClose={() => setIsMapOpen(false)}
      />

      {/* Окно инвентаря (Tab) */}
      <InventoryModal
        isOpen={isInventoryOpen}
        ui={ui}
        allItems={items}
        ownedItemIds={saveState.inventory}
        onClose={() => setIsInventoryOpen(false)}
      />
    </div>
  );
}
