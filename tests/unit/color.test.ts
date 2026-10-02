import { describe, expect, it } from 'vitest'
import { fromHex, hslToRgb, rgbToHsl, toHex, type Rgb } from '@/lib/image/color'

describe('color', () => {
  it('rgbToHsl: 목업 하늘색 #9CC3E4', () => {
    const { h, s, l } = rgbToHsl([156, 195, 228])
    expect(h).toBeCloseTo(207.5, 0)
    expect(s).toBeCloseTo(0.57, 2)
    expect(l).toBeCloseTo(0.753, 2)
  })

  it('rgbToHsl: 무채색은 채도 0', () => {
    expect(rgbToHsl([128, 128, 128])).toEqual({ h: 0, s: 0, l: 128 / 255 })
  })

  it('hslToRgb는 rgbToHsl의 역함수', () => {
    const samples: Rgb[] = [[156, 195, 228], [242, 184, 162], [132, 148, 198], [10, 15, 30], [255, 255, 255], [0, 0, 0]]
    for (const rgb of samples) expect(hslToRgb(rgbToHsl(rgb))).toEqual(rgb)
  })

  it('toHex는 대문자, fromHex는 역변환', () => {
    expect(toHex([156, 195, 228])).toBe('#9CC3E4')
    expect(toHex([0, 10, 255])).toBe('#000AFF')
    expect(fromHex('#9CC3E4')).toEqual([156, 195, 228])
    expect(fromHex('#9cc3e4')).toEqual([156, 195, 228])
  })
})
