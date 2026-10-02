import { AppError } from '@/lib/data/errors'
import { fitWithin } from './size'

const MAX_SIDE = 1600
const COLOR_SAMPLE_SIDE = 64
const JPEG_QUALITY = 0.8

export type PreparedSky = { blob: Blob; colorPixels: Uint8ClampedArray }

/** (브라우저 전용) 사진 파일을 업로드용 JPEG와 대표색 표본 픽셀로 만든다. */
export async function prepareSkyImage(file: File): Promise<PreparedSky> {
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    throw new AppError('image_unreadable')
  }
  try {
    const full = fitWithin(bitmap.width, bitmap.height, MAX_SIDE)
    const fullCtx = draw(bitmap, full.width, full.height)
    const blob = await toJpeg(fullCtx)
    // 색 표본은 원본 대신 이미 줄여 둔 캔버스에서 뽑는다(메모리·속도).
    const sample = fitWithin(full.width, full.height, COLOR_SAMPLE_SIDE)
    const sampleCtx = draw(fullCtx.canvas, sample.width, sample.height)
    const colorPixels = sampleCtx.getImageData(0, 0, sample.width, sample.height).data
    release(fullCtx)
    release(sampleCtx)
    return { blob, colorPixels }
  } finally {
    bitmap.close()
  }
}

/** 캔버스 백업 메모리를 바로 돌려준다. */
function release(ctx: CanvasRenderingContext2D) {
  ctx.canvas.width = 0
  ctx.canvas.height = 0
}

function draw(source: CanvasImageSource, width: number, height: number): CanvasRenderingContext2D {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new AppError('image_unreadable')
  ctx.drawImage(source, 0, 0, width, height)
  return ctx
}

function toJpeg(ctx: CanvasRenderingContext2D): Promise<Blob> {
  return new Promise((resolve, reject) => {
    ctx.canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new AppError('image_unreadable'))),
      'image/jpeg',
      JPEG_QUALITY,
    )
  })
}
