import { config } from 'dotenv'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { SEED_USERS } from '../lib/dev/seed-users'
import { seoulDate } from '../lib/domain/date'
import { gradientPng } from './lib/png'

config({ path: '.env.local' })

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
const secretKey = process.env.SUPABASE_SECRET_KEY
const password = process.env.DEV_SEED_PASSWORD

if (process.env.NEXT_PUBLIC_DEV_LOGIN !== 'true' || !url || !publishableKey || !secretKey || !password) {
  console.error('시드는 개발 환경(.env.local에 NEXT_PUBLIC_DEV_LOGIN=true와 Supabase 키, DEV_SEED_PASSWORD)에서만 실행합니다.')
  process.exit(1)
}

const noSession = { auth: { persistSession: false, autoRefreshToken: false } }
const admin = createClient(url, secretKey, noSession)

const SKY = ['#F2B8A2', '#9CC3E4', '#B7C2CC', '#E9A9BD', '#8494C6', '#F2CE8C', '#7FB5DD', '#C7B2DE']
const SEED_IMAGE = 'seed/sky.png'

function rnd(seed: number) {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453
  return x - Math.floor(x)
}

async function ensureUsers() {
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 })
  if (error) throw error
  const ids = new Map(data.users.map((u) => [u.email, u.id]))
  for (const u of SEED_USERS) {
    if (ids.has(u.email)) continue
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: u.email,
      password,
      email_confirm: true,
      user_metadata: { nickname: u.nickname },
    })
    if (createError) throw createError
    ids.set(u.email, created.user.id)
    console.log(`계정 생성: ${u.nickname}`)
  }
  return SEED_USERS.map((u) => ids.get(u.email)!)
}

async function signIn(email: string): Promise<SupabaseClient> {
  const client = createClient(url!, publishableKey!, noSession)
  const { error } = await client.auth.signInWithPassword({ email, password: password! })
  if (error) throw error
  return client
}

async function ensureGroup(owner: SupabaseClient, name: string, size: 2 | 8, joiners: SupabaseClient[]) {
  const { data: existing, error: findError } = await owner.from('gardens').select('id, invite_code').eq('name', name).maybeSingle()
  if (findError) throw findError
  let inviteCode: string
  if (existing) {
    inviteCode = existing.invite_code
  } else {
    const { data, error } = await owner.rpc('create_garden', { p_name: name, p_max_members: size })
    if (error) throw error
    inviteCode = data.invite_code
    console.log(`정원 생성: ${name}`)
  }
  for (const j of joiners) {
    const { error: joinError } = await j.rpc('join_garden', { p_code: inviteCode })
    if (joinError && !joinError.message.includes('already_member')) throw joinError
  }
}

async function seedHistory(userIds: string[]) {
  const today = seoulDate()
  const todayDay = Number(today.slice(8))
  const monthPrefix = today.slice(0, 8)

  const { error: uploadError } = await admin.storage
    .from('skies')
    .upload(SEED_IMAGE, gradientPng(360, 480, [156, 195, 228], [242, 205, 187]), { contentType: 'image/png', upsert: true })
  if (uploadError) throw uploadError

  const rows: { user_id: string; local_date: string; taken_at: string; image_path: string; dominant_color: string }[] = []
  userIds.forEach((userId, m) => {
    for (let d = 1; d < todayDay; d++) {
      if (d === 9 || d === 22 || rnd(d * 7.3 + m * 1.7) <= 0.2) continue
      const date = `${monthPrefix}${String(d).padStart(2, '0')}`
      rows.push({ user_id: userId, local_date: date, taken_at: `${date}T04:00:00Z`, image_path: SEED_IMAGE, dominant_color: SKY[Math.floor(rnd(d * 5.7 + m * 2.3) * 8)] })
    }
  })
  // 오늘은 서연·민재만 심어 둔다(나는 직접 심어 보기 위해 비워 둔다).
  for (const m of [1, 2]) {
    rows.push({ user_id: userIds[m], local_date: today, taken_at: new Date().toISOString(), image_path: SEED_IMAGE, dominant_color: SKY[m] })
  }

  const { data: inserted, error } = await admin
    .from('sky_photos')
    .upsert(rows, { onConflict: 'user_id,local_date', ignoreDuplicates: true })
    .select('id, user_id, local_date')
  if (error) throw error

  const { data: memberships, error: memberError } = await admin
    .from('garden_members')
    .select('garden_id, user_id')
    .in('user_id', userIds)
  if (memberError) throw memberError

  const plantings = (inserted ?? []).flatMap((photo) =>
    memberships
      .filter((m) => m.user_id === photo.user_id)
      .map((m) => ({ garden_id: m.garden_id, sky_photo_id: photo.id, local_date: photo.local_date })),
  )
  if (plantings.length) {
    const { error: plantError } = await admin
      .from('plantings')
      .upsert(plantings, { onConflict: 'garden_id,sky_photo_id', ignoreDuplicates: true })
    if (plantError) throw plantError
  }
  console.log(`하늘 기록 ${inserted?.length ?? 0}장, 심기 ${plantings.length}건 추가`)
}

async function main() {
  const userIds = await ensureUsers()
  const [me, seoyeon, minjae, haeun, doyoon] = await Promise.all(SEED_USERS.map((u) => signIn(u.email)))
  await ensureGroup(me, '우리 둘', 2, [seoyeon])
  await ensureGroup(me, '대학 동기', 8, [seoyeon, minjae, haeun, doyoon])
  await seedHistory(userIds)
  console.log('시드 완료')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
