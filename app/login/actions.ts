'use server'

import { redirect } from 'next/navigation'
import { SEED_USERS } from '@/lib/dev/seed-users'
import { createClient } from '@/lib/supabase/server'

export async function devLogin(formData: FormData) {
  if (process.env.NEXT_PUBLIC_DEV_LOGIN !== 'true' || !process.env.DEV_SEED_PASSWORD) {
    throw new Error('개발 로그인이 꺼져 있습니다')
  }
  const email = String(formData.get('email'))
  if (!SEED_USERS.some((u) => u.email === email)) throw new Error('알 수 없는 시드 계정')

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password: process.env.DEV_SEED_PASSWORD })
  if (error) redirect('/login?error=dev')
  redirect('/garden')
}
