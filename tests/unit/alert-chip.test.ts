import { describe, expect, it } from 'vitest'
import { alertChip } from '@/lib/domain/alert-chip'

const at = new Date('2026-10-02T04:47:00Z')
const later = (ms: number) => new Date(at.getTime() + ms)

describe('alertChip', () => {
  it('알림이 없으면 언제든', () => {
    expect(alertChip(at, null)).toEqual({ label: '오늘 안에 언제든', counting: false })
  })

  it('알림 전이면 언제든', () => {
    expect(alertChip(later(-1000), at)).toEqual({ label: '오늘 안에 언제든', counting: false })
  })

  it('알림 순간에는 2:00', () => {
    expect(alertChip(at, at)).toEqual({ label: '2:00 남음', counting: true })
  })

  it('8초 뒤에는 1:52', () => {
    expect(alertChip(later(8000), at)).toEqual({ label: '1:52 남음', counting: true })
  })

  it('2분이 지나면 언제든', () => {
    expect(alertChip(later(120_000), at)).toEqual({ label: '오늘 안에 언제든', counting: false })
  })
})
