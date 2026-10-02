import { hslToRgb, rgbToHsl, toHex, type Hsl, type Rgb } from './color'

const K = 3
const ITERATIONS = 10
const MIN_SHARE = 0.15
const DARK_LIGHTNESS = 0.2
const NAVY_HUE_RANGE: [number, number] = [220, 235]
const NAVY_DEFAULT_HUE = 228
const NAVY_SATURATION: [number, number] = [0.3, 0.6]
const NAVY_LIGHTNESS = 0.28

type Cluster = { center: Rgb; count: number }

/** 작게 줄인 이미지의 RGBA 픽셀에서 하늘 대표색을 대문자 #RRGGBB로 고른다. */
export function dominantColor(rgba: Uint8ClampedArray): string {
  const pixels = opaquePixels(rgba)
  if (pixels.length === 0) return toNightNavy({ h: NAVY_DEFAULT_HUE, s: 0, l: 0 })

  const clusters = kMeans(pixels).filter((c) => c.count > 0)
  const large = clusters.filter((c) => c.count / pixels.length >= MIN_SHARE)
  const candidates = large.length > 0 ? large : clusters
  const best = candidates.reduce((a, b) => {
    const sa = rgbToHsl(a.center).s
    const sb = rgbToHsl(b.center).s
    return sb > sa || (sb === sa && b.count > a.count) ? b : a
  })

  const hsl = rgbToHsl(best.center)
  return hsl.l < DARK_LIGHTNESS ? toNightNavy(hsl) : toHex(best.center)
}

function opaquePixels(rgba: Uint8ClampedArray): Rgb[] {
  const out: Rgb[] = []
  for (let i = 0; i + 3 < rgba.length; i += 4) {
    if (rgba[i + 3] >= 128) out.push([rgba[i], rgba[i + 1], rgba[i + 2]])
  }
  return out
}

function distance(a: Rgb, b: Rgb): number {
  return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2
}

function luma([r, g, b]: Rgb): number {
  return 0.299 * r + 0.587 * g + 0.114 * b
}

/** 결정적 초기값: 밝기 중앙값 픽셀에서 시작해, 이미 고른 중심들과 가장 먼 픽셀을 차례로 고른다. */
function initialCenters(pixels: Rgb[]): Rgb[] {
  const byLuma = [...pixels].sort((p, q) => luma(p) - luma(q))
  const centers: Rgb[] = [byLuma[Math.floor(byLuma.length / 2)]]
  while (centers.length < K) {
    let farthest = pixels[0]
    let farthestDistance = -1
    for (const p of pixels) {
      const d = Math.min(...centers.map((c) => distance(p, c)))
      if (d > farthestDistance) {
        farthest = p
        farthestDistance = d
      }
    }
    centers.push(farthest)
  }
  return centers
}

function kMeans(pixels: Rgb[]): Cluster[] {
  let centers = initialCenters(pixels)
  let clusters: Cluster[] = []
  for (let iteration = 0; iteration < ITERATIONS; iteration++) {
    const sums = centers.map(() => [0, 0, 0, 0])
    for (const p of pixels) {
      let nearest = 0
      let nearestDistance = Infinity
      centers.forEach((c, k) => {
        const d = distance(p, c)
        if (d < nearestDistance) {
          nearest = k
          nearestDistance = d
        }
      })
      const s = sums[nearest]
      s[0] += p[0]
      s[1] += p[1]
      s[2] += p[2]
      s[3] += 1
    }
    clusters = centers.map((c, k) => {
      const [r, g, b, n] = sums[k]
      return n === 0 ? { center: c, count: 0 } : { center: [Math.round(r / n), Math.round(g / n), Math.round(b / n)], count: n }
    })
    centers = clusters.map((c) => c.center)
  }
  return clusters
}

function toNightNavy({ h, s }: Hsl): string {
  const [minHue, maxHue] = NAVY_HUE_RANGE
  const hue = s > 0 && h >= minHue && h <= maxHue ? h : NAVY_DEFAULT_HUE
  const [minSat, maxSat] = NAVY_SATURATION
  const saturation = Math.min(maxSat, Math.max(minSat, s))
  return toHex(hslToRgb({ h: hue, s: saturation, l: NAVY_LIGHTNESS }))
}
