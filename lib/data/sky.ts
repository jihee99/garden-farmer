import type { DbClient } from './client'
import { AppError, toAppError } from './errors'

export const SKY_BUCKET = 'skies'
const SIGNED_URL_SECONDS = 60 * 60

export function skyImagePath(userId: string, localDate: string, ext: 'jpg' | 'png' = 'jpg'): string {
  return `${userId}/${localDate}/${crypto.randomUUID()}.${ext}`
}

export async function uploadSkyImage(db: DbClient, path: string, image: Blob): Promise<void> {
  const { error } = await db.storage.from(SKY_BUCKET).upload(path, image, { contentType: image.type || 'image/jpeg' })
  if (error) throw new AppError('upload_failed', { cause: error })
}

export type PlantSkyInput = { imagePath: string; color: string; note: string | null; gardenIds: string[] }

export async function plantSky(db: DbClient, input: PlantSkyInput): Promise<{ photoId: string; oldImagePath: string | null }> {
  const { data, error } = await db.rpc('plant_sky', {
    p_image_path: input.imagePath,
    p_color: input.color.toUpperCase(),
    p_note: input.note ?? '', // 서버가 빈 문자열을 null로 바꾼다
    p_garden_ids: input.gardenIds,
  })
  if (error) throw toAppError(error)
  const row = data[0]
  // 생성 타입은 old_image_path를 string으로 적지만 첫 심기에서는 null이다.
  return { photoId: row.photo_id, oldImagePath: (row.old_image_path as string | null) ?? null }
}

export async function setPlantings(db: DbClient, photoId: string, gardenIds: string[]): Promise<void> {
  const { error } = await db.rpc('set_plantings', { p_photo: photoId, p_garden_ids: gardenIds })
  if (error) throw toAppError(error)
}

export async function deleteSky(db: DbClient, photoId: string): Promise<string> {
  const { data, error } = await db.rpc('delete_sky', { p_photo: photoId })
  if (error) throw toAppError(error)
  return data
}

/** 더 이상 쓰이지 않는 사진 파일을 지운다. 실패해도 사용자 흐름은 막지 않는다(고아 파일 허용). */
export async function removeSkyImage(db: DbClient, path: string | null): Promise<void> {
  if (!path) return
  try {
    const { error } = await db.storage.from(SKY_BUCKET).remove([path])
    if (error) console.warn('[sky] 사진 파일 삭제 실패', path, error)
  } catch (err) {
    console.warn('[sky] 사진 파일 삭제 실패', path, err)
  }
}

export async function signedSkyUrl(db: DbClient, path: string): Promise<string | null> {
  const { data, error } = await db.storage.from(SKY_BUCKET).createSignedUrl(path, SIGNED_URL_SECONDS)
  if (error) {
    console.warn('[sky] signed URL 실패', path, error)
    return null
  }
  return data?.signedUrl ?? null
}

export type TodaySky = { id: string; imagePath: string; color: string; note: string | null; gardenIds: string[] }

export async function getTodaySky(db: DbClient, userId: string, localDate: string): Promise<TodaySky | null> {
  const { data, error } = await db
    .from('sky_photos')
    .select('id, image_path, dominant_color, note, plantings(garden_id)')
    .eq('user_id', userId)
    .eq('local_date', localDate)
    .maybeSingle()
  if (error) throw toAppError(error)
  if (!data) return null
  return {
    id: data.id,
    imagePath: data.image_path,
    color: data.dominant_color,
    note: data.note,
    gardenIds: data.plantings.map((p) => p.garden_id),
  }
}
