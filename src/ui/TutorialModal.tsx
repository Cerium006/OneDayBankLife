/**
 * Пошаговое окно обучения для новых игроков.
 * Все заголовки, описания шагов и советы загружаются из content/tutorial.json.
 * Поддерживает переключение шагов мышью и с клавиатуры (стрелки влево/вправо, Esc).
 */

import {
  ArrowLeft,
  ArrowRight,
  ArrowRightLeft,
  Briefcase,
  Gauge,
  Map as MapIcon,
  MousePointerClick,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import type { TutorialConfig, TutorialStepIcon } from '../engine/types';

interface TutorialModalProps {
  isOpen: boolean;
  tutorial: TutorialConfig;
  onClose: () => void;
}

function StepIcon({ icon }: { icon: TutorialStepIcon }) {
  switch (icon) {
    case 'mouse':
      return <MousePointerClick className="h-6 w-6" aria-hidden="true" />;
    case 'map':
      return <MapIcon className="h-6 w-6" aria-hidden="true" />;
    case 'briefcase':
      return <Briefcase className="h-6 w-6" aria-hidden="true" />;
    case 'gauge':
      return <Gauge className="h-6 w-6" aria-hidden="true" />;
    case 'roles':
      return <ArrowRightLeft className="h-6 w-6" aria-hidden="true" />;
  }
}

export function TutorialModal({ isOpen, tutorial, onClose }: TutorialModalProps) {
  const [stepIndex, setStepIndex] = useState<number>(0);

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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tutorial-modal-title"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col border p-6 shadow-2xl"
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
              {tutorial.stepCounterLabel} {safeIndex + 1} / {tutorial.steps.length}
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
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center border transition-colors hover:bg-white/10"
            style={{
              borderColor: 'var(--border-default)',
              borderRadius: 'var(--radius-control)',
              color: 'var(--text-secondary)',
            }}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Переключатель шагов (сегментированные вкладки по шагам) */}
        <div
          role="tablist"
          aria-label={tutorial.title}
          className="mt-4 grid grid-cols-5 gap-2"
        >
          {tutorial.steps.map((step, idx) => {
            const isActive = idx === safeIndex;
            return (
              <button
                key={step.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setStepIndex(idx)}
                className="flex min-h-[38px] items-center justify-center border px-2 py-1.5 text-xs font-semibold whitespace-nowrap tabular-nums transition-colors"
                style={{
                  backgroundColor: isActive ? 'var(--accent-primary)' : 'var(--bg-surface-muted)',
                  borderColor: isActive ? 'var(--accent-primary)' : 'var(--border-default)',
                  color: isActive ? 'var(--accent-text)' : 'var(--text-secondary)',
                  borderRadius: 'var(--radius-control)',
                }}
                title={step.title}
              >
                {idx + 1}
              </button>
            );
          })}
        </div>

        {/* Карточка текущего шага обучения */}
        <div
          className="mt-4 flex-1 overflow-y-auto border p-5"
          style={{
            backgroundColor: 'var(--bg-surface-muted)',
            borderColor: 'var(--border-default)',
            borderRadius: 'var(--radius-control)',
          }}
        >
          <div className="flex items-start gap-4">
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center border"
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
              <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                {currentStep.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--text-primary)' }}>
                {currentStep.description}
              </p>

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
            className="min-h-[40px] border px-3.5 py-2 text-xs font-medium whitespace-nowrap transition-colors hover:bg-white/10"
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
              className="inline-flex min-h-[40px] items-center gap-1.5 border px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-45"
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
                className="inline-flex min-h-[40px] items-center gap-1.5 px-5 py-2 text-sm font-semibold whitespace-nowrap transition-all hover:brightness-110"
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
                className="inline-flex min-h-[40px] items-center gap-1.5 px-5 py-2 text-sm font-semibold whitespace-nowrap transition-all hover:brightness-110"
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
