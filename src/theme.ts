/**
 * Единый файл оформления (темы) приложения.
 * Палитра основана на тёмном графите (#2A2A2A), лесной подложке (#496648),
 * изумрудном (#00B849), лаймовом (#D4FA42), сером (#585858) и тёплом песочном (#E9C69C).
 */

export const theme = {
  colors: {
    // Основной фон страницы (глубокий графит)
    background: '#2A2A2A',
    // Фон карточек и модальных панелей
    surface: '#333734',
    // Вторичная поверхность с приглушённым оттенком лесного фона
    surfaceMuted: '#3E4A3E',
    // Подложка лесного оттенка для карт и декоративных областей
    sageBackdrop: '#496648',
    // Тонкая рамка для разделения блоков (средний серый из палитры)
    border: '#585858',
    // Основной светлый текст на тёмных карточках (контраст > 11:1)
    textPrimary: '#F7F4EE',
    // Вторичный тёплый песочный цвет текста (контраст > 5.7:1 на всех поверхностях)
    textSecondary: '#E9C69C',
    // Главный акцентный цвет для ключевых кнопок (изумрудный)
    accent: '#00B849',
    // Лаймовый цвет для подсветки при наведении и активных подсказок
    accentHover: '#D4FA42',
    // Яркий лаймовый акцент для иконок, целей и контуров
    accentLime: '#D4FA42',
    // Тёмный текст поверх изумрудной и лаймовой кнопок (контраст 6.7:1 и 14.8:1)
    accentText: '#141A14',
    // Цвет заливки опасных кнопок (с белым текстом) и критических шкал
    danger: '#B91C1C',
    dangerHover: '#991B1B',
    // Читаемый светло-красный цвет текста/ошибок на тёмном фоне
    dangerText: '#FCA5A5',
    // Цвет умеренного предупреждения на шкалах и отчётах
    warning: '#F6B95E',
    // Цвет заливки успешных кнопок и безопасных шкал
    success: '#00B849',
    // Светло-зелёный текст статуса выполненной задачи на тёмном фоне
    successText: '#2EE673',
    // Полупрозрачная подложка панелей поверх комнаты
    hudOverlay: 'rgba(28, 32, 29, 0.92)',
    hudText: '#F7F4EE',
    hudBorder: 'rgba(233, 198, 156, 0.22)',
  },
  typography: {
    // Системные шрифты не требуют интернета — игра работает полностью офлайн
    fontSans: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    fontMono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    titleSize: '2rem',
    headingSize: '1.25rem',
    bodySize: '1rem',
    smallSize: '0.875rem',
  },
  spacing: {
    containerMaxWidth: '1040px',
    pagePadding: '24px',
    cardPadding: '24px',
    gap: '16px',
  },
  radius: {
    card: '12px',
    control: '8px',
  },
  // Цвета временных фонов комнат на время загрузки фотографий
  roomColors: {
    entrance: '#353E35',
    hall: '#333A33',
    counter: '#3E4A3E',
    office: '#333734',
    meeting: '#3A3A35',
    corridor: '#2F3B30',
    server_room: '#2A2F2A',
  } as Record<string, string>,
  // Цвета подсветки кликабельных зон (hotspots) по их типу
  hotspotColors: {
    object: '#D4FA42',
    npc: '#00B849',
    door: '#E9C69C',
  } as Record<'object' | 'npc' | 'door', string>,
} as const;

/**
 * Записывает значения из theme в CSS-переменные страницы (:root),
 * чтобы стили в index.css и Tailwind автоматически использовали актуальную тему.
 */
export function applyThemeCssVariables(): void {
  const root = document.documentElement;
  root.style.setProperty('--bg-page', theme.colors.background);
  root.style.setProperty('--bg-surface', theme.colors.surface);
  root.style.setProperty('--bg-surface-muted', theme.colors.surfaceMuted);
  root.style.setProperty('--sage-backdrop', theme.colors.sageBackdrop);
  root.style.setProperty('--border-default', theme.colors.border);
  root.style.setProperty('--text-primary', theme.colors.textPrimary);
  root.style.setProperty('--text-secondary', theme.colors.textSecondary);
  root.style.setProperty('--accent-primary', theme.colors.accent);
  root.style.setProperty('--accent-hover', theme.colors.accentHover);
  root.style.setProperty('--accent-lime', theme.colors.accentLime);
  root.style.setProperty('--accent-text', theme.colors.accentText);
  root.style.setProperty('--danger-primary', theme.colors.danger);
  root.style.setProperty('--danger-hover', theme.colors.dangerHover);
  root.style.setProperty('--danger-text', theme.colors.dangerText);
  root.style.setProperty('--warning-primary', theme.colors.warning);
  root.style.setProperty('--success-primary', theme.colors.success);
  root.style.setProperty('--success-text', theme.colors.successText);
  root.style.setProperty('--hud-overlay', theme.colors.hudOverlay);
  root.style.setProperty('--hud-text', theme.colors.hudText);
  root.style.setProperty('--hud-border', theme.colors.hudBorder);
  root.style.setProperty('--font-sans', theme.typography.fontSans);
  root.style.setProperty('--font-mono', theme.typography.fontMono);
  root.style.setProperty('--radius-card', theme.radius.card);
  root.style.setProperty('--radius-control', theme.radius.control);
}
