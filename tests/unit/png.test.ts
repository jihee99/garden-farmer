import { describe, expect, it } from 'vitest'
import { gradientPng } from '@/scripts/lib/png'

describe('gradientPng', () => {
  it('PNG 시그니처와 IHDR 크기를 쓴다', () => {
    const png = gradientPng(4, 3, [156, 195, 228], [242, 184, 162])
    expect([...png.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10])
    expect(png.subarray(12, 16).toString('ascii')).toBe('IHDR')
    expect(png.readUInt32BE(16)).toBe(4)
    expect(png.readUInt32BE(20)).toBe(3)
    expect(png.subarray(-8, -4).toString('ascii')).toBe('IEND')
  })
})
