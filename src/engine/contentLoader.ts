/**
 * Загрузчик и проверщик (валидатор) контента из папки /content.
 * Проверяет ui.json, difficulty.json, items.json, роли в /content/roles/*.json и world.json.
 * Если в файлах указан несуществующий id комнаты, NPC, предмета или квеста, выводит понятную ошибку.
 */

import difficultyRaw from '../../content/difficulty.json';
import dialogsRaw from '../../content/dialogs.json';
import itemsRaw from '../../content/items.json';
import miniGamesRaw from '../../content/minigames.json';
import tutorialRaw from '../../content/tutorial.json';
import uiRaw from '../../content/ui.json';
import worldRaw from '../../content/world.json';
import type {
  DayEventDef,
  DialogChoice,
  DialogDefinition,
  DialogNode,
  DialogsConfig,
  DifficultyConfig,
  DifficultyProfile,
  ExitDirection,
  HotspotAction,
  HotspotKind,
  InteractableType,
  ItemDefinition,
  LoadedGameContent,
  MiniGameDef,
  MiniGameOption,
  MiniGamesConfig,
  QuestDef,
  ReportRule,
  RoleConfig,
  RoleMetricDef,
  RoleReportConfig,
  TutorialConfig,
  TutorialStep,
  TutorialStepIcon,
  UiTexts,
  WorldConfig,
  WorldExit,
  WorldHotspot,
  WorldLayer,
  WorldNpc,
  WorldPoint,
} from './types';

// Автоматически находим все JSON-файлы ролей в папке /content/roles
const roleModules = import.meta.glob<{ default: unknown }>('/content/roles/*.json', {
  eager: true,
});

function assertNonEmptyString(value: unknown, fieldPath: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Ошибка контента: поле "${fieldPath}" должно быть непустой строкой.`);
  }
  return value;
}

function assertPercentNumber(value: unknown, fieldPath: string): number {
  if (typeof value !== 'number' || Number.isNaN(value) || value < 0 || value > 100) {
    throw new Error(`Ошибка контента: поле "${fieldPath}" должно быть числом от 0 до 100 (проценты).`);
  }
  return value;
}

function validateItems(raw: unknown): { items: ItemDefinition[]; itemIds: Set<string> } {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('Ошибка в content/items.json: файл должен содержать JSON-объект.');
  }
  const data = raw as Record<string, unknown>;
  if (!Array.isArray(data.items)) {
    throw new Error('Ошибка в content/items.json: поле items должно быть массивом.');
  }

  const itemIds = new Set<string>();
  const items: ItemDefinition[] = data.items.map((rawItem, index) => {
    if (typeof rawItem !== 'object' || rawItem === null) {
      throw new Error(`Ошибка в content/items.json: предмет #${index + 1} должен быть объектом.`);
    }
    const item = rawItem as Record<string, unknown>;
    const id = assertNonEmptyString(item.id, `items[${index}].id`);
    if (itemIds.has(id)) {
      throw new Error(`Ошибка в content/items.json: повторяющийся id предмета "${id}".`);
    }
    itemIds.add(id);

    return {
      id,
      name: assertNonEmptyString(item.name, `items[${id}].name`),
      description: assertNonEmptyString(item.description, `items[${id}].description`),
      image: typeof item.image === 'string' && item.image.trim().length > 0 ? item.image : undefined,
    };
  });

  return { items, itemIds };
}

function validateDialogs(
  raw: unknown,
  validItemIds: Set<string>,
): { dialogs: DialogsConfig; dialogIds: Set<string> } {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('Ошибка в content/dialogs.json: файл должен содержать JSON-объект.');
  }
  const data = raw as Record<string, unknown>;
  if (!Array.isArray(data.dialogs)) {
    throw new Error('Ошибка в content/dialogs.json: поле dialogs должно быть массивом.');
  }

  const dialogIds = new Set<string>();
  const dialogs: DialogDefinition[] = data.dialogs.map((rawDialog, dIdx) => {
    const d = rawDialog as Record<string, unknown>;
    const id = assertNonEmptyString(d.id, `dialogs[${dIdx}].id`);
    if (dialogIds.has(id)) {
      throw new Error(`Ошибка в content/dialogs.json: дублируется id диалога "${id}".`);
    }
    dialogIds.add(id);

    const startNodeId = assertNonEmptyString(d.startNodeId, `dialogs[${id}].startNodeId`);
    if (typeof d.nodes !== 'object' || d.nodes === null) {
      throw new Error(`Ошибка в content/dialogs.json: у диалога "${id}" отсутствует объект nodes.`);
    }

    const rawNodes = d.nodes as Record<string, unknown>;
    const nodes: Record<string, DialogNode> = {};
    for (const [nodeKey, rawNode] of Object.entries(rawNodes)) {
      const n = rawNode as Record<string, unknown>;
      const choices: DialogChoice[] = Array.isArray(n.choices)
        ? n.choices.map((rawChoice, cIdx) => {
            const c = rawChoice as Record<string, unknown>;
            const giveItemId = typeof c.giveItemId === 'string' ? c.giveItemId : undefined;
            const requireItemId = typeof c.requireItemId === 'string' ? c.requireItemId : undefined;
            if (giveItemId && !validItemIds.has(giveItemId)) {
              throw new Error(
                `Ошибка в content/dialogs.json: диалог "${id}" -> "${nodeKey}" выдаёт несуществующий предмет "${giveItemId}".`,
              );
            }
            if (requireItemId && !validItemIds.has(requireItemId)) {
              throw new Error(
                `Ошибка в content/dialogs.json: диалог "${id}" -> "${nodeKey}" требует несуществующий предмет "${requireItemId}".`,
              );
            }
            return {
              id: assertNonEmptyString(c.id, `dialogs[${id}].nodes[${nodeKey}].choices[${cIdx}].id`),
              text: assertNonEmptyString(
                c.text,
                `dialogs[${id}].nodes[${nodeKey}].choices[${cIdx}].text`,
              ),
              nextNodeId: typeof c.nextNodeId === 'string' ? c.nextNodeId : undefined,
              requireFlags: c.requireFlags as DialogChoice['requireFlags'],
              requireItemId,
              giveItemId,
              setFlags: c.setFlags as DialogChoice['setFlags'],
              metricChanges: c.metricChanges as DialogChoice['metricChanges'],
              feedbackText: typeof c.feedbackText === 'string' ? c.feedbackText : undefined,
            };
          })
        : [];

      nodes[nodeKey] = {
        id: assertNonEmptyString(n.id, `dialogs[${id}].nodes[${nodeKey}].id`),
        text: assertNonEmptyString(n.text, `dialogs[${id}].nodes[${nodeKey}].text`),
        choices,
      };
    }

    if (!nodes[startNodeId]) {
      throw new Error(
        `Ошибка в content/dialogs.json: у диалога "${id}" стартовый узел "${startNodeId}" не найден в nodes.`,
      );
    }

    for (const node of Object.values(nodes)) {
      for (const choice of node.choices) {
        if (choice.nextNodeId && choice.nextNodeId !== 'END' && !nodes[choice.nextNodeId]) {
          throw new Error(
            `Ошибка в content/dialogs.json: ответ "${choice.id}" в "${id}" ведёт на несуществующий узел "${choice.nextNodeId}".`,
          );
        }
      }
    }

    return {
      id,
      npcId: typeof d.npcId === 'string' ? d.npcId : undefined,
      speakerName: assertNonEmptyString(d.speakerName, `dialogs[${id}].speakerName`),
      speakerRole: assertNonEmptyString(d.speakerRole, `dialogs[${id}].speakerRole`),
      startNodeId,
      nodes,
    };
  });

  return { dialogs: { dialogs }, dialogIds };
}

function validateMiniGames(raw: unknown): {
  miniGames: MiniGamesConfig;
  miniGameIds: Set<string>;
} {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('Ошибка в content/minigames.json: файл должен содержать JSON-объект.');
  }
  const data = raw as Record<string, unknown>;
  if (!Array.isArray(data.miniGames)) {
    throw new Error('Ошибка в content/minigames.json: поле miniGames должно быть массивом.');
  }

  const miniGameIds = new Set<string>();
  const miniGames: MiniGameDef[] = data.miniGames.map((rawGame, gIdx) => {
    const g = rawGame as Record<string, unknown>;
    const id = assertNonEmptyString(g.id, `miniGames[${gIdx}].id`);
    if (miniGameIds.has(id)) {
      throw new Error(`Ошибка в content/minigames.json: дублируется id проверки "${id}".`);
    }
    miniGameIds.add(id);

    if (!Array.isArray(g.options) || g.options.length === 0) {
      throw new Error(`Ошибка в content/minigames.json: у проверки "${id}" пустой список options.`);
    }

    const options: MiniGameOption[] = g.options.map((rawOpt, oIdx) => {
      const o = rawOpt as Record<string, unknown>;
      const minDifficulty =
        o.minDifficulty === 'easy' || o.minDifficulty === 'normal' || o.minDifficulty === 'hard'
          ? o.minDifficulty
          : undefined;
      return {
        id: assertNonEmptyString(o.id, `miniGames[${id}].options[${oIdx}].id`),
        text: assertNonEmptyString(o.text, `miniGames[${id}].options[${oIdx}].text`),
        isCorrect: Boolean(o.isCorrect),
        minDifficulty,
      };
    });

    return {
      id,
      title: assertNonEmptyString(g.title, `miniGames[${id}].title`),
      subtitle: assertNonEmptyString(g.subtitle, `miniGames[${id}].subtitle`),
      instruction: assertNonEmptyString(g.instruction, `miniGames[${id}].instruction`),
      confirmButton: assertNonEmptyString(g.confirmButton, `miniGames[${id}].confirmButton`),
      successMessage: assertNonEmptyString(g.successMessage, `miniGames[${id}].successMessage`),
      mistakeMessage: assertNonEmptyString(g.mistakeMessage, `miniGames[${id}].mistakeMessage`),
      setFlagsOnComplete: g.setFlagsOnComplete as MiniGameDef['setFlagsOnComplete'],
      successMetricChanges: g.successMetricChanges as MiniGameDef['successMetricChanges'],
      mistakeMetricChanges: g.mistakeMetricChanges as MiniGameDef['mistakeMetricChanges'],
      options,
    };
  });

  return { miniGames: { miniGames }, miniGameIds };
}

function validateDifficulty(raw: unknown): DifficultyConfig {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('Ошибка в content/difficulty.json: файл должен содержать JSON-объект.');
  }

  const data = raw as Record<string, unknown>;
  const defaultDifficultyId = assertNonEmptyString(
    data.defaultDifficultyId,
    'difficulty.defaultDifficultyId',
  );

  if (!Array.isArray(data.profiles) || data.profiles.length === 0) {
    throw new Error('Ошибка в content/difficulty.json: список profiles пуст или отсутствует.');
  }

  const seenIds = new Set<string>();
  const profiles: DifficultyProfile[] = data.profiles.map((item, index) => {
    if (typeof item !== 'object' || item === null) {
      throw new Error(`Ошибка в content/difficulty.json: профиль #${index + 1} должен быть объектом.`);
    }
    const obj = item as Record<string, unknown>;
    const id = assertNonEmptyString(obj.id, `difficulty.profiles[${index}].id`);

    if (seenIds.has(id)) {
      throw new Error(`Ошибка в content/difficulty.json: повторяющийся id сложности "${id}".`);
    }
    seenIds.add(id);

    const title = assertNonEmptyString(obj.title, `difficulty.profiles[${index}].title`);
    const description = assertNonEmptyString(
      obj.description,
      `difficulty.profiles[${index}].description`,
    );

    if (typeof obj.params !== 'object' || obj.params === null) {
      throw new Error(`Ошибка в content/difficulty.json: у сложности "${id}" отсутствует блок params.`);
    }

    const params = obj.params as Record<string, unknown>;
    return {
      id,
      title,
      description,
      icon: typeof obj.icon === 'string' && obj.icon.trim().length > 0 ? obj.icon : undefined,
      params: {
        hintsMode: assertNonEmptyString(params.hintsMode, `${id}.params.hintsMode`),
        suspicionGrowthLabel: assertNonEmptyString(
          params.suspicionGrowthLabel,
          `${id}.params.suspicionGrowthLabel`,
        ),
        suspicionMultiplier:
          typeof params.suspicionMultiplier === 'number' ? params.suspicionMultiplier : 1,
        clientTimeLabel: assertNonEmptyString(
          params.clientTimeLabel,
          `${id}.params.clientTimeLabel`,
        ),
        clientTimeSeconds:
          typeof params.clientTimeSeconds === 'number' ? params.clientTimeSeconds : 0,
        objectHighlight: assertNonEmptyString(
          params.objectHighlight,
          `${id}.params.objectHighlight`,
        ),
        miniGamesDifficulty: assertNonEmptyString(
          params.miniGamesDifficulty,
          `${id}.params.miniGamesDifficulty`,
        ),
      },
    };
  });

  if (!seenIds.has(defaultDifficultyId)) {
    throw new Error(
      `Ошибка в content/difficulty.json: defaultDifficultyId "${defaultDifficultyId}" не найден среди доступных профилей.`,
    );
  }

  return { defaultDifficultyId, profiles };
}

function validateRoles(
  validPointIds: Set<string>,
  validItemIds: Set<string>,
  validDialogIds: Set<string>,
): RoleConfig[] {
  const entries = Object.entries(roleModules);
  if (entries.length === 0) {
    throw new Error('Ошибка контента: в папке /content/roles не найдено ни одного JSON-файла профессии.');
  }

  const seenRoleIds = new Set<string>();
  const roles: RoleConfig[] = entries.map(([filePath, mod]) => {
    const raw = mod.default;
    if (typeof raw !== 'object' || raw === null) {
      throw new Error(`Ошибка в файле роли ${filePath}: содержимое должно быть JSON-объектом.`);
    }

    const obj = raw as Record<string, unknown>;
    const id = assertNonEmptyString(obj.id, `${filePath} -> id`);

    if (seenRoleIds.has(id)) {
      throw new Error(`Ошибка в файле роли ${filePath}: дублирующийся id профессии "${id}".`);
    }
    seenRoleIds.add(id);

    const title = assertNonEmptyString(obj.title, `${filePath} -> title`);
    const shortSummary = assertNonEmptyString(obj.shortSummary, `${filePath} -> shortSummary`);
    const description = assertNonEmptyString(obj.description, `${filePath} -> description`);
    const durationEstimate = assertNonEmptyString(
      obj.durationEstimate,
      `${filePath} -> durationEstimate`,
    );
    const primaryMetricLabel = assertNonEmptyString(
      obj.primaryMetricLabel,
      `${filePath} -> primaryMetricLabel`,
    );
    const startPoint = assertNonEmptyString(obj.startPoint, `${filePath} -> startPoint`);

    if (!validPointIds.has(startPoint)) {
      throw new Error(
        `Ошибка в файле роли ${filePath}: стартовая комната startPoint "${startPoint}" не найдена в content/world.json.`,
      );
    }

    if (!Array.isArray(obj.metrics) || obj.metrics.length === 0) {
      throw new Error(`Ошибка в файле роли ${filePath}: список metrics должен быть непустым массивом.`);
    }

    const seenMetricIds = new Set<string>();
    const metrics: RoleMetricDef[] = obj.metrics.map((rawMetric, mIdx) => {
      const m = rawMetric as Record<string, unknown>;
      const mId = assertNonEmptyString(m.id, `${filePath} -> metrics[${mIdx}].id`);
      if (seenMetricIds.has(mId)) {
        throw new Error(`Ошибка в файле роли ${filePath}: дублируется id метрики "${mId}".`);
      }
      seenMetricIds.add(mId);

      const tone = m.tone === 'dangerUp' || m.tone === 'goodUp' ? m.tone : 'goodUp';
      return {
        id: mId,
        label: assertNonEmptyString(m.label, `${filePath} -> metrics[${mId}].label`),
        min: typeof m.min === 'number' ? m.min : 0,
        max: typeof m.max === 'number' ? m.max : 100,
        initial: typeof m.initial === 'number' ? m.initial : 0,
        tone,
        applySuspicionMultiplier: Boolean(m.applySuspicionMultiplier),
        failAt: m.failAt as RoleMetricDef['failAt'],
      };
    });

    if (!Array.isArray(obj.quests)) {
      throw new Error(`Ошибка в файле роли ${filePath}: список quests должен быть массивом.`);
    }

    const seenQuestIds = new Set<string>();
    const quests: QuestDef[] = obj.quests
      .map((rawQuest, qIdx) => {
        const q = rawQuest as Record<string, unknown>;
        const qId = assertNonEmptyString(q.id, `${filePath} -> quests[${qIdx}].id`);
        if (seenQuestIds.has(qId)) {
          throw new Error(`Ошибка в файле роли ${filePath}: дублируется id задачи "${qId}".`);
        }
        seenQuestIds.add(qId);

        const initialStatus: QuestDef['initialStatus'] =
          q.initialStatus === 'hidden' ? 'hidden' : 'active';
        return {
          id: qId,
          order: typeof q.order === 'number' ? q.order : qIdx + 1,
          title: assertNonEmptyString(q.title, `${filePath} -> quests[${qId}].title`),
          description: assertNonEmptyString(
            q.description,
            `${filePath} -> quests[${qId}].description`,
          ),
          hint: assertNonEmptyString(q.hint, `${filePath} -> quests[${qId}].hint`),
          optional: Boolean(q.optional),
          initialStatus,
          activateWhen: q.activateWhen as QuestDef['activateWhen'],
          completeWhen: q.completeWhen as QuestDef['completeWhen'],
          failWhen: q.failWhen as QuestDef['failWhen'],
        };
      })
      .sort((a, b) => a.order - b.order);

    const dayEvents: DayEventDef[] | undefined = Array.isArray(obj.dayEvents)
      ? obj.dayEvents.map((rawEvent, eIdx) => {
          const ev = rawEvent as Record<string, unknown>;
          return {
            id: assertNonEmptyString(ev.id, `${filePath} -> dayEvents[${eIdx}].id`),
            triggerMinute: typeof ev.triggerMinute === 'number' ? ev.triggerMinute : 10,
            requireFlags: ev.requireFlags as DayEventDef['requireFlags'],
            setFlags: ev.setFlags as DayEventDef['setFlags'],
            metricChanges: ev.metricChanges as DayEventDef['metricChanges'],
            notificationTitle: assertNonEmptyString(
              ev.notificationTitle,
              `${filePath} -> dayEvents[${eIdx}].notificationTitle`,
            ),
            notificationText: assertNonEmptyString(
              ev.notificationText,
              `${filePath} -> dayEvents[${eIdx}].notificationText`,
            ),
          };
        })
      : undefined;

    const introDialogId = typeof obj.introDialogId === 'string' ? obj.introDialogId : undefined;
    if (introDialogId && !validDialogIds.has(introDialogId)) {
      throw new Error(
        `Ошибка в файле роли ${filePath}: стартовый диалог "${introDialogId}" не найден в content/dialogs.json.`,
      );
    }

    const startingItems = Array.isArray(obj.startingItems)
      ? obj.startingItems.map((item, idx) => {
          const itemId = assertNonEmptyString(item, `${filePath} -> startingItems[${idx}]`);
          if (!validItemIds.has(itemId)) {
            throw new Error(
              `Ошибка в файле роли ${filePath}: стартовый предмет "${itemId}" не найден в content/items.json.`,
            );
          }
          return itemId;
        })
      : undefined;

    let report: RoleReportConfig | undefined;
    if (obj.report !== undefined) {
      if (typeof obj.report !== 'object' || obj.report === null) {
        throw new Error(`Ошибка в файле роли ${filePath}: поле report должно быть объектом.`);
      }
      const r = obj.report as Record<string, unknown>;
      const parseRules = (rawList: unknown, label: string): ReportRule[] =>
        Array.isArray(rawList)
          ? rawList.map((item, idx) => {
              const rule = item as Record<string, unknown>;
              return {
                when: rule.when as ReportRule['when'],
                text: assertNonEmptyString(rule.text, `${filePath} -> report.${label}[${idx}].text`),
              };
            })
          : [];

      report = {
        title: assertNonEmptyString(r.title, `${filePath} -> report.title`),
        subtitle: assertNonEmptyString(r.subtitle, `${filePath} -> report.subtitle`),
        whatWorked: parseRules(r.whatWorked, 'whatWorked'),
        whatWorkedFallback: assertNonEmptyString(
          r.whatWorkedFallback,
          `${filePath} -> report.whatWorkedFallback`,
        ),
        mistakes: parseRules(r.mistakes, 'mistakes'),
        noMistakesText: assertNonEmptyString(
          r.noMistakesText,
          `${filePath} -> report.noMistakesText`,
        ),
        realWorld: assertNonEmptyString(r.realWorld, `${filePath} -> report.realWorld`),
        takeaways: Array.isArray(r.takeaways)
          ? r.takeaways.map((t, idx) =>
              assertNonEmptyString(t, `${filePath} -> report.takeaways[${idx}]`),
            )
          : [],
      };
    }

    return {
      id,
      order: typeof obj.order === 'number' ? obj.order : 99,
      title,
      icon: typeof obj.icon === 'string' && obj.icon.trim().length > 0 ? obj.icon : undefined,
      shortSummary,
      description,
      durationEstimate,
      primaryMetricLabel,
      startPoint,
      startTimeMinutes: typeof obj.startTimeMinutes === 'number' ? obj.startTimeMinutes : 540,
      introDialogId,
      introDoneFlag: typeof obj.introDoneFlag === 'string' ? obj.introDoneFlag : undefined,
      startingItems,
      metrics,
      quests,
      dayEvents,
      report,
    };
  });

  return roles.sort((a, b) => a.order - b.order);
}

function validateWorld(
  raw: unknown,
  validItemIds: Set<string>,
  validDialogIds: Set<string>,
  validMiniGameIds: Set<string>,
): { world: WorldConfig; pointIds: Set<string> } {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('Ошибка в content/world.json: файл должен содержать JSON-объект.');
  }

  const data = raw as Record<string, unknown>;

  if (!Array.isArray(data.points) || data.points.length === 0) {
    throw new Error('Ошибка в content/world.json: список points пуст или отсутствует.');
  }

  if (!Array.isArray(data.npcs)) {
    throw new Error('Ошибка в content/world.json: список npcs должен быть массивом.');
  }

  const validKinds = new Set<HotspotKind>(['object', 'npc', 'door']);
  const validDirections = new Set<ExitDirection>(['left', 'right', 'up', 'down']);
  const validInteractTypes = new Set<InteractableType>(['inspect', 'pickup', 'use', 'talk']);

  const pointIds = new Set<string>();
  const points: WorldPoint[] = data.points.map((rawPoint, index) => {
    if (typeof rawPoint !== 'object' || rawPoint === null) {
      throw new Error(`Ошибка в content/world.json: точка #${index + 1} должна быть объектом.`);
    }
    const p = rawPoint as Record<string, unknown>;
    const id = assertNonEmptyString(p.id, `world.points[${index}].id`);
    if (pointIds.has(id)) {
      throw new Error(`Ошибка в content/world.json: повторяющийся id точки "${id}".`);
    }
    pointIds.add(id);

    const title = assertNonEmptyString(p.title, `world.points[${id}].title`);
    const subtitle = assertNonEmptyString(p.subtitle, `world.points[${id}].subtitle`);
    const background = assertNonEmptyString(p.background, `world.points[${id}].background`);

    if (typeof p.mapCoords !== 'object' || p.mapCoords === null) {
      throw new Error(`Ошибка в content/world.json: у точки "${id}" отсутствуют координаты mapCoords.`);
    }
    const coords = p.mapCoords as Record<string, unknown>;
    const mapCoords = {
      x: assertPercentNumber(coords.x, `world.points[${id}].mapCoords.x`),
      y: assertPercentNumber(coords.y, `world.points[${id}].mapCoords.y`),
    };

    const exits: WorldExit[] = Array.isArray(p.exits)
      ? p.exits.map((rawExit, exitIdx) => {
          const e = rawExit as Record<string, unknown>;
          const direction = assertNonEmptyString(
            e.direction,
            `world.points[${id}].exits[${exitIdx}].direction`,
          ) as ExitDirection;
          if (!validDirections.has(direction)) {
            throw new Error(
              `Ошибка в content/world.json: неверное направление выхода "${direction}" в точке "${id}".`,
            );
          }
          return {
            direction,
            targetPointId: assertNonEmptyString(
              e.targetPointId,
              `world.points[${id}].exits[${exitIdx}].targetPointId`,
            ),
            label: assertNonEmptyString(e.label, `world.points[${id}].exits[${exitIdx}].label`),
            condition: e.condition as WorldExit['condition'],
          };
        })
      : [];

    const layers: WorldLayer[] | undefined = Array.isArray(p.layers)
      ? p.layers.map((rawLayer, layerIdx) => {
          const l = rawLayer as Record<string, unknown>;
          return {
            id: assertNonEmptyString(l.id, `world.points[${id}].layers[${layerIdx}].id`),
            image: assertNonEmptyString(l.image, `world.points[${id}].layers[${layerIdx}].image`),
            x: assertPercentNumber(l.x, `world.points[${id}].layers[${layerIdx}].x`),
            y: assertPercentNumber(l.y, `world.points[${id}].layers[${layerIdx}].y`),
            width: assertPercentNumber(l.width, `world.points[${id}].layers[${layerIdx}].width`),
            height: assertPercentNumber(l.height, `world.points[${id}].layers[${layerIdx}].height`),
            visibleWhen: l.visibleWhen as WorldLayer['visibleWhen'],
          };
        })
      : undefined;

    const hotspots: WorldHotspot[] = Array.isArray(p.hotspots)
      ? p.hotspots.map((rawHs, hsIdx) => {
          const h = rawHs as Record<string, unknown>;
          const hsId = assertNonEmptyString(h.id, `world.points[${id}].hotspots[${hsIdx}].id`);
          const kind = assertNonEmptyString(
            h.kind,
            `world.points[${id}].hotspots[${hsId}].kind`,
          ) as HotspotKind;
          if (!validKinds.has(kind)) {
            throw new Error(
              `Ошибка в content/world.json: неизвестный тип зоны "${kind}" у "${hsId}".`,
            );
          }

          let interactType: InteractableType | undefined;
          if (h.interactType !== undefined) {
            interactType = assertNonEmptyString(
              h.interactType,
              `world.points[${id}].hotspots[${hsId}].interactType`,
            ) as InteractableType;
            if (!validInteractTypes.has(interactType)) {
              throw new Error(
                `Ошибка в content/world.json: неизвестный тип взаимодействия "${interactType}" у "${hsId}".`,
              );
            }
          }

          const actions: HotspotAction[] | undefined = Array.isArray(h.actions)
            ? h.actions.map((rawAct, actIdx) => {
                const a = rawAct as Record<string, unknown>;
                const actionType = assertNonEmptyString(
                  a.type,
                  `world.points[${id}].hotspots[${hsId}].actions[${actIdx}].type`,
                ) as InteractableType;
                if (!validInteractTypes.has(actionType)) {
                  throw new Error(
                    `Ошибка в content/world.json: неизвестный тип действия "${actionType}" у "${hsId}".`,
                  );
                }
                return {
                  type: actionType,
                  label: typeof a.label === 'string' ? a.label : undefined,
                  resultText: assertNonEmptyString(
                    a.resultText,
                    `world.points[${id}].hotspots[${hsId}].actions[${actIdx}].resultText`,
                  ),
                  giveItemId: typeof a.giveItemId === 'string' ? a.giveItemId : undefined,
                  requireItemId: typeof a.requireItemId === 'string' ? a.requireItemId : undefined,
                  requireFlags: a.requireFlags as HotspotAction['requireFlags'],
                  lockedText: typeof a.lockedText === 'string' ? a.lockedText : undefined,
                  setFlags: a.setFlags as HotspotAction['setFlags'],
                  metricChanges: a.metricChanges as HotspotAction['metricChanges'],
                  targetPointId: typeof a.targetPointId === 'string' ? a.targetPointId : undefined,
                  dialogId: typeof a.dialogId === 'string' ? a.dialogId : undefined,
                  miniGameId: typeof a.miniGameId === 'string' ? a.miniGameId : undefined,
                };
              })
            : undefined;

          return {
            id: hsId,
            label: assertNonEmptyString(h.label, `world.points[${id}].hotspots[${hsId}].label`),
            kind,
            interactType,
            x: assertPercentNumber(h.x, `world.points[${id}].hotspots[${hsId}].x`),
            y: assertPercentNumber(h.y, `world.points[${id}].hotspots[${hsId}].y`),
            width: assertPercentNumber(h.width, `world.points[${id}].hotspots[${hsId}].width`),
            height: assertPercentNumber(h.height, `world.points[${id}].hotspots[${hsId}].height`),
            description: typeof h.description === 'string' ? h.description : undefined,
            npcId: typeof h.npcId === 'string' ? h.npcId : undefined,
            hideAvatarInRoom:
              typeof h.hideAvatarInRoom === 'boolean' ? h.hideAvatarInRoom : undefined,
            targetPointId: typeof h.targetPointId === 'string' ? h.targetPointId : undefined,
            visibleWhen: h.visibleWhen as WorldHotspot['visibleWhen'],
            hideIfHasItem: typeof h.hideIfHasItem === 'string' ? h.hideIfHasItem : undefined,
            condition: h.condition as WorldHotspot['condition'],
            actions,
          };
        })
      : [];

    return { id, title, subtitle, background, mapCoords, exits, layers, hotspots };
  });

  const npcIds = new Set<string>();
  const npcs: WorldNpc[] = data.npcs.map((rawNpc, index) => {
    const n = rawNpc as Record<string, unknown>;
    const id = assertNonEmptyString(n.id, `world.npcs[${index}].id`);
    if (npcIds.has(id)) {
      throw new Error(`Ошибка в content/world.json: повторяющийся id персонажа "${id}".`);
    }
    npcIds.add(id);

    const pointId = assertNonEmptyString(n.pointId, `world.npcs[${id}].pointId`);
    if (!pointIds.has(pointId)) {
      throw new Error(
        `Ошибка в content/world.json: персонаж "${id}" привязан к несуществующей точке "${pointId}".`,
      );
    }

    return {
      id,
      name: assertNonEmptyString(n.name, `world.npcs[${id}].name`),
      roleTitle: assertNonEmptyString(n.roleTitle, `world.npcs[${id}].roleTitle`),
      pointId,
      description: assertNonEmptyString(n.description, `world.npcs[${id}].description`),
      avatar: typeof n.avatar === 'string' && n.avatar.trim().length > 0 ? n.avatar : undefined,
    };
  });

  for (const point of points) {
    for (const exit of point.exits) {
      if (!pointIds.has(exit.targetPointId)) {
        throw new Error(
          `Ошибка в content/world.json: выход из "${point.id}" ведёт в несуществующую точку "${exit.targetPointId}".`,
        );
      }
      if (exit.condition?.requiredItem && !validItemIds.has(exit.condition.requiredItem)) {
        throw new Error(
          `Ошибка в content/world.json: выход из "${point.id}" требует несуществующий предмет "${exit.condition.requiredItem}".`,
        );
      }
    }

    for (const hs of point.hotspots) {
      if (hs.kind === 'door' && (!hs.targetPointId || !pointIds.has(hs.targetPointId))) {
        throw new Error(
          `Ошибка в content/world.json: дверь "${hs.id}" в точке "${point.id}" ссылается на несуществующую точку "${hs.targetPointId ?? ''}".`,
        );
      }
      if (hs.kind === 'npc' && (!hs.npcId || !npcIds.has(hs.npcId))) {
        throw new Error(
          `Ошибка в content/world.json: зона "${hs.id}" в точке "${point.id}" ссылается на несуществующего персонажа "${hs.npcId ?? ''}".`,
        );
      }
      if (hs.hideIfHasItem && !validItemIds.has(hs.hideIfHasItem)) {
        throw new Error(
          `Ошибка в content/world.json: зона "${hs.id}" проверяет несуществующий предмет "${hs.hideIfHasItem}".`,
        );
      }
      if (hs.condition?.requiredItem && !validItemIds.has(hs.condition.requiredItem)) {
        throw new Error(
          `Ошибка в content/world.json: зона "${hs.id}" требует несуществующий предмет "${hs.condition.requiredItem}".`,
        );
      }
      for (const act of hs.actions ?? []) {
        if (act.giveItemId && !validItemIds.has(act.giveItemId)) {
          throw new Error(
            `Ошибка в content/world.json: действие в "${hs.id}" выдаёт несуществующий предмет "${act.giveItemId}".`,
          );
        }
        if (act.requireItemId && !validItemIds.has(act.requireItemId)) {
          throw new Error(
            `Ошибка в content/world.json: действие в "${hs.id}" требует несуществующий предмет "${act.requireItemId}".`,
          );
        }
        if (act.targetPointId && !pointIds.has(act.targetPointId)) {
          throw new Error(
            `Ошибка в content/world.json: действие в "${hs.id}" ведёт в несуществующую точку "${act.targetPointId}".`,
          );
        }
        if (act.dialogId && !validDialogIds.has(act.dialogId)) {
          throw new Error(
            `Ошибка в content/world.json: действие в "${hs.id}" ссылается на несуществующий диалог "${act.dialogId}".`,
          );
        }
        if (act.miniGameId && !validMiniGameIds.has(act.miniGameId)) {
          throw new Error(
            `Ошибка в content/world.json: действие в "${hs.id}" ссылается на несуществующую мини-проверку "${act.miniGameId}".`,
          );
        }
      }
    }
  }

  return { world: { npcs, points }, pointIds };
}

function validateTutorial(raw: unknown): TutorialConfig {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('Ошибка в content/tutorial.json: файл должен содержать JSON-объект.');
  }
  const data = raw as Record<string, unknown>;
  if (!Array.isArray(data.steps) || data.steps.length === 0) {
    throw new Error('Ошибка в content/tutorial.json: список steps должен быть непустым массивом.');
  }

  const validIcons = new Set<TutorialStepIcon>(['mouse', 'map', 'briefcase', 'gauge', 'roles']);
  const seenStepIds = new Set<string>();
  const steps: TutorialStep[] = data.steps.map((rawStep, index) => {
    if (typeof rawStep !== 'object' || rawStep === null) {
      throw new Error(`Ошибка в content/tutorial.json: шаг #${index + 1} должен быть объектом.`);
    }
    const s = rawStep as Record<string, unknown>;
    const id = assertNonEmptyString(s.id, `tutorial.steps[${index}].id`);
    if (seenStepIds.has(id)) {
      throw new Error(`Ошибка в content/tutorial.json: повторяющийся id шага "${id}".`);
    }
    seenStepIds.add(id);

    const rawIcon = typeof s.icon === 'string' ? (s.icon as TutorialStepIcon) : 'mouse';
    const icon: TutorialStepIcon = validIcons.has(rawIcon) ? rawIcon : 'mouse';

    return {
      id,
      icon,
      title: assertNonEmptyString(s.title, `tutorial.steps[${id}].title`),
      description: assertNonEmptyString(s.description, `tutorial.steps[${id}].description`),
      tip: typeof s.tip === 'string' && s.tip.trim().length > 0 ? s.tip : undefined,
    };
  });

  return {
    title: assertNonEmptyString(data.title, 'tutorial.title'),
    subtitle: assertNonEmptyString(data.subtitle, 'tutorial.subtitle'),
    prevButton: assertNonEmptyString(data.prevButton, 'tutorial.prevButton'),
    nextButton: assertNonEmptyString(data.nextButton, 'tutorial.nextButton'),
    finishButton: assertNonEmptyString(data.finishButton, 'tutorial.finishButton'),
    skipButton: assertNonEmptyString(data.skipButton, 'tutorial.skipButton'),
    stepCounterLabel: assertNonEmptyString(data.stepCounterLabel, 'tutorial.stepCounterLabel'),
    steps,
  };
}

function validateUi(raw: unknown): UiTexts {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('Ошибка в content/ui.json: файл должен содержать JSON-объект.');
  }
  const data = raw as UiTexts;
  assertNonEmptyString(data.appTitle, 'ui.appTitle');
  assertNonEmptyString(data.menu?.startButton, 'ui.menu.startButton');
  assertNonEmptyString(data.menu?.tutorialButton, 'ui.menu.tutorialButton');
  assertNonEmptyString(data.room?.tutorialButton, 'ui.room.tutorialButton');
  assertNonEmptyString(data.room?.mapButton, 'ui.room.mapButton');
  assertNonEmptyString(data.room?.inventoryButton, 'ui.room.inventoryButton');
  assertNonEmptyString(data.room?.tasksButton, 'ui.room.tasksButton');
  return data;
}

/**
 * Загружает и проверяет весь игровой контент при старте.
 * Если в JSON найдена ошибка, выводит понятное сообщение в консоль разработчика.
 */
export function loadAndValidateContent(): LoadedGameContent {
  try {
    const ui = validateUi(uiRaw);
    const difficulty = validateDifficulty(difficultyRaw);
    const { items, itemIds } = validateItems(itemsRaw);
    const { dialogs, dialogIds } = validateDialogs(dialogsRaw, itemIds);
    const { miniGames, miniGameIds } = validateMiniGames(miniGamesRaw);
    const { world, pointIds } = validateWorld(worldRaw, itemIds, dialogIds, miniGameIds);
    const roles = validateRoles(pointIds, itemIds, dialogIds);
    const tutorial = validateTutorial(tutorialRaw);

    return { ui, difficulty, roles, items, world, dialogs, miniGames, tutorial };
  } catch (error) {
    console.error('[Проверка контента JSON]', error);
    throw error;
  }
}
