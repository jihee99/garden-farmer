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
    const blob = await toJpeg(draw(bitmap, full.width, full.height))
    const sample = fitWithin(bitmap.width, bitmap.height, COLOR_SAMPLE_SIDE)
    const ctx = draw(bitmap, sample.width, sample.height)
    return { blob, colorPixels: ctx.getImageData(0, 0, sample.width, sample.height).data }
  } finally {
    bitmap.close()
  }
}

function draw(bitmap: ImageBitmap, width: number, height: number): CanvasRenderingContext2D {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new AppError('image_unreadable')
  ctx.drawImage(bitmap, 0, 0, width, height)
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
