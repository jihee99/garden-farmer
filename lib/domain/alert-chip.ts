export const ALERT_WINDOW_MS = 2 * 60 * 1000

/** 하늘 알림 뒤 2분 동안은 남은 시간을, 그 밖에는 '오늘 안에 언제든'을 보여준다(업로드는 막지 않는다). */
export function alertChip(now: Date, alertAt: Date | null): { label: string; counting: boolean } {
  if (alertAt) {
    const elapsed = now.getTime() - alertAt.getTime()
    if (elapsed >= 0 && elapsed < ALERT_WINDOW_MS) {
      const seconds = Math.ceil((ALERT_WINDOW_MS - elapsed) / 1000)
      return { label: `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')} 남음`, counting: true }
    }
  }
  return { label: '오늘 안에 언제든', counting: false }
}
