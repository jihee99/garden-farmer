import { describe, expect, it } from 'vitest'
import { fitWithin } from '@/lib/image/size'

describe('fitWithin', () => {
  it('긴 변을 maxSide로 줄이고 비율을 유지한다', () => {
    expect(fitWithin(4032, 3024, 1600)).toEqual({ width: 1600, height: 1200 })
    expect(fitWithin(3024, 4032, 64)).toEqual({ width: 48, height: 64 })
  })

  it('이미 작으면 그대로', () => {
    expect(fitWithin(800, 600, 1600)).toEqual({ width: 800, height: 600 })
  })

  it('아주 가늘어도 1px 이상', () => {
    expect(fitWithin(10000, 1, 64)).toEqual({ width: 64, height: 1 })
  })
})
