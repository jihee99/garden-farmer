import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { AppError } from '@/lib/data/errors'
import { listMyGardens } from '@/lib/data/gardens'
import {
  deleteSky,
  getTodaySky,
  plantSky,
  removeSkyImage,
  setPlantings,
  signedSkyUrl,
  skyImagePath,
  uploadSkyImage,
} from '@/lib/data/sky'
import { seoulDate } from '@/lib/domain/date'
import { gradientPng } from '@/scripts/lib/png'
import { admin, cleanupTestUsers, createTestUser, trackUpload, type TestUser } from './helpers'

function skyBlob() {
  return new Blob([new Uint8Array(gradientPng(8, 8, [127, 181, 221], [190, 214, 236]))], { type: 'image/png' })
}

async function objectExists(path: string) {
  const dir = path.slice(0, path.lastIndexOf('/'))
  const name = path.slice(path.lastIndexOf('/') + 1)
  const { data, error } = await admin.storage.from('skies').list(dir, { search: name })
  if (error) throw error
  return data.some((o) => o.name === name)
}

describe('lib/data 하늘 래퍼', () => {
  let me: TestUser
  let soloId: string
  let groupId: string
  const today = seoulDate()

  beforeAll(async () => {
    me = await createTestUser('래퍼')
    const { data, error } = await me.client.rpc('create_garden', { p_name: '래퍼 정원', p_max_members: 8 })
    if (error) throw error
    groupId = data.id
    const gardens = await listMyGardens(me.client)
    soloId = gardens.find((g) => g.kind === 'solo')!.id
  })
  afterAll(cleanupTestUsers)

  it('listMyGardens: 만든 순서와 인원 수', async () => {
    expect(await listMyGardens(me.client)).toEqual([
      { id: soloId, name: '나만의 정원', kind: 'solo', memberCount: 1 },
      { id: groupId, name: '래퍼 정원', kind: 'group', memberCount: 1 },
    ])
  })

  it('업로드 → 심기(소문자 색은 대문자로) → 오늘 하늘 조회 → signed URL', async () => {
    expect(await getTodaySky(me.client, me.id, today)).toBeNull()

    const path = skyImagePath(me.id, today, 'png')
    expect(path).toMatch(new RegExp(`^${me.id}/${today}/[0-9a-f-]{36}\\.png$`))
    await uploadSkyImage(me.client, path, skyBlob())
    trackUpload(path)

    const result = await plantSky(me.client, { imagePath: path, color: '#7fb5dd', note: null, gardenIds: [soloId, groupId] })
    expect(result.oldImagePath).toBeNull()

    const sky = await getTodaySky(me.client, me.id, today)
    expect(sky).toEqual({ id: result.photoId, imagePath: path, color: '#7FB5DD', note: null, gardenIds: expect.any(Array) })
    expect([...sky!.gardenIds].sort()).toEqual([soloId, groupId].sort())
    expect(await signedSkyUrl(me.client, path)).toMatch(/^https:\/\//)
  })

  it('다시 심으면 옛 경로를 돌려주고, removeSkyImage가 지운다', async () => {
    const before = (await getTodaySky(me.client, me.id, today))!
    const path = skyImagePath(me.id, today, 'png')
    await uploadSkyImage(me.client, path, skyBlob())
    trackUpload(path)

    const { photoId, oldImagePath } = await plantSky(me.client, {
      imagePath: path,
      color: '#F2B8A2',
      note: '노을',
      gardenIds: before.gardenIds,
    })
    expect(photoId).toBe(before.id)
    expect(oldImagePath).toBe(before.imagePath)

    await removeSkyImage(me.client, oldImagePath)
    expect(await objectExists(before.imagePath)).toBe(false)
    await removeSkyImage(me.client, null)
  })

  it('setPlantings와 deleteSky', async () => {
    const sky = (await getTodaySky(me.client, me.id, today))!
    await setPlantings(me.client, sky.id, [soloId])
    expect((await getTodaySky(me.client, me.id, today))!.gardenIds).toEqual([soloId])

    expect(await deleteSky(me.client, sky.id)).toBe(sky.imagePath)
    expect(await getTodaySky(me.client, me.id, today)).toBeNull()
  })

  it('RPC 에러는 AppError(code)로', async () => {
    const path = skyImagePath(me.id, today, 'png')
    const error = await plantSky(me.client, { imagePath: path, color: '#7FB5DD', note: null, gardenIds: [] }).catch((e) => e)
    expect(error).toBeInstanceOf(AppError)
    expect(error.code).toBe('no_gardens')
  })
})
