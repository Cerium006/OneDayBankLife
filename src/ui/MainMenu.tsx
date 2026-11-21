/**
 * Главное меню игры «День из жизни банка».
 * Показывает продолжение сохранённой смены (если она есть в памяти браузера)
 * и форму запуска новой игры: ввод никнейма, выбор профессии и уровня сложности.
 * Все надписи берутся из content/ui.json, а списки — из других JSON-файлов.
 */

import { useState, type FormEvent } from 'react';
import type {
  DifficultyConfig,
  GameSaveState,
  RoleConfig,
  UiTexts,
} from '../engine/types';
import { ConfirmModal } from './ConfirmModal';

interface MainMenuProps {
  ui: UiTexts;
  roles: RoleConfig[];
  difficulty: DifficultyConfig;
  savedState: GameSaveState | null;
  onStartNewGame: (params: {
    nickname: string;
    roleId: string;
    difficultyId: string;
  }) => void;
  onContinueGame: () => void;
  onResetProgress: () => void;
}

export function MainMenu({
  ui,
  roles,
  difficulty,
  savedState,
  onStartNewGame,
  onContinueGame,
  onResetProgress,
}: MainMenuProps) {
  // Подставляем сохранённый никнейм, если он уже был введён раньше, чтобы игроку не приходилось набирать заново
  const [nickname, setNickname] = useState<string>(savedState?.nickname ?? '');
  const [selectedRoleId, setSelectedRoleId] = useState<string>(
    savedState?.activeRoleId && roles.some((r) => r.id === savedState.activeRoleId)
      ? savedState.activeRoleId
      : roles[0].id,
  );
  const [selectedDifficultyId, setSelectedDifficultyId] = useState<string>(
    savedState?.difficultyId &&
      difficulty.profiles.some((p) => p.id === savedState.difficultyId)
      ? savedState.difficultyId
      : difficulty.defaultDifficultyId,
  );
  const [nicknameError, setNicknameError] = useState<string | null>(null);
  const [isResetModalOpen, setIsResetModalOpen] = useState<boolean>(false);

  // Находим человекочитаемые названия сохранённой роли и сложности для блока «Продолжить»
  const savedRoleTitle =
    roles.find((r) => r.id === savedState?.activeRoleId)?.title ?? savedState?.activeRoleId;
  const savedDifficultyTitle =
    difficulty.profiles.find((p) => p.id === savedState?.difficultyId)?.title ??
    savedState?.difficultyId;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const cleanedNickname = nickname.trim();

    if (cleanedNickname.length === 0) {
      setNicknameError(ui.menu.nicknameErrorEmpty);
      return;
    }

    if (cleanedNickname.length < 2) {
      setNicknameError(ui.menu.nicknameErrorTooShort);
      return;
    }

    setNicknameError(null);
    onStartNewGame({
      nickname: cleanedNickname,
      roleId: selectedRoleId,
      difficultyId: selectedDifficultyId,
    });
  }

  function handleConfirmReset() {
    setIsResetModalOpen(false);
    setNickname('');
    setNicknameError(null);
    onResetProgress();
  }

  return (
    <div className="min-h-screen px-4 py-8 sm:px-6 lg:px-8">
      <main className="mx-auto max-w-[1040px]">
        {/* Шапка с названием игры и коротким пояснением */}
        <header className="mb-8 border-b pb-6" style={{ borderColor: 'var(--border-default)' }}>
          <h1
            className="text-3xl font-bold tracking-tight sm:text-4xl"
            style={{ color: 'var(--text-primary)', textWrap: 'balance' }}
          >
            {ui.appTitle}
          </h1>
          <p className="mt-2 max-w-2xl text-base" style={{ color: 'var(--text-secondary)' }}>
            {ui.appSubtitle}
          </p>
        </header>

        {/* Блок продолжения игры (показывается только если в localStorage уже есть сохранение) */}
        {savedState && (
          <section
            aria-labelledby="continue-heading"
            className="mb-8 border p-6"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-default)',
              borderRadius: 'var(--radius-card)',
            }}
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2
                  id="continue-heading"
                  className="text-lg font-semibold"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {ui.menu.continueSectionTitle}
                </h2>
                <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  <span>{savedState.nickname}</span>
                  <span aria-hidden="true"> · </span>
                  <span>{savedRoleTitle}</span>
                  <span aria-hidden="true"> · </span>
                  <span>{savedDifficultyTitle}</span>
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={onContinueGame}
                  className="min-h-[42px] px-5 py-2 text-sm font-semibold whitespace-nowrap transition-colors"
                  style={{
                    backgroundColor: 'var(--accent-primary)',
                    color: 'var(--accent-text)',
                    borderRadius: 'var(--radius-control)',
                  }}
                >
                  {ui.menu.continueButton}
                </button>
                <button
                  type="button"
                  onClick={() => setIsResetModalOpen(true)}
                  className="min-h-[42px] border px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors hover:bg-red-50"
                  style={{
                    borderColor: 'var(--border-default)',
                    color: 'var(--danger-primary)',
                    borderRadius: 'var(--radius-control)',
                  }}
                >
                  {ui.menu.resetButton}
                </button>
              </div>
            </div>
          </section>
        )}

        {/* Форма новой игры: никнейм, профессия и уровень сложности */}
        <form
          onSubmit={handleSubmit}
          noValidate
          className="border p-6 sm:p-8"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--border-default)',
            borderRadius: 'var(--radius-card)',
          }}
        >
          <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
            <h2 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
              {ui.menu.newGameSectionTitle}
            </h2>
            {!savedState && (
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                {ui.menu.sharedWorldNoteTitle}
              </p>
            )}
          </div>

          {/* 1. Поле ввода никнейма (без регистрации и паролей) */}
          <div className="mb-8 max-w-md">
            <label
              htmlFor="player-nickname"
              className="block text-sm font-semibold"
              style={{ color: 'var(--text-primary)' }}
            >
              {ui.menu.nicknameLabel}
            </label>
            <input
              id="player-nickname"
              type="text"
              maxLength={24}
              value={nickname}
              onChange={(event) => {
                setNickname(event.target.value);
                if (nicknameError) {
                  setNicknameError(null);
                }
              }}
              placeholder={ui.menu.nicknamePlaceholder}
              aria-invalid={nicknameError ? 'true' : 'false'}
              className="mt-2 block w-full border px-3.5 py-2.5 text-base"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: nicknameError ? 'var(--danger-primary)' : 'var(--border-default)',
                borderRadius: 'var(--radius-control)',
                color: 'var(--text-primary)',
              }}
            />
            {nicknameError && (
              <p role="alert" className="mt-2 text-sm" style={{ color: 'var(--danger-primary)' }}>
                {nicknameError}
              </p>
            )}
          </div>

          {/* 2. Выбор профессии из файлов /content/roles/*.json */}
          <fieldset className="mb-8">
            <legend
              className="mb-3 text-sm font-semibold"
              style={{ color: 'var(--text-primary)' }}
            >
              {ui.menu.roleLabel}
            </legend>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {roles.map((role) => {
                const isSelected = role.id === selectedRoleId;
                const isCompleted = Boolean(savedState?.rolesProgress?.[role.id]?.completed);

                return (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => setSelectedRoleId(role.id)}
                    aria-pressed={isSelected}
                    className="flex h-full flex-col justify-between border p-5 text-left transition-colors"
                    style={{
                      backgroundColor: isSelected
                        ? 'var(--bg-surface-muted)'
                        : 'var(--bg-surface)',
                      borderColor: isSelected
                        ? 'var(--accent-primary)'
                        : 'var(--border-default)',
                      borderRadius: 'var(--radius-control)',
                      boxShadow: isSelected ? 'inset 0 0 0 1px var(--accent-primary)' : 'none',
                    }}
                  >
                    <div>
                      <div className="flex items-baseline justify-between gap-2">
                        <span
                          className="text-base font-semibold"
                          style={{ color: 'var(--text-primary)' }}
                        >
                          {role.title}
                        </span>
                        <span
                          className="text-xs font-medium whitespace-nowrap tabular-nums"
                          style={{ color: 'var(--text-secondary)' }}
                        >
                          {role.durationEstimate}
                        </span>
                      </div>
                      <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                        {role.description}
                      </p>
                    </div>

                    <div
                      className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-xs"
                      style={{
                        borderColor: 'var(--border-default)',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      <span>{role.primaryMetricLabel}</span>
                      {isCompleted && (
                        <span className="font-semibold" style={{ color: 'var(--success-primary)' }}>
                          {ui.menu.roleCompletedLabel}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </fieldset>

          {/* 3. Выбор уровня сложности из content/difficulty.json */}
          <fieldset className="mb-8">
            <legend
              className="mb-3 text-sm font-semibold"
              style={{ color: 'var(--text-primary)' }}
            >
              {ui.menu.difficultyLabel}
            </legend>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {difficulty.profiles.map((profile) => {
                const isSelected = profile.id === selectedDifficultyId;

                return (
                  <button
                    key={profile.id}
                    type="button"
                    onClick={() => setSelectedDifficultyId(profile.id)}
                    aria-pressed={isSelected}
                    className="flex h-full flex-col justify-between border p-4 text-left transition-colors"
                    style={{
                      backgroundColor: isSelected
                        ? 'var(--bg-surface-muted)'
                        : 'var(--bg-surface)',
                      borderColor: isSelected
                        ? 'var(--accent-primary)'
                        : 'var(--border-default)',
                      borderRadius: 'var(--radius-control)',
                      boxShadow: isSelected ? 'inset 0 0 0 1px var(--accent-primary)' : 'none',
                    }}
                  >
                    <div>
                      <div
                        className="text-base font-semibold"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {profile.title}
                      </div>
                      <p className="mt-1.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
                        {profile.description}
                      </p>
                    </div>

                    <dl
                      className="mt-4 space-y-1.5 border-t pt-3 text-xs"
                      style={{ borderColor: 'var(--border-default)' }}
                    >
                      <div className="flex justify-between gap-2">
                        <dt style={{ color: 'var(--text-secondary)' }}>{ui.difficultyLabels.hints}</dt>
                        <dd className="font-medium" style={{ color: 'var(--text-primary)' }}>
                          {profile.params.hintsMode}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt style={{ color: 'var(--text-secondary)' }}>
                          {ui.difficultyLabels.suspicionRate}
                        </dt>
                        <dd className="font-medium" style={{ color: 'var(--text-primary)' }}>
                          {profile.params.suspicionGrowthLabel}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt style={{ color: 'var(--text-secondary)' }}>
                          {ui.difficultyLabels.clientTimer}
                        </dt>
                        <dd className="font-medium tabular-nums" style={{ color: 'var(--text-primary)' }}>
                          {profile.params.clientTimeSeconds > 0
                            ? `${profile.params.clientTimeLabel} (${profile.params.clientTimeSeconds} с)`
                            : profile.params.clientTimeLabel}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt style={{ color: 'var(--text-secondary)' }}>
                          {ui.difficultyLabels.objectHighlight}
                        </dt>
                        <dd className="font-medium" style={{ color: 'var(--text-primary)' }}>
                          {profile.params.objectHighlight}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt style={{ color: 'var(--text-secondary)' }}>
                          {ui.difficultyLabels.miniGames}
                        </dt>
                        <dd className="font-medium" style={{ color: 'var(--text-primary)' }}>
                          {profile.params.miniGamesDifficulty}
                        </dd>
                      </div>
                    </dl>
                  </button>
                );
              })}
            </div>
          </fieldset>

          {/* Нижняя панель формы: пояснение про общий мир и главная кнопка запуска */}
          <div
            className="flex flex-col gap-4 border-t pt-6 sm:flex-row sm:items-center sm:justify-between"
            style={{ borderColor: 'var(--border-default)' }}
          >
            <p className="max-w-xl text-sm" style={{ color: 'var(--text-secondary)' }}>
              <strong style={{ color: 'var(--text-primary)' }}>{ui.menu.sharedWorldNoteTitle}: </strong>
              {ui.menu.sharedWorldNoteBody}
            </p>
            <button
              type="submit"
              className="min-h-[44px] shrink-0 px-6 py-2.5 text-base font-semibold whitespace-nowrap transition-colors"
              style={{
                backgroundColor: 'var(--accent-primary)',
                color: 'var(--accent-text)',
                borderRadius: 'var(--radius-control)',
              }}
            >
              {ui.menu.startButton}
            </button>
          </div>
        </form>
      </main>

      <ConfirmModal
        isOpen={isResetModalOpen}
        title={ui.confirmReset.title}
        message={ui.confirmReset.message}
        confirmLabel={ui.confirmReset.confirmButton}
        cancelLabel={ui.confirmReset.cancelButton}
        onConfirm={handleConfirmReset}
        onCancel={() => setIsResetModalOpen(false)}
      />
    </div>
  );
}
