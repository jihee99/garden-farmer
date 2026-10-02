import { describe, expect, it } from 'vitest'
import { colorName } from '@/lib/image/color-name'

describe('colorName', () => {
  it.each([
    ['#9CC3E4', '맑은 물빛'],
    ['#4F86B8', '푸른 하늘빛'],
    ['#8494C6', '깊은 파란빛'],
    ['#2B3963', '밤 남색빛'],
    ['#F2CE8C', '노을 살구빛'],
    ['#F2B8A2', '노을 다홍빛'],
    ['#C7B2DE', '저녁 보랏빛'],
    ['#E9A9BD', '노을 분홍빛'],
    ['#EEEEEE', '구름 흰빛'],
    ['#8A8A8A', '흐린 잿빛'],
  ])('%s → %s', (hex, name) => {
    expect(colorName(hex)).toBe(name)
  })
})
