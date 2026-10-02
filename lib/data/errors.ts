const MESSAGES: Record<string, string> = {
  not_authenticated: '로그인이 필요해요. 다시 로그인해 주세요.',
  no_gardens: '심을 정원을 하나 이상 골라 주세요.',
  not_member: '이 정원의 멤버가 아니에요.',
  invalid_path: '날짜가 바뀌었어요. 하늘을 다시 찍어 주세요.',
  invalid_color: '하늘빛을 읽지 못했어요. 다시 찍어 주세요.',
  invalid_note: '한 줄은 60자까지 남길 수 있어요.',
  not_owner: '내 하늘만 바꿀 수 있어요.',
  not_today: '지난 날의 하늘은 정원을 바꿀 수 없어요.',
  invalid_month: '달 정보가 올바르지 않아요.',
  invalid_name: '정원 이름은 1~20자로 지어 주세요.',
  invalid_size: '정원 크기는 둘 또는 그룹만 고를 수 있어요.',
  invalid_code: '초대 코드를 다시 확인해 주세요.',
  already_member: '이미 함께하고 있는 정원이에요.',
  garden_full: '정원이 가득 찼어요.',
  cannot_leave_solo: '나만의 정원은 나갈 수 없어요.',
  invalid_order: '꽃잎 순서를 다시 맞춰 주세요.',
  upload_failed: '사진을 올리지 못했어요. 다시 시도해 주세요.',
  image_unreadable: '사진을 읽지 못했어요. 다른 사진으로 시도해 주세요.',
}

const FALLBACK = '잠시 문제가 생겼어요. 다시 시도해 주세요.'

export function messageFor(code: string): string {
  return MESSAGES[code] ?? FALLBACK
}

/** 사용자에게 보여줄 수 있는 에러. code는 RPC 에러 코드 또는 앱 내부 코드. */
export class AppError extends Error {
  readonly code: string

  constructor(code: string, options?: { cause?: unknown }) {
    super(code, options)
    this.name = 'AppError'
    this.code = code
  }

  get userMessage(): string {
    return messageFor(this.code)
  }
}

export function toAppError(error: { message: string }): AppError {
  return new AppError(error.message, { cause: error })
}

export function userMessageOf(error: unknown): string {
  return error instanceof AppError ? error.userMessage : FALLBACK
}
