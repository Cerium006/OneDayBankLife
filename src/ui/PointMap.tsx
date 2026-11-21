/**
 * Интерактивная карта точек здания банка, построенная целиком по данным из content/world.json.
 * Показывает все комнаты, связи (переходы) между ними и текущее положение игрока.
 * Соседние комнаты можно открывать прямо кликом по узлу на карте.
 */

import { MapPin, X } from 'lucide-react';
import { getWorldConnections } from '../engine/worldEngine';
import type { UiTexts, WorldConfig, WorldPoint } from '../engine/types';

interface PointMapProps {
  isOpen: boolean;
  ui: UiTexts;
  world: WorldConfig;
  currentPoint: WorldPoint;
  onNavigateToPoint: (targetPointId: string) => void;
  onClose: () => void;
}

export function PointMap({
  isOpen,
  ui,
  world,
  currentPoint,
  onNavigateToPoint,
  onClose,
}: PointMapProps) {
  if (!isOpen) {
    return null;
  }

  const connections = getWorldConnections(world);
  const directNeighborIds = new Set(currentPoint.exits.map((exit) => exit.targetPointId));

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="point-map-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl border p-6 shadow-2xl"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-default)',
          borderRadius: 'var(--radius-card)',
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b pb-4" style={{ borderColor: 'var(--border-default)' }}>
          <div>
            <h2
              id="point-map-title"
              className="text-xl font-semibold"
              style={{ color: 'var(--text-primary)' }}
            >
              {ui.room.mapTitle}
            </h2>
            <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
              {ui.room.mapHint}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label={ui.room.mapCloseButton}
            className="inline-flex min-h-[40px] items-center gap-1.5 border px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors hover:bg-white/10"
            style={{
              borderColor: 'var(--border-default)',
              borderRadius: 'var(--radius-control)',
              color: 'var(--text-primary)',
            }}
          >
            <X className="h-4 w-4" aria-hidden="true" />
            <span>{ui.room.mapCloseButton}</span>
          </button>
        </div>

        {/* Схема точек здания на координатной сетке 0–100% из world.json */}
        <div
          className="relative mt-5 h-[360px] w-full overflow-hidden border sm:h-[420px]"
          style={{
            backgroundColor: 'var(--bg-surface-muted)',
            borderColor: 'var(--border-default)',
            borderRadius: 'var(--radius-control)',
          }}
        >
          {/* Линии переходов между комнатами */}
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="pointer-events-none absolute inset-0 h-full w-full"
            aria-hidden="true"
          >
            {connections.map((edge) => {
              const fromPoint = world.points.find((p) => p.id === edge.fromId);
              const toPoint = world.points.find((p) => p.id === edge.toId);
              if (!fromPoint || !toPoint) {
                return null;
              }
              const touchesCurrent =
                fromPoint.id === currentPoint.id || toPoint.id === currentPoint.id;

              return (
                <line
                  key={`${edge.fromId}-${edge.toId}`}
                  x1={fromPoint.mapCoords.x}
                  y1={fromPoint.mapCoords.y}
                  x2={toPoint.mapCoords.x}
                  y2={toPoint.mapCoords.y}
                  stroke={touchesCurrent ? '#D4FA42' : '#7A867A'}
                  strokeWidth={touchesCurrent ? '1.1' : '0.7'}
                  strokeDasharray={touchesCurrent ? undefined : '2 1.5'}
                />
              );
            })}
          </svg>

          {/* Узлы-кнопки комнат */}
          {world.points.map((point) => {
            const isCurrent = point.id === currentPoint.id;
            const isNeighbor = directNeighborIds.has(point.id);

            return (
              <button
                key={point.id}
                type="button"
                disabled={!isNeighbor}
                onClick={() => {
                  if (isNeighbor) {
                    onNavigateToPoint(point.id);
                    onClose();
                  }
                }}
                title={
                  isCurrent
                    ? ui.room.mapCurrentBadge
                    : isNeighbor
                      ? ui.room.mapConnectedHint
                      : ui.room.mapFarHint
                }
                className="absolute -translate-x-1/2 -translate-y-1/2 border px-3 py-2 text-center transition-transform"
                style={{
                  left: `${point.mapCoords.x}%`,
                  top: `${point.mapCoords.y}%`,
                  minWidth: '124px',
                  maxWidth: '165px',
                  borderRadius: 'var(--radius-control)',
                  backgroundColor: isCurrent
                    ? 'var(--accent-primary)'
                    : isNeighbor
                      ? 'var(--bg-surface)'
                      : 'var(--bg-surface-muted)',
                  borderColor: isCurrent || isNeighbor ? 'var(--accent-primary)' : 'var(--border-default)',
                  color: isCurrent ? 'var(--accent-text)' : 'var(--text-primary)',
                  cursor: isNeighbor ? 'pointer' : 'default',
                  boxShadow: isNeighbor ? '0 4px 12px rgba(15, 23, 42, 0.12)' : 'none',
                }}
              >
                <div className="flex items-center justify-center gap-1 text-xs font-semibold leading-tight">
                  {isCurrent && <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
                  <span>{point.title}</span>
                </div>
                <div
                  className="mt-0.5 text-[11px]"
                  style={{
                    color: isCurrent
                      ? 'rgba(20, 26, 20, 0.85)'
                      : isNeighbor
                        ? 'var(--accent-lime)'
                        : 'var(--text-secondary)',
                  }}
                >
                  {isCurrent
                    ? ui.room.mapCurrentBadge
                    : isNeighbor
                      ? ui.room.mapConnectedHint
                      : ui.room.mapFarHint}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
