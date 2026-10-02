/** 개발용 테스트 계정. 비밀번호는 .env.local의 DEV_SEED_PASSWORD 하나를 공유한다. */
export const SEED_USERS = [
  { email: 'me@garden-farmer.test', nickname: '나' },
  { email: 'seoyeon@garden-farmer.test', nickname: '서연' },
  { email: 'minjae@garden-farmer.test', nickname: '민재' },
  { email: 'haeun@garden-farmer.test', nickname: '하은' },
  { email: 'doyoon@garden-farmer.test', nickname: '도윤' },
] as const
