/**
 * Подбирает оптимальное вертикальное кадрирование (object-position) для портретов NPC
 * в квадратных рамках диалогов и уведомлений, чтобы лица никогда не обрезались сверху.
 */
export function getPortraitObjectPosition(avatarUrl?: string): string {
  if (!avatarUrl) {
    return '50% 6%';
  }
  if (avatarUrl.includes('client_elderly') || avatarUrl.includes('client_lena')) {
    return '50% 17%';
  }
  return '50% 5%';
}
