const SEOUL_DATE = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** Asia/Seoul 기준 날짜를 'YYYY-MM-DD'로 돌려준다. */
export function seoulDate(d: Date = new Date()): string {
  return SEOUL_DATE.format(d)
}
