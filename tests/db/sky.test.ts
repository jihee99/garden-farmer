import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { seoulDate } from '@/lib/domain/date'
import { gradientPng } from '@/scripts/lib/png'
import { admin, cleanupTestUsers, createTestUser, expectRpcError, trackUpload, type TestUser } from './helpers'

const today = seoulDate()
const yesterday = seoulDate(new Date(Date.now() - 24 * 60 * 60 * 1000))

async function upload(user: TestUser, date = today) {
  const path = `${user.id}/${date}/${crypto.randomUUID()}.png`
  const { error } = await user.client.storage
    .from('skies')
    .upload(path, gradientPng(8, 8, [156, 195, 228], [242, 184, 162]), { contentType: 'image/png' })
  if (error) throw error
  trackUpload(path)
  return path
}

async function soloGardenId(user: TestUser) {
  const { data, error } = await user.client.from('gardens').select('id').eq('kind', 'solo').single()
  if (error) throw error
  return data.id as string
}

async function plantedGardenIds(user: TestUser, photoId: string) {
  const { data, error } = await user.client.from('plantings').select('garden_id').eq('sky_photo_id', photoId)
  if (error) throw error
  return data.map((p) => p.garden_id).sort()
}

describe('하늘 RPC와 Storage', () => {
  let a: TestUser
  let b: TestUser
  let outsider: TestUser
  let shared: string
  let aSolo: string
  let photoId: string

  beforeAll(async () => {
    a = await createTestUser('에이')
    b = await createTestUser('비')
    outsider = await createTestUser('남')
    const { data, error } = await a.client.rpc('create_garden', { p_name: '같은 하늘', p_max_members: 2 })
    if (error) throw error
    shared = data.id
    const { error: joinError } = await b.client.rpc('join_garden', { p_code: data.invite_code })
    if (joinError) throw joinError
    aSolo = await soloGardenId(a)
  })
  afterAll(cleanupTestUsers)

  it('plant_sky: 오늘 날짜로 사진을 만들고 선택한 정원에 심는다', async () => {
    const path = await upload(a)
    const { data, error } = await a.client.rpc('plant_sky', {
      p_image_path: path,
      p_color: '#9CC3E4',
      p_note: ' 점심 하늘 ',
      p_garden_ids: [aSolo, shared],
    })
    expect(error).toBeNull()
    expect(data[0].old_image_path).toBeNull()
    photoId = data[0].photo_id

    const { data: photo } = await a.client.from('sky_photos').select('local_date, dominant_color, note').eq('id', photoId).single()
    expect(photo).toEqual({ local_date: today, dominant_color: '#9CC3E4', note: '점심 하늘' })
    expect(await plantedGardenIds(a, photoId)).toEqual([aSolo, shared].sort())
  })

  it('plant_sky: 입력 검증', async () => {
    const path = await upload(a)
    const base = { p_image_path: path, p_color: '#9CC3E4', p_note: null, p_garden_ids: [aSolo] }
    await expectRpcError(a.client.rpc('plant_sky', { ...base, p_garden_ids: [] }), 'no_gardens')
    await expectRpcError(a.client.rpc('plant_sky', { ...base, p_garden_ids: [await soloGardenId(b)] }), 'not_member')
    await expectRpcError(a.client.rpc('plant_sky', { ...base, p_image_path: `${b.id}/${today}/x.png` }), 'invalid_path')
    await expectRpcError(a.client.rpc('plant_sky', { ...base, p_color: 'blue' }), 'invalid_color')
  })

  it('plant_sky: 경로는 본인/오늘/uuid.확장자만, 메모는 60자까지', async () => {
    const good = await upload(a)
    const base = { p_image_path: good, p_color: '#9CC3E4', p_note: null, p_garden_ids: [aSolo] }
    await expectRpcError(
      a.client.rpc('plant_sky', { ...base, p_image_path: `${a.id}/${yesterday}/${crypto.randomUUID()}.png` }),
      'invalid_path',
    )
    await expectRpcError(a.client.rpc('plant_sky', { ...base, p_image_path: `${a.id}/${today}/x.png` }), 'invalid_path')
    await expectRpcError(
      a.client.rpc('plant_sky', { ...base, p_image_path: `${a.id}/${today}/${crypto.randomUUID()}.gif` }),
      'invalid_path',
    )
    await expectRpcError(a.client.rpc('plant_sky', { ...base, p_note: '가'.repeat(61) }), 'invalid_note')
  })

  it('plant_sky: 같은 날 다시 심으면 같은 사진을 교체하고 예전 경로를 돌려준다', async () => {
    const { data: before } = await a.client.from('sky_photos').select('image_path').eq('id', photoId).single()
    const newPath = await upload(a)
    const { data, error } = await a.client.rpc('plant_sky', {
      p_image_path: newPath,
      p_color: '#F2B8A2',
      p_note: null,
      p_garden_ids: [aSolo, shared],
    })
    expect(error).toBeNull()
    expect(data[0].photo_id).toBe(photoId)
    expect(data[0].old_image_path).toBe(before!.image_path)
    expect(await plantedGardenIds(a, photoId)).toEqual([aSolo, shared].sort())
  })

  it('같은 정원 멤버는 사진과 파일을 보고, 바깥 사람은 못 본다', async () => {
    const { data: seen } = await b.client.from('sky_photos').select('image_path').eq('id', photoId).single()
    expect(seen).not.toBeNull()
    const signed = await b.client.storage.from('skies').createSignedUrl(seen!.image_path, 60)
    expect(signed.error).toBeNull()

    const { data: hidden } = await outsider.client.from('sky_photos').select('id').eq('id', photoId)
    expect(hidden).toEqual([])
    const denied = await outsider.client.storage.from('skies').createSignedUrl(seen!.image_path, 60)
    expect(denied.error).not.toBeNull()
  })

  it('get_month: 멤버에게 그달 기록을 돌려주고, 바깥 사람은 거부', async () => {
    const { data, error } = await b.client.rpc('get_month', { p_garden: shared, p_month: today.slice(0, 7) })
    expect(error).toBeNull()
    expect(data).toEqual([{ local_date: today, user_id: a.id, dominant_color: '#F2B8A2' }])
    await expectRpcError(outsider.client.rpc('get_month', { p_garden: shared, p_month: today.slice(0, 7) }), 'not_member')
    await expectRpcError(b.client.rpc('get_month', { p_garden: shared, p_month: '2026-13' }), 'invalid_month')
  })

  it('set_plantings: 오늘 사진의 정원을 바꾸면 빠진 정원 멤버는 더 못 본다', async () => {
    expect((await a.client.rpc('set_plantings', { p_photo: photoId, p_garden_ids: [aSolo] })).error).toBeNull()
    expect(await plantedGardenIds(a, photoId)).toEqual([aSolo])
    const { data } = await b.client.from('sky_photos').select('id').eq('id', photoId)
    expect(data).toEqual([])
    await expectRpcError(b.client.rpc('set_plantings', { p_photo: photoId, p_garden_ids: [shared] }), 'not_owner')
  })

  it('지난 날 사진: 정원 변경은 거부, 빼기와 지우기는 허용', async () => {
    const { data: past, error } = await admin
      .from('sky_photos')
      .insert({ user_id: a.id, local_date: yesterday, taken_at: new Date().toISOString(), image_path: `${a.id}/${yesterday}/old.png`, dominant_color: '#8494C6' })
      .select('id')
      .single()
    if (error) throw error
    await admin.from('plantings').insert([
      { garden_id: aSolo, sky_photo_id: past.id, local_date: yesterday },
      { garden_id: shared, sky_photo_id: past.id, local_date: yesterday },
    ])

    await expectRpcError(a.client.rpc('set_plantings', { p_photo: past.id, p_garden_ids: [aSolo] }), 'not_today')

    expect((await a.client.rpc('unplant', { p_photo: past.id, p_garden: shared })).error).toBeNull()
    expect(await plantedGardenIds(a, past.id)).toEqual([aSolo])

    await expectRpcError(b.client.rpc('delete_sky', { p_photo: past.id }), 'not_owner')
    const { data: removedPath, error: delError } = await a.client.rpc('delete_sky', { p_photo: past.id })
    expect(delError).toBeNull()
    expect(removedPath).toBe(`${a.id}/${yesterday}/old.png`)
    const { data: gone } = await a.client.from('sky_photos').select('id').eq('id', past.id)
    expect(gone).toEqual([])
  })

  it('Storage: 남의 폴더에는 올릴 수 없다', async () => {
    const { error } = await outsider.client.storage
      .from('skies')
      .upload(`${a.id}/${today}/intrude.png`, gradientPng(2, 2, [0, 0, 0], [0, 0, 0]), { contentType: 'image/png' })
    expect(error).not.toBeNull()
  })
  it('plant_sky: 같은 날 동시에 두 번 심어도 에러 코드 없이 한 장만 남는다', async () => {
    const c = await createTestUser('씨')
    const cSolo = await soloGardenId(c)
    const [p1, p2] = [await upload(c), await upload(c)]
    const args = (path: string) => ({ p_image_path: path, p_color: '#9CC3E4', p_note: null, p_garden_ids: [cSolo] })
    const [r1, r2] = await Promise.all([c.client.rpc('plant_sky', args(p1)), c.client.rpc('plant_sky', args(p2))])
    expect(r1.error).toBeNull()
    expect(r2.error).toBeNull()
    const id1 = (r1.data as { photo_id: string }[])[0].photo_id
    const id2 = (r2.data as { photo_id: string }[])[0].photo_id
    expect(id1).toBe(id2)
    const { data: rows } = await c.client.from('sky_photos').select('id').eq('local_date', today)
    expect(rows).toHaveLength(1)
  })

  it('get_month: 정원이 null이면 not_member', async () => {
    await expectRpcError(a.client.rpc('get_month', { p_garden: null, p_month: today.slice(0, 7) }), 'not_member')
  })
})
