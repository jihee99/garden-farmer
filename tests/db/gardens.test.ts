import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { admin, cleanupTestUsers, createTestUser, expectRpcError, type TestUser } from './helpers'

type Garden = { id: string; name: string; kind: string; invite_code: string; max_members: number }

async function memberOrder(client: TestUser['client'], gardenId: string) {
  const { data, error } = await client
    .from('garden_members')
    .select('user_id, petal_order')
    .eq('garden_id', gardenId)
    .order('petal_order')
  if (error) throw error
  return data.map((m) => m.user_id)
}

describe('정원 RPC', () => {
  let owner: TestUser
  let friend: TestUser
  let third: TestUser

  beforeAll(async () => {
    owner = await createTestUser('주인')
    friend = await createTestUser('친구')
    third = await createTestUser('셋째')
  })
  afterAll(cleanupTestUsers)

  it('create_garden: 그룹 정원과 6자리 코드를 만들고 만든 사람이 1번 꽃잎', async () => {
    const { data, error } = await owner.client.rpc('create_garden', { p_name: '대학 동기', p_max_members: 8 })
    expect(error).toBeNull()
    const g = data as Garden
    expect(g.kind).toBe('group')
    expect(g.max_members).toBe(8)
    expect(g.invite_code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/)
    expect(await memberOrder(owner.client, g.id)).toEqual([owner.id])
  })

  it('create_garden: 크기는 2 또는 8만, 이름은 1~20자', async () => {
    await expectRpcError(owner.client.rpc('create_garden', { p_name: '크기', p_max_members: 9 }), 'invalid_size')
    await expectRpcError(owner.client.rpc('create_garden', { p_name: '  ', p_max_members: 2 }), 'invalid_name')
  })

  it('join_garden: 소문자 코드도 받고 마지막 순서로 들어간다', async () => {
    const { data } = await owner.client.rpc('create_garden', { p_name: '참여 테스트', p_max_members: 8 })
    const g = data as Garden
    const { error } = await friend.client.rpc('join_garden', { p_code: g.invite_code.toLowerCase() })
    expect(error).toBeNull()
    expect(await memberOrder(friend.client, g.id)).toEqual([owner.id, friend.id])
    await expectRpcError(friend.client.rpc('join_garden', { p_code: g.invite_code }), 'already_member')
  })

  it('join_garden: 없는 코드와 가득 찬 정원은 거부', async () => {
    await expectRpcError(friend.client.rpc('join_garden', { p_code: '222222' }), 'invalid_code')
    const { data } = await owner.client.rpc('create_garden', { p_name: '우리 둘', p_max_members: 2 })
    const g = data as Garden
    await friend.client.rpc('join_garden', { p_code: g.invite_code })
    await expectRpcError(third.client.rpc('join_garden', { p_code: g.invite_code }), 'garden_full')
  })

  it('reorder_petals: 전원을 정확히 넘길 때만 순서를 바꾼다', async () => {
    const { data } = await owner.client.rpc('create_garden', { p_name: '순서', p_max_members: 8 })
    const g = data as Garden
    await friend.client.rpc('join_garden', { p_code: g.invite_code })
    await third.client.rpc('join_garden', { p_code: g.invite_code })

    const { error } = await friend.client.rpc('reorder_petals', {
      p_garden: g.id,
      p_user_ids: [third.id, owner.id, friend.id],
    })
    expect(error).toBeNull()
    expect(await memberOrder(owner.client, g.id)).toEqual([third.id, owner.id, friend.id])

    await expectRpcError(
      owner.client.rpc('reorder_petals', { p_garden: g.id, p_user_ids: [owner.id, friend.id] }),
      'invalid_order',
    )
    await expectRpcError(
      owner.client.rpc('reorder_petals', { p_garden: g.id, p_user_ids: [owner.id, owner.id, friend.id] }),
      'invalid_order',
    )
  })

  it('leave_garden: 나가면 순서를 다시 채우고, 마지막 사람이 나가면 정원이 사라진다', async () => {
    const { data } = await owner.client.rpc('create_garden', { p_name: '나가기', p_max_members: 8 })
    const g = data as Garden
    await friend.client.rpc('join_garden', { p_code: g.invite_code })
    await third.client.rpc('join_garden', { p_code: g.invite_code })

    expect((await owner.client.rpc('leave_garden', { p_garden: g.id })).error).toBeNull()
    const { data: rows } = await friend.client
      .from('garden_members')
      .select('user_id, petal_order')
      .eq('garden_id', g.id)
      .order('petal_order')
    expect(rows).toEqual([
      { user_id: friend.id, petal_order: 1 },
      { user_id: third.id, petal_order: 2 },
    ])
    await expectRpcError(owner.client.rpc('reorder_petals', { p_garden: g.id, p_user_ids: [friend.id, third.id] }), 'not_member')

    await friend.client.rpc('leave_garden', { p_garden: g.id })
    await third.client.rpc('leave_garden', { p_garden: g.id })
    const { data: left } = await admin.from('gardens').select('id').eq('id', g.id)
    expect(left).toEqual([])
  })

  it('leave_garden: 나만의 정원은 나갈 수 없다', async () => {
    const { data } = await owner.client.from('gardens').select('id').eq('kind', 'solo').single()
    await expectRpcError(owner.client.rpc('leave_garden', { p_garden: data!.id }), 'cannot_leave_solo')
  })
})
