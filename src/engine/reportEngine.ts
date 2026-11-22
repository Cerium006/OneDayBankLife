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
  whatWorkedVoiceUrls: (string | undefined)[];
  mistakeItems: string[];
  mistakeVoiceUrls: (string | undefined)[];
  hasMistakes: boolean;
  noMistakesText: string;
  realWorld: string;
  realWorldVoiceUrl?: string;
  takeaways: string[];
}

export function buildShiftReport(role: RoleConfig, worldState: WorldState): BuiltShiftReport {
  const cfg = role.report;
  if (!cfg) {
    return {
      title: role.title,
      subtitle: role.shortSummary,
      whatWorkedItems: ['Вы выполнили ключевые задачи смены.'],
      whatWorkedVoiceUrls: [undefined],
      mistakeItems: [],
      mistakeVoiceUrls: [],
      hasMistakes: false,
      noMistakesText: 'Смена завершена без критических ошибок.',
      realWorld: role.description,
      takeaways: [],
    };
  }

  const matchedWorked = cfg.whatWorked.filter((rule) => matchesFlags(rule.when, worldState));
  const whatWorkedItems = matchedWorked.map((rule) => rule.text);
  const whatWorkedVoiceUrls = matchedWorked.map((rule) => rule.voiceUrl);

  if (whatWorkedItems.length === 0 && cfg.whatWorkedFallback) {
    whatWorkedItems.push(cfg.whatWorkedFallback);
    whatWorkedVoiceUrls.push(undefined);
  }

  const matchedMistakes = cfg.mistakes.filter((rule) => matchesFlags(rule.when, worldState));
  const mistakeItems = matchedMistakes.map((rule) => rule.text);
  const mistakeVoiceUrls = matchedMistakes.map((rule) => rule.voiceUrl);

  return {
    title: cfg.title,
    subtitle: cfg.subtitle,
    whatWorkedItems,
    whatWorkedVoiceUrls,
    mistakeItems,
    mistakeVoiceUrls,
    hasMistakes: mistakeItems.length > 0,
    noMistakesText: cfg.noMistakesText,
    realWorld: cfg.realWorld,
    realWorldVoiceUrl: cfg.realWorldVoiceUrl,
    takeaways: cfg.takeaways,
  };
}
