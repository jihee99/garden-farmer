import { fromHex, rgbToHsl } from './color'

/** 대표색에 붙이는 이름. 하늘정원 하늘 담기 화면의 "오늘의 하늘빛 · ○○"에 쓴다. */
export function colorName(hex: string): string {
  const { h, s, l } = rgbToHsl(fromHex(hex))
  if (l < 0.3) return '밤 남색빛'
  if (s < 0.15) return l > 0.75 ? '구름 흰빛' : '흐린 잿빛'
  if (h < 20 || h >= 345) return '노을 다홍빛'
  if (h < 45) return '노을 살구빛'
  if (h < 70) return '햇살 노란빛'
  if (h < 160) return '풀잎 초록빛'
  if (h < 190) return '청록 물빛'
  if (h < 215) return l > 0.7 ? '맑은 물빛' : '푸른 하늘빛'
  if (h < 250) return '깊은 파란빛'
  if (h < 290) return '저녁 보랏빛'
  return '노을 분홍빛'
}
