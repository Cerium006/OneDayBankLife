/**
 * Загрузчик и проверщик (валидатор) контента из папки /content.
 * Проверяет ui.json, difficulty.json, items.json, роли в /content/roles/*.json и world.json.
 * Если в файлах указан несуществующий id комнаты, NPC или предмета, выводит понятную ошибку в консоль.
 */

import difficultyRaw from '../../content/difficulty.json';
import itemsRaw from '../../content/items.json';
import uiRaw from '../../content/ui.json';
import worldRaw from '../../content/world.json';
import type {
  DifficultyConfig,
  DifficultyProfile,
  ExitDirection,
  HotspotAction,
  HotspotKind,
  InteractableType,
  ItemDefinition,
  LoadedGameContent,
  RoleConfig,
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
    };
  });

  return { items, itemIds };
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

function validateRoles(validPointIds: Set<string>): RoleConfig[] {
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

    const initialMetrics: Record<string, number> = {};
    if (obj.initialMetrics && typeof obj.initialMetrics === 'object') {
      for (const [metricKey, metricVal] of Object.entries(
        obj.initialMetrics as Record<string, unknown>,
      )) {
        if (typeof metricVal === 'number') {
          initialMetrics[metricKey] = metricVal;
        }
      }
    }

    return {
      id,
      order: typeof obj.order === 'number' ? obj.order : 99,
      title,
      shortSummary,
      description,
      durationEstimate,
      primaryMetricLabel,
      startPoint,
      initialMetrics,
    };
  });

  return roles.sort((a, b) => a.order - b.order);
}

function validateWorld(
  raw: unknown,
  validItemIds: Set<string>,
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
                  lockedText: typeof a.lockedText === 'string' ? a.lockedText : undefined,
                  setFlags: a.setFlags as HotspotAction['setFlags'],
                  targetPointId: typeof a.targetPointId === 'string' ? a.targetPointId : undefined,
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
    };
  });

  // Перекрёстная проверка всех ссылок: комнаты, персонажи и предметы из items.json
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
      }
    }
  }

  return { world: { npcs, points }, pointIds };
}

function validateUi(raw: unknown): UiTexts {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('Ошибка в content/ui.json: файл должен содержать JSON-объект.');
  }
  const data = raw as UiTexts;
  assertNonEmptyString(data.appTitle, 'ui.appTitle');
  assertNonEmptyString(data.menu?.startButton, 'ui.menu.startButton');
  assertNonEmptyString(data.room?.mapButton, 'ui.room.mapButton');
  assertNonEmptyString(data.room?.inventoryButton, 'ui.room.inventoryButton');
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
    const { world, pointIds } = validateWorld(worldRaw, itemIds);
    const roles = validateRoles(pointIds);

    return { ui, difficulty, roles, items, world };
  } catch (error) {
    console.error('[Проверка контента JSON]', error);
    throw error;
  }
}
