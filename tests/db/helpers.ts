import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { expect } from 'vitest'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
const secretKey = process.env.SUPABASE_SECRET_KEY!

const noSession = { auth: { persistSession: false, autoRefreshToken: false } }

/** RLS를 우회하는 관리자 클라이언트. 테스트 준비·정리에만 쓴다. */
export const admin = createClient(url, secretKey, noSession)

export type TestUser = { id: string; email: string; client: SupabaseClient }

const createdUserIds: string[] = []
const uploadedPaths: string[] = []

export async function createTestUser(nickname = '테스터'): Promise<TestUser> {
  const email = `t-${crypto.randomUUID()}@garden-farmer.test`
  const password = crypto.randomUUID()
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nickname },
  })
  if (error) throw error
  createdUserIds.push(data.user.id)

  const client = createClient(url, publishableKey, noSession)
  const { error: signInError } = await client.auth.signInWithPassword({ email, password })
  if (signInError) throw signInError
  return { id: data.user.id, email, client }
}

export function trackUpload(path: string) {
  uploadedPaths.push(path)
}

export async function cleanupTestUsers(): Promise<void> {
  const errors: string[] = []
  if (uploadedPaths.length) {
    const { error } = await admin.storage.from('skies').remove(uploadedPaths.splice(0))
    if (error) errors.push(`uploads: ${error.message}`)
  }
  const ids = createdUserIds.splice(0)
  if (ids.length) {
    const { error } = await admin.from('gardens').delete().in('created_by', ids)
    if (error) errors.push(`gardens: ${error.message}`)
    for (const id of ids) {
      const { error: userError } = await admin.auth.admin.deleteUser(id)
      if (userError) errors.push(`user ${id}: ${userError.message}`)
    }
  }
  if (errors.length) throw new Error(`cleanup failed:\n${errors.join('\n')}`)
}

export async function expectRpcError(
  p: PromiseLike<{ error: { message: string } | null }>,
  code: string,
) {
  const { error } = await p
  expect(error?.message).toBe(code)
}
