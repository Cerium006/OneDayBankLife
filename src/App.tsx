/**
 * Главный компонент приложения «День из жизни банка».
 * При запуске применяет тему оформления, загружает и проверяет JSON-файлы из /content,
 * читает сохранённый прогресс из localStorage и переключает экраны: «Меню» ↔ «Комната».
 */

import { useEffect, useMemo, useState } from 'react';
import { loadAndValidateContent } from './engine/contentLoader';
import {
  clearSaveState,
  createNewSaveState,
  loadSaveState,
  saveGameState,
} from './engine/storage';
import type { GameSaveState } from './engine/types';
import { resolveWorldPoint } from './engine/worldEngine';
import { applyThemeCssVariables } from './theme';
import { MainMenu } from './ui/MainMenu';
import { RoomScreen } from './ui/RoomScreen';

type ScreenMode = 'menu' | 'room';

export default function App() {
  // Применяем цвета и шрифты из src/theme.ts при первом открытии страницы
  useEffect(() => {
    applyThemeCssVariables();
  }, []);

  // Загружаем и проверяем все JSON-файлы контента (включая items.json и world.json) при старте
  const contentResult = useMemo(() => {
    try {
      return { data: loadAndValidateContent(), error: null as string | null };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Неизвестная ошибка загрузки JSON.';
      return { data: null, error: message };
    }
  }, []);

  // Читаем последнее сохранение из localStorage (если игрок уже заходил раньше)
  const [savedState, setSavedState] = useState<GameSaveState | null>(() => {
    const fallbackPointId = contentResult.data?.world.points[0]?.id ?? 'entrance';
    return loadSaveState(fallbackPointId);
  });
  const [screen, setScreen] = useState<ScreenMode>('menu');

  // Если в JSON-файлах контента обнаружена ошибка — показываем понятный экран вместо падения
  if (contentResult.error || !contentResult.data) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div
          className="max-w-lg border p-6"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--danger-primary)',
            borderRadius: 'var(--radius-card)',
          }}
        >
          <h1 className="text-lg font-semibold" style={{ color: 'var(--danger-primary)' }}>
            Не удалось загрузить файлы игры
          </h1>
          <p className="mt-2 text-sm" style={{ color: 'var(--text-primary)' }}>
            {contentResult.error}
          </p>
          <p className="mt-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
            Проверь консоль браузера (F12) — там указано, какой JSON-файл нужно исправить.
          </p>
        </div>
      </div>
    );
  }

  const content = contentResult.data;

  // Запуск новой смены: находим стартовую комнату роли, сохраняем профиль и открываем экран комнаты
  function handleStartNewGame(params: {
    nickname: string;
    roleId: string;
    difficultyId: string;
  }) {
    const chosenRole =
      content.roles.find((r) => r.id === params.roleId) ?? content.roles[0];

    const nextSave = createNewSaveState({
      nickname: params.nickname,
      roleId: params.roleId,
      difficultyId: params.difficultyId,
      startPointId: chosenRole.startPoint,
      previousSave: savedState,
    });
    saveGameState(nextSave);
    setSavedState(nextSave);
    setScreen('room');
  }

  // Продолжение сохранённой смены: открываем комнату, в которой игрок остановился
  function handleContinueGame() {
    if (!savedState) {
      return;
    }
    setScreen('room');
  }

  // Универсальное обновление состояния игры (новая комната, подобранный предмет или изменённый флаг мира)
  function handleSaveUpdate(nextSave: GameSaveState) {
    saveGameState(nextSave);
    setSavedState(nextSave);
  }

  // Полный сброс прогресса из localStorage
  function handleResetProgress() {
    clearSaveState();
    setSavedState(null);
  }

  // Если открыта игровая комната — передаём в неё предметы, мир и обработчик сохранения
  if (screen === 'room' && savedState) {
    const activeRole =
      content.roles.find((r) => r.id === savedState.activeRoleId) ?? content.roles[0];
    const activeDifficulty =
      content.difficulty.profiles.find((p) => p.id === savedState.difficultyId) ??
      content.difficulty.profiles[0];
    const currentPoint = resolveWorldPoint(content.world, savedState.currentPointId);

    return (
      <RoomScreen
        ui={content.ui}
        world={content.world}
        items={content.items}
        currentPoint={currentPoint}
        saveState={savedState}
        role={activeRole}
        difficulty={activeDifficulty}
        onSaveUpdate={handleSaveUpdate}
        onBackToMenu={() => setScreen('menu')}
      />
    );
  }

  return (
    <MainMenu
      ui={content.ui}
      roles={content.roles}
      difficulty={content.difficulty}
      savedState={savedState}
      onStartNewGame={handleStartNewGame}
      onContinueGame={handleContinueGame}
      onResetProgress={handleResetProgress}
    />
  );
}
