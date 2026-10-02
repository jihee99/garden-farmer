import { describe, expect, it } from 'vitest'
import { AppError, messageFor, toAppError, userMessageOf } from '@/lib/data/errors'

describe('errors', () => {
  it('알려진 코드는 한국어 문구', () => {
    expect(messageFor('garden_full')).toBe('정원이 가득 찼어요.')
    expect(messageFor('invalid_note')).toBe('한 줄은 60자까지 남길 수 있어요.')
  })

  it('모르는 코드는 기본 문구', () => {
    expect(messageFor('???')).toBe('잠시 문제가 생겼어요. 다시 시도해 주세요.')
  })

  it('toAppError는 RPC 에러 메시지를 코드로 쓴다', () => {
    const e = toAppError({ message: 'not_member' })
    expect(e).toBeInstanceOf(AppError)
    expect(e.code).toBe('not_member')
    expect(e.userMessage).toBe('이 정원의 멤버가 아니에요.')
  })

  it('toAppError는 원본 에러를 cause로 보존한다', () => {
    const original = { message: 'not_member' }
    expect(toAppError(original).cause).toBe(original)
  })

  it('userMessageOf: AppError가 아니면 기본 문구', () => {
    expect(userMessageOf(new AppError('upload_failed'))).toBe('사진을 올리지 못했어요. 다시 시도해 주세요.')
    expect(userMessageOf(new TypeError('Failed to fetch'))).toBe('잠시 문제가 생겼어요. 다시 시도해 주세요.')
  })
})
