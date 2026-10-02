import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import type { Page } from '@playwright/test'
import { seoulDate } from '../../lib/domain/date'
import type { Rgb } from '../../lib/image/color'
import { gradientPng } from '../../scripts/lib/png'

config({ path: '.env.local' })

export const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
})

export async function userId(email: string): Promise<string> {
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 })
  if (error) throw error
  const user = data.users.find((u) => u.email === email)
  if (!user) throw new Error(`시드 계정이 없습니다(${email}). 먼저 npm run seed`)
  return user.id
}

/** 시드 계정의 오늘 하늘을 지워 테스트를 반복 가능하게 한다. */
export async function clearTodaySky(uid: string) {
  const { data, error } = await admin
    .from('sky_photos')
    .select('id, image_path')
    .eq('user_id', uid)
    .eq('local_date', seoulDate())
  if (error) throw error
  for (const photo of data) {
    const { error: deleteError } = await admin.from('sky_photos').delete().eq('id', photo.id)
    if (deleteError) throw deleteError
    if (photo.image_path.startsWith(`${uid}/`)) {
      const { error: removeError } = await admin.storage.from('skies').remove([photo.image_path])
      if (removeError) throw removeError
    }
  }
}

export async function todaySkyRow(uid: string) {
  const { data, error } = await admin
    .from('sky_photos')
    .select('image_path, note, dominant_color, plantings(garden_id)')
    .eq('user_id', uid)
    .eq('local_date', seoulDate())
    .maybeSingle()
  if (error) throw error
  return data
}

export async function objectExists(path: string): Promise<boolean> {
  const dir = path.slice(0, path.lastIndexOf('/'))
  const name = path.slice(path.lastIndexOf('/') + 1)
  const { data, error } = await admin.storage.from('skies').list(dir, { search: name })
  if (error) throw error
  return data.some((o) => o.name === name)
}

export async function devLoginAs(page: Page, nickname: string) {
  await page.goto('/login')
  await page.getByRole('button', { name: nickname, exact: true }).click()
  await page.waitForURL('**/garden')
}

export function skyFile(top: Rgb) {
  return { name: 'sky.png', mimeType: 'image/png', buffer: gradientPng(360, 480, top, [236, 240, 244]) }
}
