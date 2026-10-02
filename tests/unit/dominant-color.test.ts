import { describe, expect, it } from 'vitest'
import { rgbToHsl, fromHex, type Rgb } from '@/lib/image/color'
import { dominantColor } from '@/lib/image/dominant-color'

function pixels(parts: [Rgb, number][], alpha = 255): Uint8ClampedArray {
  const out: number[] = []
  for (const [rgb, count] of parts) for (let i = 0; i < count; i++) out.push(...rgb, alpha)
  return new Uint8ClampedArray(out)
}

describe('dominantColor', () => {
  it('한 가지 색이면 그 색', () => {
    expect(dominantColor(pixels([[[156, 195, 228], 50]]))).toBe('#9CC3E4')
  })

  it('회색 건물 60% + 파란 하늘 40%면 채도 높은 하늘색', () => {
    expect(dominantColor(pixels([[[176, 176, 176], 60], [[127, 181, 221], 40]]))).toBe('#7FB5DD')
  })

  it('15% 미만의 작은 군집은 채도가 높아도 무시한다', () => {
    expect(dominantColor(pixels([[[169, 184, 198], 90], [[255, 0, 0], 10]]))).toBe('#A9B8C6')
  })

  it('반투명 픽셀(alpha < 128)은 무시한다', () => {
    const transparentRed = pixels([[[255, 0, 0], 30]], 0)
    const blue = pixels([[[127, 181, 221], 10]])
    expect(dominantColor(new Uint8ClampedArray([...transparentRed, ...blue]))).toBe('#7FB5DD')
  })

  it('어두운 밤하늘은 남색으로 보정한다(색상 220~235°는 유지)', () => {
    const { h, l } = rgbToHsl(fromHex(dominantColor(pixels([[[10, 15, 30], 20]]))))
    expect(h).toBeGreaterThanOrEqual(220)
    expect(h).toBeLessThanOrEqual(235)
    expect(l).toBeCloseTo(0.28, 1)
  })

  it('색상이 없는 검정은 228° 남색으로 보정한다', () => {
    const { h, s, l } = rgbToHsl(fromHex(dominantColor(pixels([[[0, 0, 0], 20]]))))
    expect(h).toBeCloseTo(228, -1)
    expect(s).toBeCloseTo(0.3, 1)
    expect(l).toBeCloseTo(0.28, 1)
  })

  it('픽셀이 하나도 없으면 남색 기본값', () => {
    const { l } = rgbToHsl(fromHex(dominantColor(new Uint8ClampedArray())))
    expect(l).toBeCloseTo(0.28, 1)
  })

  it('살짝 푸른 흰 구름 30%와 그림자 20%가 있어도 하늘색을 고른다', () => {
    expect(dominantColor(pixels([[[127, 181, 221], 50], [[250, 252, 255], 30], [[3, 0, 1], 20]]))).toBe('#7FB5DD')
  })

  it('아주 큰 입력도 표본을 줄여 처리한다', () => {
    expect(dominantColor(pixels([[[127, 181, 221], 200 * 200]]))).toBe('#7FB5DD')
  })
})
