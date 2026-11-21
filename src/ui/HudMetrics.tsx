/**
 * Компактная панель метрик и времени рабочего дня для верхней полосы HUD.
 * Отображает игровые часы (ЧЧ:ММ) и все шкалы профессии из файла роли (подозрение, доверие, безопасность).
 */

import { Clock } from 'lucide-react';
import { formatShiftTime } from '../engine/questEngine';
import type { RoleConfig, RoleMetricDef, UiTexts } from '../engine/types';

interface HudMetricsProps {
  ui: UiTexts;
  role: RoleConfig;
  metrics: Record<string, number>;
  elapsedGameMinutes: number;
}

/** Выбирает цвет заливки шкалы в зависимости от типа метрики (растущая опасность или запас прочности) */
function getMetricBarColor(def: RoleMetricDef, value: number): string {
  const ratio = (value - def.min) / Math.max(1, def.max - def.min);

  if (def.tone === 'dangerUp') {
    if (ratio >= 0.75) {
      return 'var(--danger-primary)';
    }
    if (ratio >= 0.4) {
      return 'var(--warning-primary)';
    }
    return 'var(--accent-primary)';
  }

  if (ratio <= 0.3) {
    return 'var(--danger-primary)';
  }
  if (ratio <= 0.55) {
    return 'var(--warning-primary)';
  }
  return 'var(--success-primary)';
}

export function HudMetrics({ ui, role, metrics, elapsedGameMinutes }: HudMetricsProps) {
  const timeText = formatShiftTime(role.startTimeMinutes, elapsedGameMinutes);

  return (
    <div className="flex flex-wrap items-center gap-4">
      {/* Игровые часы рабочей смены */}
      <div
        className="flex items-center gap-1.5 border px-2.5 py-1 text-xs font-semibold tabular-nums"
        style={{
          borderColor: 'var(--hud-border)',
          borderRadius: 'var(--radius-control)',
          color: 'var(--hud-text)',
        }}
        title={ui.room.hudTimeLabel}
      >
        <Clock
          className="h-3.5 w-3.5"
          style={{ color: 'var(--text-secondary)' }}
          aria-hidden="true"
        />
        <span>{timeText}</span>
      </div>

      {/* Полосы метрик выбранной профессии */}
      <div className="flex flex-wrap items-center gap-3.5">
        {role.metrics.map((def) => {
          const rawValue = typeof metrics[def.id] === 'number' ? metrics[def.id] : def.initial;
          const clamped = Math.max(def.min, Math.min(def.max, rawValue));
          const percent = Math.round(((clamped - def.min) / Math.max(1, def.max - def.min)) * 100);
          const barColor = getMetricBarColor(def, clamped);

          return (
            <div key={def.id} className="min-w-[132px]">
              <div className="flex items-baseline justify-between gap-2 text-xs">
                <span style={{ color: 'var(--text-secondary)' }}>{def.label}</span>
                <span className="font-semibold tabular-nums" style={{ color: 'var(--hud-text)' }}>
                  {clamped}%
                </span>
              </div>
              <div
                role="progressbar"
                aria-label={def.label}
                aria-valuemin={def.min}
                aria-valuemax={def.max}
                aria-valuenow={clamped}
                className="mt-1 h-2 w-full overflow-hidden rounded-sm bg-white/15"
              >
                <div
                  className="h-full transition-all duration-300"
                  style={{
                    width: `${percent}%`,
                    backgroundColor: barColor,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
