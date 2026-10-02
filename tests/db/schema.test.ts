import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { cleanupTestUsers, createTestUser, type TestUser } from './helpers'

describe('가입 부트스트랩과 기본 RLS', () => {
  let a: TestUser
  let b: TestUser

  beforeAll(async () => {
    a = await createTestUser('에이')
    b = await createTestUser('비')
  })
  afterAll(cleanupTestUsers)

  it('가입하면 닉네임으로 profile이 생긴다', async () => {
    const { data, error } = await a.client.from('profiles').select('nickname, notify').eq('id', a.id).single()
    expect(error).toBeNull()
    expect(data).toEqual({ nickname: '에이', notify: true })
  })

  it('가입하면 나만의 정원이 생기고 꽃잎 1번이 된다', async () => {
    const { data, error } = await a.client
      .from('garden_members')
      .select('petal_order, gardens(name, kind, invite_code, max_members)')
      .eq('user_id', a.id)
    expect(error).toBeNull()
    expect(data).toEqual([
      { petal_order: 1, gardens: { name: '나만의 정원', kind: 'solo', invite_code: null, max_members: 1 } },
    ])
  })

  it('다른 사람의 정원과 프로필은 보이지 않는다', async () => {
    const { data: gardens } = await a.client.from('gardens').select('id')
    expect(gardens).toHaveLength(1)
    const { data: profiles } = await a.client.from('profiles').select('id').eq('id', b.id)
    expect(profiles).toEqual([])
  })

  it('테이블에 직접 insert할 수 없다', async () => {
    const { error } = await a.client.from('gardens').insert({ name: '몰래', kind: 'group', invite_code: 'ZZZZZZ' })
    expect(error).not.toBeNull()
  })

  it('본인 닉네임만 바꿀 수 있다', async () => {
    const { error } = await a.client.from('profiles').update({ nickname: '새이름' }).eq('id', a.id)
    expect(error).toBeNull()
    const { data } = await a.client.from('profiles').select('nickname').eq('id', a.id).single()
    expect(data?.nickname).toBe('새이름')

    const { data: others } = await a.client.from('profiles').update({ nickname: '해킹' }).eq('id', b.id).select()
    expect(others ?? []).toEqual([])
  })
})
