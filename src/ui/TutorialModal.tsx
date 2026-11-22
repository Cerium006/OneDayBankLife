/**
 * Интерактивное пошаговое окно обучения для новых игроков.
 * Все тексты и параметры мини-практик загружаются из content/tutorial.json.
 * На каждом шаге игрок может сразу попробовать механику в безопасной мини-песочнице:
 * кликнуть по объекту, открыть закрытый проход на схеме, взять бейдж в инвентарь,
 * проверить влияние решений на шкалы и увидеть связь двух профессий в общем мире.
 */

import {
  ArrowLeft,
  ArrowRight,
  ArrowRightLeft,
  Briefcase,
  Check,
  CheckCircle2,
  Eye,
  Gauge,
  Hand,
  Lock,
  Map as MapIcon,
  MapPin,
  MousePointerClick,
  ShieldAlert,
  ShieldCheck,
  Unlock,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { loadSoundEnabled, playSoundEffect } from '../engine/soundEffects';
import type {
  TutorialConfig,
  TutorialPracticeConfig,
  TutorialStepIcon,
} from '../engine/types';

interface TutorialModalProps {
  isOpen: boolean;
  tutorial: TutorialConfig;
  onClose: () => void;
}

function StepIcon({ icon }: { icon: TutorialStepIcon }) {
  switch (icon) {
    case 'mouse':
      return <MousePointerClick className="h-5 w-5" aria-hidden="true" />;
    case 'map':
      return <MapIcon className="h-5 w-5" aria-hidden="true" />;
    case 'briefcase':
      return <Briefcase className="h-5 w-5" aria-hidden="true" />;
    case 'gauge':
      return <Gauge className="h-5 w-5" aria-hidden="true" />;
    case 'roles':
      return <ArrowRightLeft className="h-5 w-5" aria-hidden="true" />;
  }
}

interface PracticeSandboxProps {
  practice: TutorialPracticeConfig;
  isCompleted: boolean;
  promptLabel: string;
  doneLabel: string;
  onComplete: () => void;
}

function PracticeSandbox({
  practice,
  isCompleted,
  promptLabel,
  doneLabel,
  onComplete,
}: PracticeSandboxProps) {
  // Состояние шага 1 (hotspot_demo)
  const [menuOpen, setMenuOpen] = useState<boolean>(false);
  const [hotspotFeedback, setHotspotFeedback] = useState<string | null>(null);

  // Состояние шага 2 (map_demo)
  const [guardUnlocked, setGuardUnlocked] = useState<boolean>(false);
  const [currentRoom, setCurrentRoom] = useState<'from' | 'to'>('from');
  const [mapMessage, setMapMessage] = useState<string | null>(null);

  // Состояние шага 3 (journal_demo)
  const [journalTab, setJournalTab] = useState<'tasks' | 'inventory'>('tasks');
  const [badgeTaken, setBadgeTaken] = useState<boolean>(false);

  // Состояние шага 4 (metrics_demo)
  const [demoSuspicion, setDemoSuspicion] = useState<number>(20);
  const [demoSecurity, setDemoSecurity] = useState<number>(75);
  const [metricsMessage, setMetricsMessage] = useState<string | null>(null);
  const [triedSafe, setTriedSafe] = useState<boolean>(false);
  const [triedRisk, setTriedRisk] = useState<boolean>(false);

  // Состояние шага 5 (shared_world_demo)
  const [usbPlanted, setUsbPlanted] = useState<boolean>(false);

  const soundOn = loadSoundEnabled();

  return (
    <div
      className="flex h-full flex-col justify-between border p-4"
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderColor: isCompleted ? 'var(--accent-primary)' : 'var(--border-default)',
        borderRadius: 'var(--radius-control)',
      }}
    >
      <div>
        <div className="flex items-center justify-between gap-2">
          <span
            className="text-xs font-semibold"
            style={{ color: isCompleted ? 'var(--success-text)' : 'var(--accent-lime)' }}
          >
            {isCompleted ? doneLabel : promptLabel}
          </span>
          {isCompleted && (
            <CheckCircle2
              className="h-4 w-4 shrink-0"
              style={{ color: 'var(--success-text)' }}
              aria-hidden="true"
            />
          )}
        </div>

        <h4 className="mt-1 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          {practice.title}
        </h4>
        <p className="mt-0.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
          {practice.instruction}
        </p>

        {/* Интерактив 1: имитация комнаты, хотспота и меню действий */}
        {practice.kind === 'hotspot_demo' && (
          <div className="mt-3 space-y-2.5">
            <div
              className="relative flex h-32 items-center justify-center overflow-hidden border p-3"
              style={{
                background:
                  'linear-gradient(145deg, rgba(62,74,62,0.55) 0%, rgba(33,37,34,0.95) 100%)',
                borderColor: 'var(--border-default)',
                borderRadius: 'var(--radius-control)',
              }}
            >
              {/* Силуэт рабочего стола и монитора */}
              <div
                className="relative flex h-20 w-40 items-center justify-center border"
                style={{
                  backgroundColor: 'rgba(20, 26, 20, 0.72)',
                  borderColor: 'rgba(233, 198, 156, 0.25)',
                  borderRadius: '6px',
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    playSoundEffect('click', soundOn);
                    setMenuOpen((prev) => !prev);
                  }}
                  className="cursor-pointer border-2 border-dashed px-3 py-1.5 text-xs font-semibold transition-transform hover:scale-105"
                  style={{
                    borderColor: 'var(--accent-lime)',
                    backgroundColor: 'rgba(212, 250, 66, 0.16)',
                    color: 'var(--text-primary)',
                    borderRadius: '6px',
                  }}
                >
                  {practice.hotspotLabel}
                </button>
              </div>

              {menuOpen && (
                <div
                  className="ui-pop-in absolute right-3 top-3 z-10 flex flex-col gap-1 border p-1.5 shadow-xl"
                  style={{
                    backgroundColor: 'var(--hud-overlay)',
                    borderColor: 'var(--hud-border)',
                    borderRadius: '6px',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      playSoundEffect('click', soundOn);
                      setMenuOpen(false);
                      setHotspotFeedback(practice.inspectResult);
                      onComplete();
                    }}
                    className="flex min-h-[32px] cursor-pointer items-center gap-1.5 rounded px-2.5 py-1 text-left text-xs font-medium whitespace-nowrap hover:bg-white/10"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{practice.inspectLabel}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      playSoundEffect('pickup', soundOn);
                      setMenuOpen(false);
                      setHotspotFeedback(practice.actionResult);
                      onComplete();
                    }}
                    className="flex min-h-[32px] cursor-pointer items-center gap-1.5 rounded px-2.5 py-1 text-left text-xs font-medium whitespace-nowrap hover:bg-white/10"
                    style={{ color: 'var(--accent-lime)' }}
                  >
                    <Hand className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{practice.actionLabel}</span>
                  </button>
                </div>
              )}
            </div>

            {hotspotFeedback && (
              <p
                className="border px-3 py-2 text-xs leading-relaxed"
                style={{
                  backgroundColor: 'var(--bg-surface-muted)',
                  borderColor: 'var(--accent-primary)',
                  borderRadius: '6px',
                  color: 'var(--text-primary)',
                }}
              >
                {hotspotFeedback}
              </p>
            )}
          </div>
        )}

        {/* Интерактив 2: закрытый проход и перемещение по карте */}
        {practice.kind === 'map_demo' && (
          <div className="mt-3 space-y-2.5">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  playSoundEffect('move', soundOn);
                  setCurrentRoom('from');
                  setMapMessage(null);
                }}
                className="flex min-h-[56px] cursor-pointer flex-col items-center justify-center border px-2 py-2 text-center text-xs font-semibold transition-colors"
                style={{
                  backgroundColor:
                    currentRoom === 'from' ? 'var(--accent-primary)' : 'var(--bg-surface-muted)',
                  borderColor:
                    currentRoom === 'from' ? 'var(--accent-primary)' : 'var(--border-default)',
                  color: currentRoom === 'from' ? 'var(--accent-text)' : 'var(--text-primary)',
                  borderRadius: 'var(--radius-control)',
                }}
              >
                <span className="flex items-center gap-1">
                  {currentRoom === 'from' && <MapPin className="h-3.5 w-3.5" aria-hidden="true" />}
                  {practice.roomFrom}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (!guardUnlocked) {
                    playSoundEffect('locked', soundOn);
                    setMapMessage(practice.lockedMessage);
                    return;
                  }
                  playSoundEffect('move', soundOn);
                  setCurrentRoom('to');
                  setMapMessage(practice.movedMessage);
                  onComplete();
                }}
                className="flex min-h-[56px] cursor-pointer flex-col items-center justify-center border px-2 py-2 text-center text-xs font-semibold transition-colors"
                style={{
                  backgroundColor:
                    currentRoom === 'to' ? 'var(--accent-primary)' : 'var(--bg-surface-muted)',
                  borderColor: guardUnlocked ? 'var(--accent-primary)' : 'var(--border-default)',
                  color: currentRoom === 'to' ? 'var(--accent-text)' : 'var(--text-primary)',
                  borderRadius: 'var(--radius-control)',
                }}
              >
                <span className="flex items-center gap-1">
                  {currentRoom === 'to' ? (
                    <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : guardUnlocked ? (
                    <Unlock className="h-3.5 w-3.5" style={{ color: 'var(--accent-lime)' }} aria-hidden="true" />
                  ) : (
                    <Lock className="h-3.5 w-3.5" style={{ color: 'var(--danger-text)' }} aria-hidden="true" />
                  )}
                  {practice.roomTo}
                </span>
              </button>
            </div>

            <button
              type="button"
              disabled={guardUnlocked}
              onClick={() => {
                playSoundEffect('pickup', soundOn);
                setGuardUnlocked(true);
                setMapMessage(null);
              }}
              className="flex min-h-[36px] w-full cursor-pointer items-center justify-center gap-1.5 border px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-white/10 disabled:cursor-default disabled:opacity-80"
              style={{
                backgroundColor: guardUnlocked ? 'rgba(0, 184, 73, 0.16)' : 'var(--bg-surface-muted)',
                borderColor: guardUnlocked ? 'var(--accent-primary)' : 'var(--border-default)',
                color: guardUnlocked ? 'var(--success-text)' : 'var(--accent-lime)',
                borderRadius: 'var(--radius-control)',
              }}
            >
              {guardUnlocked ? (
                <>
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{practice.unlockedBadge}</span>
                </>
              ) : (
                <span>{practice.unlockButton}</span>
              )}
            </button>

            {mapMessage && (
              <p
                className="border px-3 py-2 text-xs"
                style={{
                  backgroundColor: 'var(--bg-surface-muted)',
                  borderColor: guardUnlocked ? 'var(--accent-primary)' : 'var(--danger-text)',
                  borderRadius: '6px',
                  color: guardUnlocked ? 'var(--text-primary)' : 'var(--danger-text)',
                }}
              >
                {mapMessage}
              </p>
            )}
          </div>
        )}

        {/* Интерактив 3: дневник задач и вкладка инвентаря */}
        {practice.kind === 'journal_demo' && (
          <div className="mt-3 space-y-2.5">
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => {
                  playSoundEffect('click', soundOn);
                  setJournalTab('tasks');
                }}
                className="min-h-[32px] flex-1 cursor-pointer border px-2 py-1 text-xs font-semibold transition-colors"
                style={{
                  backgroundColor:
                    journalTab === 'tasks' ? 'var(--accent-primary)' : 'var(--bg-surface-muted)',
                  borderColor:
                    journalTab === 'tasks' ? 'var(--accent-primary)' : 'var(--border-default)',
                  color: journalTab === 'tasks' ? 'var(--accent-text)' : 'var(--text-primary)',
                  borderRadius: '6px',
                }}
              >
                {practice.tasksTabLabel}
              </button>
              <button
                type="button"
                onClick={() => {
                  playSoundEffect('click', soundOn);
                  setJournalTab('inventory');
                }}
                className="min-h-[32px] flex-1 cursor-pointer border px-2 py-1 text-xs font-semibold tabular-nums transition-colors"
                style={{
                  backgroundColor:
                    journalTab === 'inventory' ? 'var(--accent-primary)' : 'var(--bg-surface-muted)',
                  borderColor:
                    journalTab === 'inventory' ? 'var(--accent-primary)' : 'var(--border-default)',
                  color: journalTab === 'inventory' ? 'var(--accent-text)' : 'var(--text-primary)',
                  borderRadius: '6px',
                }}
              >
                {practice.inventoryTabLabel} ({badgeTaken ? 1 : 0})
              </button>
            </div>

            <div
              className="border p-3"
              style={{
                backgroundColor: 'var(--bg-surface-muted)',
                borderColor: 'var(--border-default)',
                borderRadius: '6px',
              }}
            >
              {journalTab === 'tasks' ? (
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {practice.sampleQuestTitle}
                  </span>
                  <span
                    className="font-semibold whitespace-nowrap"
                    style={{ color: badgeTaken ? 'var(--success-text)' : 'var(--accent-lime)' }}
                  >
                    {badgeTaken ? practice.statusDone : practice.statusActive}
                  </span>
                </div>
              ) : badgeTaken ? (
                <div className="flex items-center gap-2.5">
                  <img
                    src={practice.sampleItemImage}
                    alt={practice.sampleItemName}
                    referrerPolicy="no-referrer"
                    className="h-9 w-9 shrink-0 rounded border border-white/15 bg-black/25 p-1 object-contain"
                  />
                  <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {practice.sampleItemName}
                  </span>
                </div>
              ) : (
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  —
                </p>
              )}
            </div>

            <button
              type="button"
              disabled={badgeTaken}
              onClick={() => {
                playSoundEffect('pickup', soundOn);
                setBadgeTaken(true);
                setJournalTab('inventory');
                onComplete();
              }}
              className="flex min-h-[36px] w-full cursor-pointer items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-all hover:brightness-110 disabled:cursor-default disabled:opacity-65"
              style={{
                backgroundColor: 'var(--accent-primary)',
                color: 'var(--accent-text)',
                borderRadius: 'var(--radius-control)',
              }}
            >
              <Hand className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{badgeTaken ? practice.statusDone : practice.pickupButton}</span>
            </button>
          </div>
        )}

        {/* Интерактив 4: симулятор влияния решений на шкалы */}
        {practice.kind === 'metrics_demo' && (
          <div className="mt-3 space-y-2.5">
            <div className="space-y-2">
              <div>
                <div className="flex justify-between text-xs tabular-nums">
                  <span style={{ color: 'var(--text-secondary)' }}>{practice.suspicionLabel}</span>
                  <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {demoSuspicion}%
                  </span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-sm bg-white/15">
                  <div
                    className="h-full transition-all duration-300"
                    style={{
                      width: `${demoSuspicion}%`,
                      backgroundColor:
                        demoSuspicion >= 60 ? 'var(--danger-primary)' : 'var(--accent-primary)',
                    }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs tabular-nums">
                  <span style={{ color: 'var(--text-secondary)' }}>{practice.securityLabel}</span>
                  <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {demoSecurity}%
                  </span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-sm bg-white/15">
                  <div
                    className="h-full transition-all duration-300"
                    style={{
                      width: `${demoSecurity}%`,
                      backgroundColor:
                        demoSecurity <= 45 ? 'var(--danger-primary)' : 'var(--success-primary)',
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-1.5">
              <button
                type="button"
                onClick={() => {
                  playSoundEffect('success', soundOn);
                  setDemoSuspicion(10);
                  setDemoSecurity(95);
                  setMetricsMessage(practice.safeResult);
                  setTriedSafe(true);
                  onComplete();
                }}
                className="flex min-h-[34px] cursor-pointer items-center gap-1.5 border px-2.5 py-1.5 text-left text-xs font-medium transition-colors hover:bg-white/10"
                style={{
                  borderColor: triedSafe ? 'var(--accent-primary)' : 'var(--border-default)',
                  backgroundColor: 'var(--bg-surface-muted)',
                  color: 'var(--text-primary)',
                  borderRadius: '6px',
                }}
              >
                <ShieldCheck className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--success-text)' }} aria-hidden="true" />
                <span>{practice.safeChoiceLabel}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  playSoundEffect('alert', soundOn);
                  setDemoSuspicion(70);
                  setDemoSecurity(35);
                  setMetricsMessage(practice.riskResult);
                  setTriedRisk(true);
                  onComplete();
                }}
                className="flex min-h-[34px] cursor-pointer items-center gap-1.5 border px-2.5 py-1.5 text-left text-xs font-medium transition-colors hover:bg-white/10"
                style={{
                  borderColor: triedRisk ? 'var(--warning-primary)' : 'var(--border-default)',
                  backgroundColor: 'var(--bg-surface-muted)',
                  color: 'var(--text-primary)',
                  borderRadius: '6px',
                }}
              >
                <ShieldAlert className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--warning-primary)' }} aria-hidden="true" />
                <span>{practice.riskChoiceLabel}</span>
              </button>
            </div>

            {metricsMessage && (
              <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                {metricsMessage}
              </p>
            )}
          </div>
        )}

        {/* Интерактив 5: общий мир пентестера и менеджера */}
        {practice.kind === 'shared_world_demo' && (
          <div className="mt-3 space-y-2.5">
            <div
              className="border p-2.5"
              style={{
                backgroundColor: 'var(--bg-surface-muted)',
                borderColor: 'var(--border-default)',
                borderRadius: '6px',
              }}
            >
              <div className="text-[11px] font-semibold" style={{ color: 'var(--accent-lime)' }}>
                {practice.roleOneLabel}
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={usbPlanted}
                onClick={() => {
                  playSoundEffect('click', soundOn);
                  setUsbPlanted((prev) => !prev);
                  onComplete();
                }}
                className="mt-1.5 flex min-h-[36px] w-full cursor-pointer items-center justify-between gap-2 border px-2.5 py-1.5 text-left text-xs font-medium transition-colors hover:bg-white/10"
                style={{
                  backgroundColor: usbPlanted ? 'rgba(0, 184, 73, 0.18)' : 'var(--bg-surface)',
                  borderColor: usbPlanted ? 'var(--accent-primary)' : 'var(--border-default)',
                  color: 'var(--text-primary)',
                  borderRadius: '6px',
                }}
              >
                <span>{practice.togglePlantLabel}</span>
                <span
                  className="font-bold"
                  style={{ color: usbPlanted ? 'var(--success-text)' : 'var(--text-secondary)' }}
                >
                  {usbPlanted ? 'ВКЛ' : 'ВЫКЛ'}
                </span>
              </button>
            </div>

            <div
              className="border p-2.5"
              style={{
                backgroundColor: 'var(--bg-surface-muted)',
                borderColor: usbPlanted ? 'var(--warning-primary)' : 'var(--border-default)',
                borderRadius: '6px',
              }}
            >
              <div className="text-[11px] font-semibold" style={{ color: 'var(--text-secondary)' }}>
                {practice.roleTwoLabel}
              </div>
              <div className="mt-1.5 flex items-center gap-2.5">
                {usbPlanted && (
                  <img
                    src={practice.plantedItemImage}
                    alt=""
                    referrerPolicy="no-referrer"
                    className="h-8 w-8 shrink-0 rounded border border-white/15 bg-black/25 p-1 object-contain"
                  />
                )}
                <p className="text-xs leading-relaxed" style={{ color: 'var(--text-primary)' }}>
                  {usbPlanted ? practice.plantedStateText : practice.cleanStateText}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function TutorialModal({ isOpen, tutorial, onClose }: TutorialModalProps) {
  const [stepIndex, setStepIndex] = useState<number>(0);
  const [practicedSteps, setPracticedSteps] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (isOpen) {
      setStepIndex(0);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        setStepIndex((prev) => Math.min(tutorial.steps.length - 1, prev + 1));
        return;
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        setStepIndex((prev) => Math.max(0, prev - 1));
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, tutorial.steps.length, onClose]);

  if (!isOpen || tutorial.steps.length === 0) {
    return null;
  }

  const safeIndex = Math.min(stepIndex, tutorial.steps.length - 1);
  const currentStep = tutorial.steps[safeIndex];
  const isFirst = safeIndex === 0;
  const isLast = safeIndex === tutorial.steps.length - 1;
  const practicedCount = tutorial.steps.filter((s) => practicedSteps[s.id]).length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tutorial-modal-title"
      onClick={onClose}
    >
      <div
        className="ui-pop-in flex max-h-[92vh] w-full max-w-3xl flex-col border p-6 shadow-2xl"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-default)',
          borderRadius: 'var(--radius-card)',
        }}
        onClick={(event) => event.stopPropagation()}
      >
        {/* Заголовок окна обучения */}
        <div
          className="flex items-start justify-between gap-4 border-b pb-4"
          style={{ borderColor: 'var(--border-default)' }}
        >
          <div>
            <p className="text-xs font-medium tabular-nums" style={{ color: 'var(--accent-lime)' }}>
              <span>
                {tutorial.stepCounterLabel} {safeIndex + 1} / {tutorial.steps.length}
              </span>
              {practicedCount > 0 && (
                <>
                  <span aria-hidden="true"> · </span>
                  <span style={{ color: 'var(--text-secondary)' }}>
                    {tutorial.practiceDoneLabel ?? 'Практика'}: {practicedCount}/{tutorial.steps.length}
                  </span>
                </>
              )}
            </p>
            <h2
              id="tutorial-modal-title"
              className="mt-0.5 text-xl font-bold"
              style={{ color: 'var(--text-primary)', textWrap: 'balance' }}
            >
              {tutorial.title}
            </h2>
            <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
              {tutorial.subtitle}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label={tutorial.skipButton}
            className="inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center border transition-colors hover:bg-white/10"
            style={{
              borderColor: 'var(--border-default)',
              borderRadius: 'var(--radius-control)',
              color: 'var(--text-secondary)',
            }}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Сегментированные вкладки по шагам */}
        <div
          role="tablist"
          aria-label={tutorial.title}
          className="mt-4 grid grid-cols-5 gap-2"
        >
          {tutorial.steps.map((step, idx) => {
            const isActive = idx === safeIndex;
            const isDone = Boolean(practicedSteps[step.id]);
            return (
              <button
                key={step.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setStepIndex(idx)}
                className="flex min-h-[38px] cursor-pointer items-center justify-center gap-1.5 border px-2 py-1.5 text-xs font-semibold whitespace-nowrap tabular-nums transition-colors"
                style={{
                  backgroundColor: isActive ? 'var(--accent-primary)' : 'var(--bg-surface-muted)',
                  borderColor: isActive
                    ? 'var(--accent-primary)'
                    : isDone
                      ? 'var(--success-text)'
                      : 'var(--border-default)',
                  color: isActive ? 'var(--accent-text)' : 'var(--text-secondary)',
                  borderRadius: 'var(--radius-control)',
                }}
                title={step.title}
              >
                <span>{idx + 1}</span>
                {isDone && (
                  <Check
                    className="h-3.5 w-3.5 shrink-0"
                    style={{ color: isActive ? 'var(--accent-text)' : 'var(--success-text)' }}
                    aria-hidden="true"
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Двухколоночная область: теория слева + живая тренировка справа */}
        <div
          className="mt-4 flex-1 overflow-y-auto border p-4 sm:p-5"
          style={{
            backgroundColor: 'var(--bg-surface-muted)',
            borderColor: 'var(--border-default)',
            borderRadius: 'var(--radius-control)',
          }}
        >
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:items-stretch">
            <div className={currentStep.practice ? 'lg:col-span-6' : 'lg:col-span-12'}>
              <div className="flex items-start gap-3.5">
                <div
                  className="flex h-11 w-11 shrink-0 items-center justify-center border"
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    borderColor: 'var(--accent-primary)',
                    borderRadius: 'var(--radius-control)',
                    color: 'var(--accent-lime)',
                  }}
                >
                  <StepIcon icon={currentStep.icon} />
                </div>

                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-semibold sm:text-lg" style={{ color: 'var(--text-primary)' }}>
                    {currentStep.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--text-primary)' }}>
                    {currentStep.description}
                  </p>
                </div>
              </div>

              {currentStep.tip && (
                <div
                  className="mt-4 border p-3.5 text-xs leading-relaxed"
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    borderColor: 'var(--border-default)',
                    borderRadius: 'var(--radius-control)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  <strong className="font-semibold" style={{ color: 'var(--accent-lime)' }}>
                    Совет:{' '}
                  </strong>
                  <span>{currentStep.tip}</span>
                </div>
              )}
            </div>

            {currentStep.practice && (
              <div className="lg:col-span-6">
                <PracticeSandbox
                  key={currentStep.id}
                  practice={currentStep.practice}
                  isCompleted={Boolean(practicedSteps[currentStep.id])}
                  promptLabel={tutorial.practicePromptLabel ?? 'Попробуй прямо сейчас'}
                  doneLabel={tutorial.practiceDoneLabel ?? 'Практика выполнена'}
                  onComplete={() =>
                    setPracticedSteps((prev) => ({ ...prev, [currentStep.id]: true }))
                  }
                />
              </div>
            )}
          </div>
        </div>

        {/* Нижняя панель навигации по шагам */}
        <div
          className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t pt-4"
          style={{ borderColor: 'var(--border-default)' }}
        >
          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] cursor-pointer border px-3.5 py-2 text-xs font-medium whitespace-nowrap transition-colors hover:bg-white/10"
            style={{
              borderColor: 'var(--border-default)',
              borderRadius: 'var(--radius-control)',
              color: 'var(--text-secondary)',
            }}
          >
            {tutorial.skipButton}
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isFirst}
              onClick={() => setStepIndex((prev) => Math.max(0, prev - 1))}
              className="inline-flex min-h-[40px] cursor-pointer items-center gap-1.5 border px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-45"
              style={{
                borderColor: 'var(--border-default)',
                borderRadius: 'var(--radius-control)',
                color: 'var(--text-primary)',
              }}
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              <span>{tutorial.prevButton}</span>
            </button>

            {isLast ? (
              <button
                type="button"
                onClick={onClose}
                className="inline-flex min-h-[40px] cursor-pointer items-center gap-1.5 px-5 py-2 text-sm font-semibold whitespace-nowrap transition-all hover:brightness-110"
                style={{
                  backgroundColor: 'var(--accent-primary)',
                  color: 'var(--accent-text)',
                  borderRadius: 'var(--radius-control)',
                }}
              >
                <span>{tutorial.finishButton}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setStepIndex((prev) => Math.min(tutorial.steps.length - 1, prev + 1))}
                className="inline-flex min-h-[40px] cursor-pointer items-center gap-1.5 px-5 py-2 text-sm font-semibold whitespace-nowrap transition-all hover:brightness-110"
                style={{
                  backgroundColor: 'var(--accent-primary)',
                  color: 'var(--accent-text)',
                  borderRadius: 'var(--radius-control)',
                }}
              >
                <span>{tutorial.nextButton}</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
