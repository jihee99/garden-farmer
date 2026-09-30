import { describe, expect, it } from 'vitest'
import { seoulDate } from '@/lib/domain/date'

describe('seoulDate', () => {
  it('UTC 14:59:59는 서울 기준 같은 날', () => {
    expect(seoulDate(new Date('2026-09-30T14:59:59Z'))).toBe('2026-09-30')
  })

  it('UTC 15:00:00은 서울 기준 다음 날 자정', () => {
    expect(seoulDate(new Date('2026-09-30T15:00:00Z'))).toBe('2026-10-01')
  })

  it('월·연 경계를 넘긴다', () => {
    expect(seoulDate(new Date('2026-12-31T15:30:00Z'))).toBe('2027-01-01')
  })
})
