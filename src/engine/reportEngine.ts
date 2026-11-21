/**
 * Генератор качественного итогового отчёта в конце смены (Шаг 6).
 * Работает без чисел и рейтингов — собирает выводы «Что получилось», «Где ошибка»,
 * «Как в реальной работе» и «Чему вы научились» из конфигурации роли и флагов worldState.
 */

import type { RoleConfig, WorldState } from './types';
import { matchesFlags } from './worldFlags';

export interface BuiltShiftReport {
  title: string;
  subtitle: string;
  whatWorkedItems: string[];
  mistakeItems: string[];
  hasMistakes: boolean;
  noMistakesText: string;
  realWorld: string;
  takeaways: string[];
}

export function buildShiftReport(role: RoleConfig, worldState: WorldState): BuiltShiftReport {
  const cfg = role.report;
  if (!cfg) {
    return {
      title: role.title,
      subtitle: role.shortSummary,
      whatWorkedItems: ['Вы выполнили ключевые задачи смены.'],
      mistakeItems: [],
      hasMistakes: false,
      noMistakesText: 'Смена завершена без критических ошибок.',
      realWorld: role.description,
      takeaways: [],
    };
  }

  const whatWorkedItems = cfg.whatWorked
    .filter((rule) => matchesFlags(rule.when, worldState))
    .map((rule) => rule.text);

  if (whatWorkedItems.length === 0 && cfg.whatWorkedFallback) {
    whatWorkedItems.push(cfg.whatWorkedFallback);
  }

  const mistakeItems = cfg.mistakes
    .filter((rule) => matchesFlags(rule.when, worldState))
    .map((rule) => rule.text);

  return {
    title: cfg.title,
    subtitle: cfg.subtitle,
    whatWorkedItems,
    mistakeItems,
    hasMistakes: mistakeItems.length > 0,
    noMistakesText: cfg.noMistakesText,
    realWorld: cfg.realWorld,
    takeaways: cfg.takeaways,
  };
}
