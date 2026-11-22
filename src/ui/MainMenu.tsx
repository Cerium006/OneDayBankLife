/**
 * Главное меню игры «БанкЧар».
 * Карточки выбора профессии и уровня сложности оформлены в компактном стиле с иконками:
 * тёмный фон #2A2A2A, нейтральные рамки #585858 и зелёное выделение активной карточки (#00B849).
 */

import { HelpCircle, Shield, UserCheck } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { markTutorialCompleted } from '../engine/storage';
import type {
  DifficultyConfig,
  GameSaveState,
  RoleConfig,
  TutorialConfig,
  UiTexts,
} from '../engine/types';
import { ConfirmModal } from './ConfirmModal';
import { TutorialModal } from './TutorialModal';

interface MainMenuProps {
  ui: UiTexts;
  roles: RoleConfig[];
  difficulty: DifficultyConfig;
  tutorial: TutorialConfig;
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
  tutorial,
  savedState,
  onStartNewGame,
  onContinueGame,
  onResetProgress,
}: MainMenuProps) {
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
  const [isTutorialOpen, setIsTutorialOpen] = useState<boolean>(false);
  const [failedIcons, setFailedIcons] = useState<Record<string, boolean>>({});

  const selectedRole = roles.find((r) => r.id === selectedRoleId) ?? roles[0];
  const selectedDifficulty =
    difficulty.profiles.find((p) => p.id === selectedDifficultyId) ?? difficulty.profiles[0];

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
    <div className="min-h-screen px-4 py-8 sm:px-6 lg:px-8" style={{ backgroundColor: 'var(--bg-page)' }}>
      <main className="mx-auto max-w-[960px]">
        {/* Шапка с названием игры, пояснением и кнопкой обучения */}
        <header
          className="mb-8 flex flex-col gap-4 border-b pb-6 sm:flex-row sm:items-start sm:justify-between"
          style={{ borderColor: 'var(--border-default)' }}
        >
          <div>
            <h1
              className="text-3xl font-bold tracking-tight sm:text-4xl"
              style={{ color: 'var(--text-primary)', textWrap: 'balance' }}
            >
              {ui.appTitle}
            </h1>
            <p className="mt-2 max-w-2xl text-sm sm:text-base" style={{ color: 'var(--text-secondary)' }}>
              {ui.appSubtitle}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsTutorialOpen(true)}
            className="inline-flex min-h-[40px] shrink-0 cursor-pointer items-center gap-2 self-start border px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors hover:bg-white/10"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-default)',
              borderRadius: 'var(--radius-control)',
              color: 'var(--text-primary)',
            }}
          >
            <HelpCircle className="h-4 w-4" style={{ color: 'var(--accent-lime)' }} aria-hidden="true" />
            <span>{ui.menu.tutorialButton}</span>
          </button>
        </header>

        {/* Блок продолжения сохранённой смены */}
        {savedState && (
          <section
            aria-labelledby="continue-heading"
            className="mb-8 border p-5"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-default)',
              borderRadius: '14px',
            }}
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2
                  id="continue-heading"
                  className="text-base font-semibold"
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
                  className="min-h-[42px] cursor-pointer px-5 py-2 text-sm font-semibold whitespace-nowrap transition-all hover:brightness-110"
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
                  className="min-h-[42px] cursor-pointer border px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors hover:bg-white/10"
                  style={{
                    borderColor: 'var(--border-default)',
                    color: 'var(--danger-text)',
                    borderRadius: 'var(--radius-control)',
                  }}
                >
                  {ui.menu.resetButton}
                </button>
              </div>
            </div>
          </section>
        )}

        {/* Форма запуска новой смены (свободная вёрстка прямо на графитовом холсте как на макете) */}
        <form onSubmit={handleSubmit} noValidate className="space-y-8">
          {/* 1. Никнейм игрока */}
          <div className="max-w-md">
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
              className="mt-2 block w-full border px-4 py-2.5 text-base"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: nicknameError ? 'var(--danger-text)' : 'var(--border-default)',
                borderRadius: '12px',
                color: 'var(--text-primary)',
              }}
            />
            {nicknameError && (
              <p role="alert" className="mt-2 text-sm" style={{ color: 'var(--danger-text)' }}>
                {nicknameError}
              </p>
            )}
          </div>

          {/* 2. Компактные горизонтальные карточки выбора роли с иконками справа */}
          <fieldset>
            <legend
              className="mb-3 text-base font-bold"
              style={{ color: 'var(--text-primary)' }}
            >
              {ui.menu.roleLabel}
            </legend>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {roles.map((role) => {
                const isSelected = role.id === selectedRoleId;
                const isCompleted = Boolean(savedState?.rolesProgress?.[role.id]?.completed);
                const iconKey = `role:${role.id}`;
                const showIcon = Boolean(role.icon && !failedIcons[iconKey]);

                return (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => setSelectedRoleId(role.id)}
                    aria-pressed={isSelected}
                    className="flex min-h-[78px] cursor-pointer items-center justify-between gap-4 border-2 px-5 py-3 text-left transition-all hover:brightness-110"
                    style={{
                      backgroundColor: isSelected ? 'rgba(0, 184, 73, 0.22)' : 'var(--bg-surface)',
                      borderColor: isSelected ? 'var(--accent-primary)' : 'var(--border-default)',
                      borderRadius: '14px',
                    }}
                  >
                    <div className="min-w-0">
                      <div
                        className="text-base font-bold leading-snug sm:text-[17px]"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {role.title}
                      </div>
                      {isCompleted && (
                        <div className="mt-0.5 text-xs font-medium" style={{ color: 'var(--success-text)' }}>
                          {ui.menu.roleCompletedLabel}
                        </div>
                      )}
                    </div>

                    <div className="flex h-12 w-12 shrink-0 items-center justify-center">
                      {showIcon ? (
                        <img
                          src={role.icon}
                          alt=""
                          referrerPolicy="no-referrer"
                          onError={() =>
                            setFailedIcons((prev) => ({ ...prev, [iconKey]: true }))
                          }
                          className="h-full w-full object-contain"
                        />
                      ) : role.id === 'pentester' ? (
                        <Shield className="h-8 w-8" style={{ color: 'var(--accent-lime)' }} aria-hidden="true" />
                      ) : (
                        <UserCheck className="h-8 w-8" style={{ color: 'var(--text-secondary)' }} aria-hidden="true" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {selectedRole && (
              <p className="mt-3 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                <span style={{ color: 'var(--text-primary)' }}>{selectedRole.description}</span>
                <span aria-hidden="true"> · </span>
                <span className="tabular-nums">{selectedRole.durationEstimate}</span>
                <span aria-hidden="true"> · </span>
                <span>{selectedRole.primaryMetricLabel}</span>
              </p>
            )}
          </fieldset>

          {/* 3. Карточки уровней сложности как на фото: слева крупный заголовок, справа графика */}
          <fieldset>
            <legend
              className="mb-3 text-base font-bold"
              style={{ color: 'var(--text-primary)' }}
            >
              {ui.menu.difficultyLabel}
            </legend>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {difficulty.profiles.map((profile) => {
                const isSelected = profile.id === selectedDifficultyId;
                const iconKey = `diff:${profile.id}`;
                const showIcon = Boolean(profile.icon && !failedIcons[iconKey]);

                return (
                  <button
                    key={profile.id}
                    type="button"
                    onClick={() => setSelectedDifficultyId(profile.id)}
                    aria-pressed={isSelected}
                    className="flex min-h-[110px] cursor-pointer items-center justify-between gap-3 border-2 px-5 py-4 text-left transition-all hover:brightness-110"
                    style={{
                      backgroundColor: isSelected ? 'rgba(0, 184, 73, 0.22)' : 'var(--bg-surface)',
                      borderColor: isSelected ? 'var(--accent-primary)' : 'var(--border-default)',
                      borderRadius: '16px',
                    }}
                  >
                    <span
                      className="text-lg font-bold whitespace-nowrap sm:text-xl"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {profile.title}
                    </span>

                    <div className="flex h-16 w-16 shrink-0 items-center justify-center">
                      {showIcon ? (
                        <img
                          src={profile.icon}
                          alt=""
                          referrerPolicy="no-referrer"
                          onError={() =>
                            setFailedIcons((prev) => ({ ...prev, [iconKey]: true }))
                          }
                          className="h-full w-full object-contain"
                        />
                      ) : (
                        <span className="text-2xl font-bold" style={{ color: 'var(--accent-lime)' }}>
                          {profile.title[0]}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {selectedDifficulty && (
              <div className="mt-3 space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                <p style={{ color: 'var(--text-primary)' }}>{selectedDifficulty.description}</p>
                <p className="text-xs leading-relaxed tabular-nums">
                  <span>{ui.difficultyLabels.hints}: {selectedDifficulty.params.hintsMode}</span>
                  <span aria-hidden="true"> · </span>
                  <span>
                    {ui.difficultyLabels.suspicionRate}: {selectedDifficulty.params.suspicionGrowthLabel}
                  </span>
                  <span aria-hidden="true"> · </span>
                  <span>
                    {ui.difficultyLabels.clientTimer}:{' '}
                    {selectedDifficulty.params.clientTimeSeconds > 0
                      ? `${selectedDifficulty.params.clientTimeLabel} (${selectedDifficulty.params.clientTimeSeconds} с)`
                      : selectedDifficulty.params.clientTimeLabel}
                  </span>
                  <span aria-hidden="true"> · </span>
                  <span>
                    {ui.difficultyLabels.objectHighlight}: {selectedDifficulty.params.objectHighlight}
                  </span>
                  <span aria-hidden="true"> · </span>
                  <span>{ui.difficultyLabels.miniGames}: {selectedDifficulty.params.miniGamesDifficulty}</span>
                </p>
              </div>
            )}
          </fieldset>

          {/* Нижняя панель с примечанием про общий мир и кнопкой запуска */}
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
              className="min-h-[44px] shrink-0 cursor-pointer px-7 py-2.5 text-base font-semibold whitespace-nowrap transition-all hover:brightness-110"
              style={{
                backgroundColor: 'var(--accent-primary)',
                color: 'var(--accent-text)',
                borderRadius: '10px',
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

      <TutorialModal
        isOpen={isTutorialOpen}
        tutorial={tutorial}
        onClose={() => {
          markTutorialCompleted();
          setIsTutorialOpen(false);
        }}
      />
    </div>
  );
}
