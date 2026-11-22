/**
 * Компактная панель метрик и времени рабочего дня для верхней полосы HUD.
 * Отображает игровые часы (ЧЧ:ММ) и все шкалы профессии из файла роли
 * с текстовым состоянием (не только цветом) для удобства и доступности.
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

function getMetricVisual(
  def: RoleMetricDef,
  value: number,
  labels: UiTexts['room']['metricStatusLabels'],
): { barColor: string; stateText: string; textColor: string } {
  const ratio = (value - def.min) / Math.max(1, def.max - def.min);

  if (def.tone === 'dangerUp') {
    if (ratio >= 0.75) {
      return { barColor: 'var(--danger-primary)', stateText: labels.critical, textColor: 'var(--danger-text)' };
    }
    if (ratio >= 0.4) {
      return { barColor: 'var(--warning-primary)', stateText: labels.warning, textColor: 'var(--warning-primary)' };
    }
    return { barColor: 'var(--accent-primary)', stateText: labels.safe, textColor: 'var(--success-text)' };
  }

  if (ratio <= 0.3) {
    return { barColor: 'var(--danger-primary)', stateText: labels.critical, textColor: 'var(--danger-text)' };
  }
  if (ratio <= 0.55) {
    return { barColor: 'var(--warning-primary)', stateText: labels.warning, textColor: 'var(--warning-primary)' };
  }
  return { barColor: 'var(--success-primary)', stateText: labels.safe, textColor: 'var(--success-text)' };
}

export function HudMetrics({ ui, role, metrics, elapsedGameMinutes }: HudMetricsProps) {
  const timeText = formatShiftTime(role.startTimeMinutes, elapsedGameMinutes);

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Игровые часы рабочей смены */}
      <div
        className="flex items-center gap-1.5 border px-2.5 py-1 text-xs font-semibold tabular-nums"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--hud-border)',
          borderRadius: 'var(--radius-control)',
          color: 'var(--hud-text)',
        }}
        title={ui.room.hudTimeLabel}
      >
        <Clock
          className="h-3.5 w-3.5"
          style={{ color: 'var(--accent-lime)' }}
          aria-hidden="true"
        />
        <span>{timeText}</span>
      </div>

      {/* Полосы метрик выбранной профессии */}
      <div className="flex flex-wrap items-center gap-3">
        {role.metrics.map((def) => {
          const rawValue = typeof metrics[def.id] === 'number' ? metrics[def.id] : def.initial;
          const clamped = Math.max(def.min, Math.min(def.max, rawValue));
          const percent = Math.round(((clamped - def.min) / Math.max(1, def.max - def.min)) * 100);
          const visual = getMetricVisual(def, clamped, ui.room.metricStatusLabels);

          return (
            <div key={def.id} className="min-w-[136px]">
              <div className="flex items-baseline justify-between gap-2 text-xs">
                <span style={{ color: 'var(--text-secondary)' }}>{def.label}</span>
                <span className="font-semibold tabular-nums" style={{ color: 'var(--hud-text)' }}>
                  <span style={{ color: visual.textColor }}>{visual.stateText}</span>
                  <span aria-hidden="true"> · </span>
                  <span>{clamped}%</span>
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
                    backgroundColor: visual.barColor,
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
