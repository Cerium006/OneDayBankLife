/**
 * Единый файл оформления (темы) приложения.
 * Все цвета, шрифты, размеры и палитра фонов-заглушек комнат хранятся здесь,
 * чтобы на финальном шаге можно было изменить весь внешний вид в одном месте.
 */

export const theme = {
  colors: {
    // Основной нейтральный фон страницы
    background: '#F4F6F8',
    // Фон карточек и рабочих панелей
    surface: '#FFFFFF',
    // Слегка затемнённая поверхность для второстепенных блоков
    surfaceMuted: '#EEF2F6',
    // Тонкая рамка для разделения блоков без визуального шума
    border: '#CBD5E1',
    // Основной тёмный цвет текста для высокой читаемости
    textPrimary: '#0F172A',
    // Вторичный цвет текста для пояснений и подсказок
    textSecondary: '#475569',
    // Главный акцентный цвет для ключевых кнопок и активного выбора
    accent: '#1D4ED8',
    // Цвет главной кнопки при наведении курсора
    accentHover: '#1E40AF',
    // Цвет текста поверх акцентной кнопки
    accentText: '#FFFFFF',
    // Цвет предупреждения и кнопки сброса прогресса
    danger: '#B91C1C',
    dangerHover: '#991B1B',
    // Цвет успешного статуса (например, пройденная роль)
    success: '#15803D',
    // Полупрозрачная подложка панелей поверх комнаты
    hudOverlay: 'rgba(15, 23, 42, 0.84)',
    hudText: '#F8FAFC',
    hudBorder: 'rgba(255, 255, 255, 0.16)',
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
    card: '10px',
    control: '8px',
  },
  // Цвета временных фонов-заглушек для комнат банка (используются под SVG-схемами)
  roomColors: {
    entrance: '#DCE7F3',
    hall: '#E2E8F0',
    counter: '#DFECE6',
    office: '#E6E4F0',
    meeting: '#EFE6DA',
    corridor: '#D8DEE6',
    server_room: '#CBD5E1',
  } as Record<string, string>,
  // Цвета подсветки кликабельных зон (hotspots) по их типу
  hotspotColors: {
    object: '#0284C7',
    npc: '#15803D',
    door: '#B45309',
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
  root.style.setProperty('--border-default', theme.colors.border);
  root.style.setProperty('--text-primary', theme.colors.textPrimary);
  root.style.setProperty('--text-secondary', theme.colors.textSecondary);
  root.style.setProperty('--accent-primary', theme.colors.accent);
  root.style.setProperty('--accent-hover', theme.colors.accentHover);
  root.style.setProperty('--accent-text', theme.colors.accentText);
  root.style.setProperty('--danger-primary', theme.colors.danger);
  root.style.setProperty('--danger-hover', theme.colors.dangerHover);
  root.style.setProperty('--success-primary', theme.colors.success);
  root.style.setProperty('--hud-overlay', theme.colors.hudOverlay);
  root.style.setProperty('--hud-text', theme.colors.hudText);
  root.style.setProperty('--hud-border', theme.colors.hudBorder);
  root.style.setProperty('--font-sans', theme.typography.fontSans);
  root.style.setProperty('--font-mono', theme.typography.fontMono);
  root.style.setProperty('--radius-card', theme.radius.card);
  root.style.setProperty('--radius-control', theme.radius.control);
}
