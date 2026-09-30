# 계획 1: 기반 (뼈대 + DB) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Next.js PWA 뼈대와 Supabase 스키마·RLS·RPC를 갖추고, 개발용 테스트 계정으로 로그인해 내 정원 목록이 보이는 상태를 만든다.

**Architecture:** 클라이언트 중심 + DB 로직. Next 16 `proxy.ts`가 `@supabase/ssr` 세션을 갱신하고, 모든 쓰기 규칙은 Postgres RPC(security definer)와 RLS가 담당한다. 순수 로직은 `lib/domain`에 두고 Vitest로 테스트하며, DB 규칙은 dev 클라우드 프로젝트를 대상으로 Vitest 통합 테스트로 검증한다.

**Tech Stack:** Next.js 16 (App Router, TypeScript), React 19, Tailwind CSS 4, @supabase/supabase-js 2 + @supabase/ssr, Supabase CLI(npx), Vitest 5, tsx, dotenv

**설계 문서:** `docs/superpowers/specs/2026-09-30-sky-garden-design.md`

**전체 로드맵 (계획 파일은 단계별로 작성):**
1. **기반 — 이 문서** (설계 1a + 2)
2. 하늘 담기 (설계 3단계)
3. 정원 홈·하루 상세 (설계 4단계)
4. 그룹 (설계 5단계)
5. 실로그인·배포 (설계 1b) — 카카오 앱·prod 프로젝트·Vercel 준비 후
6. 알림 (설계 6단계)
7. 공유 카드 (설계 7단계)
8. 다듬기 (설계 8단계)

## Global Constraints

- 저장소 루트: `C:\Users\JBT\project\garden-farmer` — 모든 명령은 여기서 실행 (Git Bash 기준). 커밋 작성자는 저장소 로컬 설정(`jihee <oosoojh31@gmail.com>`)을 그대로 쓴다.
- 날짜 기준: Asia/Seoul 자정. DB에서는 `(now() at time zone 'Asia/Seoul')::date`.
- 사용자당 하루 하늘 1장(`unique(user_id, local_date)`), 정원 최대 8명, solo 정원은 1명·초대 코드 없음.
- 모든 쓰기는 RPC로만. 테이블 직접 insert/update/delete 정책을 만들지 않는다(예외: `profiles`의 `nickname`, `notify`, `avatar_url` 본인 수정, `push_subscriptions` 본인 관리).
- RPC 에러는 `raise exception '<code>'` 형태로, 클라이언트에서 `error.message === '<code>'`로 식별한다.
- 초대 코드: `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` 중 6자리.
- 이미지 경로(버킷 `skies` 내부): `{uid}/{local_date}/{uuid}.jpg`. 첫 세그먼트는 반드시 본인 uid.
- 비밀값(`SUPABASE_SECRET_KEY`, `DEV_SEED_PASSWORD`)은 `.env.local`에만 두고 `NEXT_PUBLIC_` 접두사를 붙이지 않는다.
- 개발 로그인은 `NEXT_PUBLIC_DEV_LOGIN === 'true'`일 때만 노출·동작한다.
- 디자인 토큰(설계 8장/SPEC 8장): paper #F7F2E9, card rgba(255,253,248,0.82), line #E6DDCD, ink #35322D, muted #6E675C, sky-deep #4F7299, wash-blue #BCD6EC, wash-blush #F2CBBE, gold #E0A73E, stone #CBC3B5, sprout #9DBB86. 제목 Gowun Batang, 본문 Gowun Dodum. 터치 영역 최소 44px.

---

## File Structure

| 파일 | 책임 |
|---|---|
| `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `vitest.config.ts` | 도구 설정 |
| `.env.example` | 필요한 환경변수 이름 목록(값 없음) |
| `app/globals.css` | Tailwind 4 + 디자인 토큰 |
| `app/layout.tsx` | 폰트, 메타데이터, 서비스워커 등록 |
| `app/page.tsx` | `/garden`으로 리다이렉트 |
| `app/login/page.tsx`, `app/login/actions.ts` | 로그인 화면, 개발 로그인 서버 액션 |
| `app/auth/callback/route.ts` | OAuth 코드 교환 |
| `app/(app)/garden/page.tsx` | (임시) 내 정원 목록 — 계획 3에서 정원 홈으로 교체 |
| `app/manifest.ts`, `app/icons/[size]/route.tsx`, `app/apple-icon.tsx`, `app/icon.tsx` | PWA manifest·아이콘 |
| `components/KakaoLoginButton.tsx`, `components/DevLogin.tsx`, `components/ServiceWorkerRegister.tsx` | 로그인 버튼, 개발 로그인, SW 등록 |
| `lib/domain/date.ts` | Asia/Seoul 날짜 문자열 |
| `lib/dev/seed-users.ts` | 시드 계정 목록(시드 스크립트와 개발 로그인 공용) |
| `lib/auth/actions.ts` | 로그아웃 서버 액션 |
| `lib/pwa/icon.tsx` | 아이콘 그림(ImageResponse용) |
| `lib/supabase/{client,server,proxy}.ts`, `lib/supabase/database.types.ts` | Supabase 클라이언트, 생성된 타입 |
| `proxy.ts` | 세션 갱신·미로그인 리다이렉트 |
| `public/sw.js` | 서비스워커(이번 계획에선 생명주기만) |
| `supabase/migrations/20260930000100_schema.sql` | 테이블, 헬퍼, RLS, 가입 트리거 |
| `supabase/migrations/20260930000200_garden_rpcs.sql` | 정원 RPC |
| `supabase/migrations/20260930000300_sky_rpcs_storage.sql` | 하늘 RPC, Storage 버킷·정책 |
| `scripts/lib/png.ts` | 의존성 없는 그라디언트 PNG 인코더(시드·테스트용) |
| `scripts/seed.ts` | 개발 시드 |
| `tests/unit/*.test.ts` | 순수 로직 테스트 |
| `tests/db/setup-env.ts`, `tests/db/helpers.ts`, `tests/db/*.test.ts` | DB 통합 테스트 |

---

### Task 1: Next.js 뼈대 + 토큰·폰트 + Vitest + 서울 날짜

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `vitest.config.ts`, `.env.example`
- Create: `app/globals.css`, `app/layout.tsx`, `app/page.tsx`
- Create: `lib/domain/date.ts`
- Test: `tests/unit/date.test.ts`

**Interfaces:**
- Produces: `seoulDate(d?: Date): string` — `'YYYY-MM-DD'` (Asia/Seoul). npm 스크립트 `test`, `test:db`, `typecheck`, `build`, `seed`, `db:push`, `db:types`. 경로 별칭 `@/*` → 저장소 루트.

- [ ] **Step 1: `package.json` 작성**

```json
{
  "name": "garden-farmer",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "typecheck": "tsc --noEmit",
    "test": "vitest run --project unit",
    "test:db": "vitest run --project db",
    "seed": "tsx scripts/seed.ts",
    "db:push": "supabase db push",
    "db:types": "supabase gen types typescript --linked > lib/supabase/database.types.ts"
  }
}
```

- [ ] **Step 2: 의존성 설치**

```bash
npm install next@^16 react@^19 react-dom@^19 @supabase/supabase-js@^2 @supabase/ssr
npm install -D typescript @types/node @types/react @types/react-dom tailwindcss@^4 @tailwindcss/postcss vitest dotenv tsx supabase
```
Expected: 두 명령 모두 `added N packages`, 에러 없음.

- [ ] **Step 3: 설정 파일 작성**

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "react-jsx",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

`next.config.ts`:
```ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
        ],
      },
    ]
  },
}

export default nextConfig
```

`postcss.config.mjs`:
```js
export default {
  plugins: { '@tailwindcss/postcss': {} },
}
```

`vitest.config.ts`:
```ts
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./', import.meta.url)) },
  },
  test: {
    projects: [
      {
        extends: true,
        test: { name: 'unit', include: ['tests/unit/**/*.test.ts'], environment: 'node' },
      },
      {
        extends: true,
        test: {
          name: 'db',
          include: ['tests/db/**/*.test.ts'],
          environment: 'node',
          setupFiles: ['tests/db/setup-env.ts'],
          testTimeout: 30_000,
          hookTimeout: 60_000,
          fileParallelism: false,
        },
      },
    ],
  },
})
```

`.env.example`:
```
# Supabase dev 프로젝트 (Project Settings → API Keys)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=

# 개발 로그인 (프로덕션에는 설정하지 않는다)
NEXT_PUBLIC_DEV_LOGIN=true
DEV_SEED_PASSWORD=
```

- [ ] **Step 4: 실패하는 날짜 테스트 작성**

`tests/unit/date.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { seoulDate } from '@/lib/domain/date'

describe('seoulDate', () => {
  it('UTC 14:59:59는 서울 기준 같은 날', () => {
    expect(seoulDate(new Date('2026-09-30T14:59:59Z'))).toBe('2026-09-30')
  })

  it('UTC 15:00:00은 서울 기준 다음 날 자정', () => {
    expect(seoulDate(new Date('2026-09-30T15:00:00Z'))).toBe('2026-10-01')
  })

  it('월·연 경계를 넘긴다', () => {
    expect(seoulDate(new Date('2026-12-31T15:30:00Z'))).toBe('2027-01-01')
  })
})
```

- [ ] **Step 5: 실패 확인**

Run: `npm test`
Expected: FAIL — `Cannot find module '@/lib/domain/date'` 또는 해석 실패.

- [ ] **Step 6: 구현**

`lib/domain/date.ts`:
```ts
const SEOUL_DATE = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** Asia/Seoul 기준 날짜를 'YYYY-MM-DD'로 돌려준다. */
export function seoulDate(d: Date = new Date()): string {
  return SEOUL_DATE.format(d)
}
```

- [ ] **Step 7: 통과 확인**

Run: `npm test`
Expected: `Test Files  1 passed`, `Tests  3 passed`.

- [ ] **Step 8: 토큰·레이아웃·첫 페이지 작성**

`app/globals.css`:
```css
@import "tailwindcss";

@theme {
  --color-paper: #F7F2E9;
  --color-card: rgb(255 253 248 / 0.82);
  --color-line: #E6DDCD;
  --color-ink: #35322D;
  --color-muted: #6E675C;
  --color-sky-deep: #4F7299;
  --color-wash-blue: #BCD6EC;
  --color-wash-blush: #F2CBBE;
  --color-gold: #E0A73E;
  --color-stone: #CBC3B5;
  --color-sprout: #9DBB86;
}

@theme inline {
  --font-serif: var(--font-gowun-batang), serif;
  --font-sans: var(--font-gowun-dodum), sans-serif;
}

html,
body {
  background: var(--color-paper);
  color: var(--color-ink);
}

body {
  font-family: var(--font-sans);
  -webkit-tap-highlight-color: transparent;
}
```

`app/layout.tsx`:
```tsx
import type { Metadata, Viewport } from 'next'
import { Gowun_Batang, Gowun_Dodum } from 'next/font/google'
import './globals.css'

const batang = Gowun_Batang({
  weight: ['400', '700'],
  subsets: ['latin'],
  variable: '--font-gowun-batang',
  display: 'swap',
})

const dodum = Gowun_Dodum({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-gowun-dodum',
  display: 'swap',
})

export const metadata: Metadata = {
  title: '하늘정원',
  description: '하루 한 번, 지금 보이는 하늘색으로 피우는 꽃',
  appleWebApp: { capable: true, title: '하늘정원', statusBarStyle: 'default' },
}

export const viewport: Viewport = {
  themeColor: '#F7F2E9',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={`${batang.variable} ${dodum.variable}`}>
      <body>{children}</body>
    </html>
  )
}
```

`app/page.tsx` (Task 5에서 리다이렉트로 교체):
```tsx
export default function Home() {
  return (
    <main className="flex min-h-dvh flex-col justify-center gap-2 px-5">
      <h1 className="font-serif text-3xl font-bold">하늘정원</h1>
      <p className="text-muted">하루 한 번, 지금 보이는 하늘을 심어요</p>
      <div className="mt-4 h-11 w-11 rounded-full bg-sky-deep" aria-label="토큰 확인용 원" />
    </main>
  )
}
```

- [ ] **Step 9: 타입 검사·빌드 확인**

Run: `npm run typecheck && npm run build`
Expected: 타입 에러 없음, `✓ Compiled successfully`, 라우트 목록에 `/` 포함.

- [ ] **Step 10: 화면 확인**

Run: `npm run dev` (백그라운드) 후 브라우저로 `http://localhost:3000` 확인.
Expected: 종이색(#F7F2E9) 배경, "하늘정원" 제목이 Gowun Batang(붓 느낌 명조), 본문이 Gowun Dodum으로 보이고 파란 원(#4F7299)이 보인다. 한글이 시스템 기본 글꼴로 보이면 `layout.tsx`의 두 폰트에 `preload: false`를 추가하고 다시 확인한다.

- [ ] **Step 11: Commit**

```bash
git add package.json package-lock.json tsconfig.json next.config.ts postcss.config.mjs vitest.config.ts .env.example app lib tests
git commit -m "feat: Next.js 뼈대, 디자인 토큰·폰트, Vitest, 서울 날짜 유틸"
```

---

### Task 2: Supabase dev 연결 + 스키마·RLS·가입 트리거

**Files:**
- Create: `supabase/config.toml` (CLI 생성), `supabase/migrations/20260930000100_schema.sql`
- Create: `lib/supabase/database.types.ts` (생성)
- Create: `tests/db/setup-env.ts`, `tests/db/helpers.ts`
- Test: `tests/db/schema.test.ts`

**Interfaces:**
- Consumes: Task 1 npm 스크립트
- Produces:
  - 테이블 `profiles`, `gardens`, `garden_members`, `sky_photos`, `plantings`, `push_subscriptions`, `daily_alerts` (설계 4장 + `gardens.created_by on delete set null`)
  - SQL 함수 `public.is_member(g uuid) → boolean`, `public.shares_garden(other uuid) → boolean`, `public.can_see_photo(p uuid) → boolean`, `public.seoul_today() → date`
  - 테스트 헬퍼 `createTestUser(nickname?: string): Promise<TestUser>` (`TestUser = { id: string; email: string; client: SupabaseClient }`), `admin: SupabaseClient`, `trackUpload(path: string): void`, `cleanupTestUsers(): Promise<void>`, `expectRpcError(p: PromiseLike<{ error: { message: string } | null }>, code: string): Promise<void>`

- [ ] **Step 1: (사용자 수행) dev 프로젝트 만들기와 연결**

사람이 직접 한다 — 계정 로그인·비밀값 입력이 필요하다.
1. https://supabase.com 에서 새 프로젝트 `garden-farmer-dev` 생성(리전 Northeast Asia (Seoul)). DB 비밀번호를 안전한 곳에 보관.
2. `cp .env.example .env.local` 후 Project Settings → API Keys의 URL, publishable key, secret key를 채운다.
3. 시드 비밀번호 생성:
   ```bash
   node -e "console.log('DEV_SEED_PASSWORD=' + require('crypto').randomBytes(18).toString('base64url'))" >> .env.local
   ```
   (`.env.local`에 빈 `DEV_SEED_PASSWORD=` 줄이 남아 있으면 지운다.)
4. Authentication → Rate Limits에서 "sign-ups and sign-ins" 한도를 넉넉히(예: 300/5분) 올린다 — 통합 테스트가 임시 사용자로 여러 번 로그인한다.
5. CLI 로그인과 연결:
   ```bash
   npx supabase init
   npx supabase login
   npx supabase link --project-ref <dev 프로젝트 ref>
   ```
Expected: `Finished supabase link.`

- [ ] **Step 2: 테스트 환경·헬퍼 작성**

`tests/db/setup-env.ts`:
```ts
import { config } from 'dotenv'

config({ path: '.env.local' })

for (const key of ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_SECRET_KEY']) {
  if (!process.env[key]) throw new Error(`${key}가 .env.local에 없습니다`)
}
```

`tests/db/helpers.ts`:
```ts
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

export async function cleanupTestUsers() {
  if (uploadedPaths.length) await admin.storage.from('skies').remove(uploadedPaths.splice(0))
  const ids = createdUserIds.splice(0)
  if (!ids.length) return
  await admin.from('gardens').delete().in('created_by', ids)
  for (const id of ids) {
    const { error } = await admin.auth.admin.deleteUser(id)
    if (error) throw error
  }
}

export async function expectRpcError(
  p: PromiseLike<{ error: { message: string } | null }>,
  code: string,
) {
  const { error } = await p
  expect(error?.message).toBe(code)
}
```

- [ ] **Step 3: 실패하는 스키마 테스트 작성**

`tests/db/schema.test.ts`:
```ts
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
```

- [ ] **Step 4: 실패 확인**

Run: `npm run test:db`
Expected: FAIL — `relation "public.profiles" does not exist` 류 에러(가입 자체는 성공하지만 조회가 실패).

- [ ] **Step 5: 스키마 마이그레이션 작성**

`supabase/migrations/20260930000100_schema.sql`:
```sql
-- 하늘정원 스키마: 테이블, 헬퍼, RLS, 가입 트리거

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null check (char_length(nickname) between 1 and 20),
  avatar_url text,
  notify boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.gardens (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 20),
  kind text not null check (kind in ('solo', 'group')),
  invite_code text unique,
  max_members int not null default 8 check (max_members between 1 and 8),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  check ((kind = 'solo') = (invite_code is null)),
  check (kind <> 'solo' or max_members = 1)
);

create table public.garden_members (
  garden_id uuid not null references public.gardens(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  petal_order int not null check (petal_order >= 1),
  joined_at timestamptz not null default now(),
  primary key (garden_id, user_id),
  constraint garden_members_order_unique unique (garden_id, petal_order) deferrable initially deferred
);
create index garden_members_user_idx on public.garden_members (user_id);

create table public.sky_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  local_date date not null,
  taken_at timestamptz not null,
  image_path text not null,
  dominant_color text not null check (dominant_color ~ '^#[0-9A-F]{6}$'),
  note text check (char_length(note) <= 60),
  unique (user_id, local_date)
);

create table public.plantings (
  garden_id uuid not null references public.gardens(id) on delete cascade,
  sky_photo_id uuid not null references public.sky_photos(id) on delete cascade,
  local_date date not null,
  primary key (garden_id, sky_photo_id)
);
create index plantings_garden_date_idx on public.plantings (garden_id, local_date);

create table public.push_subscriptions (
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text primary key,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create table public.daily_alerts (
  local_date date primary key,
  alert_at timestamptz not null,
  sent_at timestamptz
);

-- 헬퍼 (security definer: RLS 재귀 방지)

create function public.seoul_today() returns date
language sql stable set search_path = '' as $$
  select (now() at time zone 'Asia/Seoul')::date
$$;

create function public.is_member(g uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.garden_members where garden_id = g and user_id = auth.uid()
  )
$$;

create function public.shares_garden(other uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.garden_members mine
    join public.garden_members theirs on theirs.garden_id = mine.garden_id
    where mine.user_id = auth.uid() and theirs.user_id = other
  )
$$;

create function public.can_see_photo(p uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.sky_photos s where s.id = p and s.user_id = auth.uid())
      or exists (
        select 1
        from public.plantings pl
        join public.garden_members m on m.garden_id = pl.garden_id and m.user_id = auth.uid()
        where pl.sky_photo_id = p
      )
$$;

-- RLS

alter table public.profiles enable row level security;
alter table public.gardens enable row level security;
alter table public.garden_members enable row level security;
alter table public.sky_photos enable row level security;
alter table public.plantings enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.daily_alerts enable row level security;

create policy "profiles: 본인과 같은 정원 멤버 조회" on public.profiles
  for select to authenticated using (id = auth.uid() or public.shares_garden(id));
create policy "profiles: 본인 수정" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

revoke update on public.profiles from anon, authenticated;
grant update (nickname, notify, avatar_url) on public.profiles to authenticated;

create policy "gardens: 멤버 조회" on public.gardens
  for select to authenticated using (public.is_member(id));

create policy "garden_members: 멤버 조회" on public.garden_members
  for select to authenticated using (public.is_member(garden_id));

create policy "sky_photos: 본인 또는 같은 정원에 심긴 사진" on public.sky_photos
  for select to authenticated using (public.can_see_photo(id));

create policy "plantings: 멤버 조회" on public.plantings
  for select to authenticated using (public.is_member(garden_id));

create policy "push_subscriptions: 본인 조회" on public.push_subscriptions
  for select to authenticated using (user_id = auth.uid());
create policy "push_subscriptions: 본인 추가" on public.push_subscriptions
  for insert to authenticated with check (user_id = auth.uid());
create policy "push_subscriptions: 본인 삭제" on public.push_subscriptions
  for delete to authenticated using (user_id = auth.uid());

create policy "daily_alerts: 로그인 사용자 조회" on public.daily_alerts
  for select to authenticated using (true);

-- 가입 트리거: profile + 나만의 정원

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  solo_id uuid;
begin
  insert into public.profiles (id, nickname, avatar_url)
  values (
    new.id,
    left(coalesce(
      nullif(trim(meta ->> 'nickname'), ''),
      nullif(trim(meta ->> 'name'), ''),
      nullif(trim(meta ->> 'full_name'), ''),
      '하늘친구'
    ), 20),
    coalesce(meta ->> 'avatar_url', meta ->> 'picture')
  );

  insert into public.gardens (name, kind, max_members, created_by)
  values ('나만의 정원', 'solo', 1, new.id)
  returning id into solo_id;

  insert into public.garden_members (garden_id, user_id, petal_order)
  values (solo_id, new.id, 1);

  return new;
end
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

revoke execute on function public.handle_new_user() from public, anon, authenticated;
```

- [ ] **Step 6: 마이그레이션 적용과 타입 생성**

```bash
npm run db:push
npm run db:types
```
Expected: `Applying migration 20260930000100_schema.sql...` → `Finished supabase db push.` `lib/supabase/database.types.ts`에 `profiles`, `gardens` 등의 타입이 생긴다. (`db push`가 DB 비밀번호를 물으면 Step 1에서 보관한 값을 사람이 입력한다.)

- [ ] **Step 7: 통과 확인**

Run: `npm run test:db`
Expected: `schema.test.ts` 5 passed.

- [ ] **Step 8: Commit**

```bash
git add supabase lib/supabase/database.types.ts tests/db
git commit -m "feat(db): 스키마, RLS, 가입 트리거와 DB 통합 테스트 하네스"
```

---

### Task 3: 정원 RPC (만들기·참여·나가기·꽃잎 순서)

**Files:**
- Create: `supabase/migrations/20260930000200_garden_rpcs.sql`
- Modify: `lib/supabase/database.types.ts` (재생성)
- Test: `tests/db/gardens.test.ts`

**Interfaces:**
- Consumes: Task 2 테이블·`is_member`, 테스트 헬퍼
- Produces (supabase-js `rpc` 이름·인자):
  - `create_garden({ p_name: string, p_max_members: 2 | 8 }) → gardens 행` / 에러 `invalid_name`, `invalid_size`
  - `join_garden({ p_code: string }) → gardens 행` / 에러 `invalid_code`, `already_member`, `garden_full`
  - `leave_garden({ p_garden: string }) → null` / 에러 `not_member`, `cannot_leave_solo`
  - `reorder_petals({ p_garden: string, p_user_ids: string[] }) → null` / 에러 `not_member`, `invalid_order`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/db/gardens.test.ts`:
```ts
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
```

- [ ] **Step 2: 실패 확인**

Run: `npm run test:db -- gardens`
Expected: FAIL — `Could not find the function public.create_garden(...)`.

- [ ] **Step 3: RPC 마이그레이션 작성**

`supabase/migrations/20260930000200_garden_rpcs.sql`:
```sql
-- 정원 RPC: 만들기, 참여, 나가기, 꽃잎 순서

create function public.gen_invite_code() returns text
language plpgsql volatile set search_path = '' as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text;
begin
  loop
    code := '';
    for i in 1..6 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.gardens where invite_code = code);
  end loop;
  return code;
end
$$;

create function public.create_garden(p_name text, p_max_members int)
returns public.gardens
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare
  uid uuid := auth.uid();
  g public.gardens;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if p_name is null or char_length(trim(p_name)) not between 1 and 20 then raise exception 'invalid_name'; end if;
  if p_max_members is null or p_max_members not in (2, 8) then raise exception 'invalid_size'; end if;

  insert into public.gardens (name, kind, invite_code, max_members, created_by)
  values (trim(p_name), 'group', public.gen_invite_code(), p_max_members, uid)
  returning * into g;

  insert into public.garden_members (garden_id, user_id, petal_order) values (g.id, uid, 1);
  return g;
end
$$;

create function public.join_garden(p_code text)
returns public.gardens
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare
  uid uuid := auth.uid();
  g public.gardens;
  member_count int;
  next_order int;
begin
  if uid is null then raise exception 'not_authenticated'; end if;

  select * into g from public.gardens where invite_code = upper(trim(p_code)) for update;
  if not found then raise exception 'invalid_code'; end if;

  if exists (select 1 from public.garden_members where garden_id = g.id and user_id = uid) then
    raise exception 'already_member';
  end if;

  select count(*), coalesce(max(petal_order), 0) + 1
    into member_count, next_order
    from public.garden_members where garden_id = g.id;
  if member_count >= g.max_members then raise exception 'garden_full'; end if;

  insert into public.garden_members (garden_id, user_id, petal_order) values (g.id, uid, next_order);
  return g;
end
$$;

create function public.renumber_petals(p_garden uuid) returns void
language sql security definer set search_path = '' as $$
  update public.garden_members m
     set petal_order = r.rn
    from (
      select user_id, row_number() over (order by petal_order) as rn
        from public.garden_members where garden_id = p_garden
    ) r
   where m.garden_id = p_garden and m.user_id = r.user_id
$$;

create function public.leave_garden(p_garden uuid)
returns void
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare
  uid uuid := auth.uid();
  g public.gardens;
begin
  select * into g from public.gardens where id = p_garden for update;
  if not found or not exists (
    select 1 from public.garden_members where garden_id = p_garden and user_id = uid
  ) then
    raise exception 'not_member';
  end if;
  if g.kind = 'solo' then raise exception 'cannot_leave_solo'; end if;

  delete from public.plantings pl
   using public.sky_photos s
   where pl.sky_photo_id = s.id and pl.garden_id = p_garden and s.user_id = uid;
  delete from public.garden_members where garden_id = p_garden and user_id = uid;

  if not exists (select 1 from public.garden_members where garden_id = p_garden) then
    delete from public.gardens where id = p_garden;
  else
    perform public.renumber_petals(p_garden);
  end if;
end
$$;

create function public.reorder_petals(p_garden uuid, p_user_ids uuid[])
returns void
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare
  member_count int;
begin
  if not public.is_member(p_garden) then raise exception 'not_member'; end if;
  perform 1 from public.gardens where id = p_garden for update;

  select count(*) into member_count from public.garden_members where garden_id = p_garden;
  if coalesce(array_length(p_user_ids, 1), 0) <> member_count
     or (select count(distinct u) from unnest(p_user_ids) u) <> member_count
     or exists (
       select 1 from unnest(p_user_ids) u
        where not exists (select 1 from public.garden_members where garden_id = p_garden and user_id = u)
     )
  then
    raise exception 'invalid_order';
  end if;

  update public.garden_members m
     set petal_order = t.ord
    from unnest(p_user_ids) with ordinality as t(uid, ord)
   where m.garden_id = p_garden and m.user_id = t.uid;
end
$$;

revoke execute on function public.gen_invite_code() from public, anon, authenticated;
revoke execute on function public.renumber_petals(uuid) from public, anon, authenticated;
revoke execute on function public.create_garden(text, int) from public, anon;
revoke execute on function public.join_garden(text) from public, anon;
revoke execute on function public.leave_garden(uuid) from public, anon;
revoke execute on function public.reorder_petals(uuid, uuid[]) from public, anon;
grant execute on function public.create_garden(text, int) to authenticated;
grant execute on function public.join_garden(text) to authenticated;
grant execute on function public.leave_garden(uuid) to authenticated;
grant execute on function public.reorder_petals(uuid, uuid[]) to authenticated;
```

- [ ] **Step 4: 적용·타입 재생성·통과 확인**

```bash
npm run db:push
npm run db:types
npm run test:db
```
Expected: 마이그레이션 적용 성공, `schema.test.ts` 5 passed + `gardens.test.ts` 7 passed.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260930000200_garden_rpcs.sql lib/supabase/database.types.ts tests/db/gardens.test.ts
git commit -m "feat(db): 정원 만들기·참여·나가기·꽃잎 순서 RPC"
```

---

### Task 4: 하늘 RPC + Storage 버킷·정책

**Files:**
- Create: `scripts/lib/png.ts`
- Test: `tests/unit/png.test.ts`
- Create: `supabase/migrations/20260930000300_sky_rpcs_storage.sql`
- Modify: `lib/supabase/database.types.ts` (재생성)
- Test: `tests/db/sky.test.ts`

**Interfaces:**
- Consumes: Task 2 테이블·헬퍼 함수, Task 3 `create_garden`/`join_garden`, 테스트 헬퍼, `seoulDate`
- Produces:
  - `gradientPng(width: number, height: number, top: [number, number, number], bottom: [number, number, number]): Buffer`
  - `plant_sky({ p_image_path, p_color, p_note, p_garden_ids }) → [{ photo_id: string, old_image_path: string | null }]` / 에러 `not_authenticated`, `no_gardens`, `not_member`, `invalid_path`, `invalid_color`
  - `set_plantings({ p_photo, p_garden_ids }) → null` / 에러 `not_owner`, `not_today`, `no_gardens`, `not_member`
  - `unplant({ p_photo, p_garden }) → null` / 에러 `not_owner`
  - `delete_sky({ p_photo }) → string`(삭제된 image_path) / 에러 `not_owner`
  - `get_month({ p_garden, p_month: 'YYYY-MM' }) → [{ local_date: string, user_id: string, dominant_color: string }]` / 에러 `not_member`, `invalid_month`
  - 버킷 `skies`: 비공개, 5MB, `image/jpeg`·`image/png`

- [ ] **Step 1: 실패하는 PNG 테스트 작성**

`tests/unit/png.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { gradientPng } from '@/scripts/lib/png'

describe('gradientPng', () => {
  it('PNG 시그니처와 IHDR 크기를 쓴다', () => {
    const png = gradientPng(4, 3, [156, 195, 228], [242, 184, 162])
    expect([...png.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10])
    expect(png.subarray(12, 16).toString('ascii')).toBe('IHDR')
    expect(png.readUInt32BE(16)).toBe(4)
    expect(png.readUInt32BE(20)).toBe(3)
    expect(png.subarray(-8, -4).toString('ascii')).toBe('IEND')
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npm test`
Expected: FAIL — `Cannot find module '@/scripts/lib/png'`.

- [ ] **Step 3: PNG 인코더 구현**

`scripts/lib/png.ts`:
```ts
import { deflateSync } from 'node:zlib'

type Rgb = [number, number, number]

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

function crc32(buf: Buffer): number {
  let c = 0xffffffff
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(typeAndData))
  return Buffer.concat([length, typeAndData, crc])
}

/** 위→아래 세로 그라디언트 RGB PNG. 개발 시드와 테스트 업로드용. */
export function gradientPng(width: number, height: number, top: Rgb, bottom: Rgb): Buffer {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header[8] = 8 // bit depth
  header[9] = 2 // color type: truecolor

  const stride = width * 3 + 1
  const raw = Buffer.alloc(stride * height)
  for (let y = 0; y < height; y++) {
    const t = height === 1 ? 0 : y / (height - 1)
    const rgb = top.map((v, i) => Math.round(v + (bottom[i] - v) * t))
    const row = y * stride // row[0] = filter type 0
    for (let x = 0; x < width; x++) raw.set(rgb, row + 1 + x * 3)
  }

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}
```

- [ ] **Step 4: 통과 확인**

Run: `npm test`
Expected: `date.test.ts` 3 passed, `png.test.ts` 1 passed.

- [ ] **Step 5: 실패하는 하늘 RPC 테스트 작성**

`tests/db/sky.test.ts`:
```ts
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
    const { data } = await a.client.rpc('create_garden', { p_name: '같은 하늘', p_max_members: 2 })
    shared = (data as { id: string; invite_code: string }).id
    await b.client.rpc('join_garden', { p_code: (data as { invite_code: string }).invite_code })
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
})
```

- [ ] **Step 6: 실패 확인**

Run: `npm run test:db -- sky`
Expected: FAIL — 버킷 `skies` 없음(`Bucket not found`) 또는 `plant_sky` 함수 없음.

- [ ] **Step 7: 하늘 RPC·Storage 마이그레이션 작성**

`supabase/migrations/20260930000300_sky_rpcs_storage.sql`:
```sql
-- 하늘 RPC와 Storage

create function public.assert_member_of_all(p_garden_ids uuid[]) returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if coalesce(array_length(p_garden_ids, 1), 0) = 0 then raise exception 'no_gardens'; end if;
  if exists (
    select 1 from unnest(p_garden_ids) g
     where not exists (select 1 from public.garden_members m where m.garden_id = g and m.user_id = auth.uid())
  ) then
    raise exception 'not_member';
  end if;
end
$$;

create function public.sync_plantings(p_photo uuid, p_date date, p_garden_ids uuid[]) returns void
language sql security definer set search_path = '' as $$
  delete from public.plantings where sky_photo_id = p_photo and garden_id <> all (p_garden_ids);
  insert into public.plantings (garden_id, sky_photo_id, local_date)
  select distinct g, p_photo, p_date from unnest(p_garden_ids) g
  on conflict do nothing;
$$;

create function public.plant_sky(p_image_path text, p_color text, p_note text, p_garden_ids uuid[])
returns table (photo_id uuid, old_image_path text)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare
  uid uuid := auth.uid();
  today date := public.seoul_today();
  existing public.sky_photos;
  pid uuid;
  old_path text;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  perform public.assert_member_of_all(p_garden_ids);
  if p_image_path is null or split_part(p_image_path, '/', 1) <> uid::text then raise exception 'invalid_path'; end if;
  if p_color is null or p_color !~ '^#[0-9A-F]{6}$' then raise exception 'invalid_color'; end if;

  select * into existing from public.sky_photos where user_id = uid and local_date = today for update;
  if found then
    pid := existing.id;
    old_path := nullif(existing.image_path, p_image_path);
    update public.sky_photos
       set image_path = p_image_path,
           dominant_color = p_color,
           note = nullif(trim(p_note), ''),
           taken_at = now()
     where id = pid;
  else
    insert into public.sky_photos (user_id, local_date, taken_at, image_path, dominant_color, note)
    values (uid, today, now(), p_image_path, p_color, nullif(trim(p_note), ''))
    returning id into pid;
  end if;

  perform public.sync_plantings(pid, today, p_garden_ids);
  return query select pid, old_path;
end
$$;

create function public.own_photo(p_photo uuid) returns public.sky_photos
language plpgsql stable security definer set search_path = '' as $$
declare
  s public.sky_photos;
begin
  select * into s from public.sky_photos where id = p_photo;
  if not found or s.user_id <> auth.uid() then raise exception 'not_owner'; end if;
  return s;
end
$$;

create function public.set_plantings(p_photo uuid, p_garden_ids uuid[])
returns void
language plpgsql security definer set search_path = '' as $$
declare
  s public.sky_photos := public.own_photo(p_photo);
begin
  if s.local_date <> public.seoul_today() then raise exception 'not_today'; end if;
  perform public.assert_member_of_all(p_garden_ids);
  perform public.sync_plantings(s.id, s.local_date, p_garden_ids);
end
$$;

create function public.unplant(p_photo uuid, p_garden uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  s public.sky_photos := public.own_photo(p_photo);
begin
  delete from public.plantings where sky_photo_id = s.id and garden_id = p_garden;
end
$$;

create function public.delete_sky(p_photo uuid)
returns text
language plpgsql security definer set search_path = '' as $$
declare
  s public.sky_photos := public.own_photo(p_photo);
begin
  delete from public.sky_photos where id = s.id;
  return s.image_path;
end
$$;

create function public.get_month(p_garden uuid, p_month text)
returns table (local_date date, user_id uuid, dominant_color text)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare
  first_day date;
begin
  if not public.is_member(p_garden) then raise exception 'not_member'; end if;
  if p_month is null or p_month !~ '^\d{4}-(0[1-9]|1[0-2])$' then raise exception 'invalid_month'; end if;
  first_day := to_date(p_month || '-01', 'YYYY-MM-DD');

  return query
    select pl.local_date, s.user_id, s.dominant_color
      from public.plantings pl
      join public.sky_photos s on s.id = pl.sky_photo_id
      join public.garden_members m on m.garden_id = pl.garden_id and m.user_id = s.user_id
     where pl.garden_id = p_garden
       and pl.local_date >= first_day
       and pl.local_date < (first_day + interval '1 month')::date
     order by pl.local_date, m.petal_order;
end
$$;

revoke execute on function public.assert_member_of_all(uuid[]) from public, anon, authenticated;
revoke execute on function public.sync_plantings(uuid, date, uuid[]) from public, anon, authenticated;
revoke execute on function public.own_photo(uuid) from public, anon, authenticated;
revoke execute on function public.plant_sky(text, text, text, uuid[]) from public, anon;
revoke execute on function public.set_plantings(uuid, uuid[]) from public, anon;
revoke execute on function public.unplant(uuid, uuid) from public, anon;
revoke execute on function public.delete_sky(uuid) from public, anon;
revoke execute on function public.get_month(uuid, text) from public, anon;
grant execute on function public.plant_sky(text, text, text, uuid[]) to authenticated;
grant execute on function public.set_plantings(uuid, uuid[]) to authenticated;
grant execute on function public.unplant(uuid, uuid) to authenticated;
grant execute on function public.delete_sky(uuid) to authenticated;
grant execute on function public.get_month(uuid, text) to authenticated;

-- Storage: 비공개 버킷 skies

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('skies', 'skies', false, 5242880, array['image/jpeg', 'image/png'])
on conflict (id) do nothing;

create policy "skies: 본인 폴더에 업로드" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'skies' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "skies: 본인 또는 볼 수 있는 사진 읽기" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'skies'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (
        select 1 from public.sky_photos s
         where s.image_path = storage.objects.name and public.can_see_photo(s.id)
      )
    )
  );

create policy "skies: 본인 파일 삭제" on storage.objects
  for delete to authenticated
  using (bucket_id = 'skies' and (storage.foldername(name))[1] = auth.uid()::text);
```

- [ ] **Step 8: 적용·타입 재생성·통과 확인**

```bash
npm run db:push
npm run db:types
npm run test:db
```
Expected: `schema` 5 + `gardens` 7 + `sky` 8 passed.

- [ ] **Step 9: Commit**

```bash
git add scripts/lib/png.ts tests/unit/png.test.ts supabase/migrations/20260930000300_sky_rpcs_storage.sql lib/supabase/database.types.ts tests/db/sky.test.ts
git commit -m "feat(db): 하늘 심기·교체·정원 변경·빼기·지우기·월 조회 RPC와 skies 버킷"
```

---

### Task 5: 앱 인증 흐름 + 개발 시드 + (임시) 내 정원 목록

**Files:**
- Create: `lib/supabase/client.ts`, `lib/supabase/server.ts`, `lib/supabase/proxy.ts`, `proxy.ts`
- Create: `lib/dev/seed-users.ts`, `scripts/seed.ts`
- Create: `app/login/page.tsx`, `app/login/actions.ts`, `components/KakaoLoginButton.tsx`, `components/DevLogin.tsx`
- Create: `app/auth/callback/route.ts`, `lib/auth/actions.ts`, `app/(app)/garden/page.tsx`
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: `Database` 타입(`lib/supabase/database.types.ts`), Task 3 `create_garden`/`join_garden`, `seoulDate`, `gradientPng`
- Produces:
  - `createClient()` (브라우저, `lib/supabase/client.ts`), `createClient(): Promise<SupabaseClient<Database>>` (서버, `lib/supabase/server.ts`), `updateSession(request: NextRequest): Promise<NextResponse>`
  - `SEED_USERS: readonly { email: string; nickname: string }[]`
  - 서버 액션 `devLogin(formData: FormData)`, `signOut()`
  - 라우트 `/login`, `/auth/callback`, `/garden`

- [ ] **Step 1: Supabase 클라이언트와 proxy 작성**

`lib/supabase/client.ts`:
```ts
import { createBrowserClient } from '@supabase/ssr'
import type { Database } from './database.types'

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  )
}
```

`lib/supabase/server.ts`:
```ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from './database.types'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
          } catch {
            // 서버 컴포넌트에서 호출된 경우. proxy가 세션을 갱신하므로 무시한다.
          }
        },
      },
    },
  )
}
```

`lib/supabase/proxy.ts`:
```ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PUBLIC_PREFIXES = ['/login', '/auth', '/manifest.webmanifest', '/sw.js', '/icons', '/icon', '/apple-icon']

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
          Object.entries(headers ?? {}).forEach(([key, value]) => response.headers.set(key, value))
        },
      },
    },
  )

  // createServerClient와 getClaims 사이에 다른 코드를 넣지 않는다(세션 끊김 방지).
  const { data } = await supabase.auth.getClaims()
  const signedIn = Boolean(data?.claims)
  const { pathname } = request.nextUrl
  const isPublic = PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))

  if (!signedIn && !isPublic) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.search = ''
    return NextResponse.redirect(url)
  }
  if (signedIn && pathname === '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/garden'
    url.search = ''
    return NextResponse.redirect(url)
  }
  return response
}
```

`proxy.ts`:
```ts
import type { NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/proxy'

export async function proxy(request: NextRequest) {
  return updateSession(request)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
```

- [ ] **Step 2: 시드 계정 목록과 시드 스크립트 작성**

`lib/dev/seed-users.ts`:
```ts
/** 개발용 테스트 계정. 비밀번호는 .env.local의 DEV_SEED_PASSWORD 하나를 공유한다. */
export const SEED_USERS = [
  { email: 'me@garden-farmer.test', nickname: '나' },
  { email: 'seoyeon@garden-farmer.test', nickname: '서연' },
  { email: 'minjae@garden-farmer.test', nickname: '민재' },
  { email: 'haeun@garden-farmer.test', nickname: '하은' },
  { email: 'doyoon@garden-farmer.test', nickname: '도윤' },
] as const
```

`scripts/seed.ts`:
```ts
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
  const { data: existing } = await owner.from('gardens').select('id').eq('name', name).maybeSingle()
  if (existing) return
  const { data, error } = await owner.rpc('create_garden', { p_name: name, p_max_members: size })
  if (error) throw error
  for (const j of joiners) {
    const { error: joinError } = await j.rpc('join_garden', { p_code: data.invite_code })
    if (joinError) throw joinError
  }
  console.log(`정원 생성: ${name}`)
}

async function seedHistory(userIds: string[]) {
  const today = seoulDate()
  const todayDay = Number(today.slice(8))
  const monthPrefix = today.slice(0, 8)

  await admin.storage
    .from('skies')
    .upload(SEED_IMAGE, gradientPng(360, 480, [156, 195, 228], [242, 205, 187]), { contentType: 'image/png', upsert: true })

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
```

- [ ] **Step 3: 시드 실행(두 번 — 멱등 확인)**

```bash
npm run seed
npm run seed
```
Expected: 첫 실행 `계정 생성: 나` … `정원 생성: 우리 둘`, `정원 생성: 대학 동기`, `하늘 기록 N장 …`, `시드 완료`. 두 번째 실행은 계정·정원 생성 줄 없이 `하늘 기록 0장, 심기 0건 추가`, `시드 완료`.

- [ ] **Step 4: 로그인 화면·액션·콜백·로그아웃 작성**

`app/login/actions.ts`:
```ts
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
```

`lib/auth/actions.ts`:
```ts
'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
```

`components/KakaoLoginButton.tsx`:
```tsx
'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export function KakaoLoginButton() {
  const [pending, setPending] = useState(false)
  const [failed, setFailed] = useState(false)

  async function signIn() {
    setPending(true)
    setFailed(false)
    const { error } = await createClient().auth.signInWithOAuth({
      provider: 'kakao',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) {
      setPending(false)
      setFailed(true)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={signIn}
        disabled={pending}
        className="h-13 rounded-full bg-[#FEE500] text-[17px] text-[#191919] disabled:opacity-60"
      >
        {pending ? '카카오로 이동 중…' : '카카오로 시작하기'}
      </button>
      {failed && (
        <p role="alert" className="text-sm text-[#7A3E2C]">
          카카오 로그인을 시작하지 못했어요. 잠시 후 다시 시도해 주세요.
        </p>
      )}
    </div>
  )
}
```

`components/DevLogin.tsx`:
```tsx
import { devLogin } from '@/app/login/actions'
import { SEED_USERS } from '@/lib/dev/seed-users'

export function DevLogin() {
  return (
    <section aria-label="개발용 로그인" className="flex flex-col gap-2 rounded-2xl border border-dashed border-line p-4">
      <p className="text-sm text-muted">개발용 · 테스트 계정으로 로그인</p>
      <div className="flex flex-wrap gap-2">
        {SEED_USERS.map((u) => (
          <form key={u.email} action={devLogin}>
            <input type="hidden" name="email" value={u.email} />
            <button type="submit" className="h-11 min-w-11 rounded-full border border-line bg-card px-4">
              {u.nickname}
            </button>
          </form>
        ))}
      </div>
    </section>
  )
}
```

`app/login/page.tsx`:
```tsx
import { DevLogin } from '@/components/DevLogin'
import { KakaoLoginButton } from '@/components/KakaoLoginButton'

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams
  return (
    <main className="flex min-h-dvh flex-col justify-center gap-6 px-5">
      <div className="flex flex-col gap-2">
        <h1 className="font-serif text-3xl font-bold">하늘정원</h1>
        <p className="text-muted">하루 한 번, 지금 보이는 하늘을 심어요</p>
      </div>
      {error && (
        <p role="alert" className="text-sm text-[#7A3E2C]">
          로그인하지 못했어요. 다시 시도해 주세요.
        </p>
      )}
      <KakaoLoginButton />
      {process.env.NEXT_PUBLIC_DEV_LOGIN === 'true' && <DevLogin />}
    </main>
  )
}
```

`app/auth/callback/route.ts`:
```ts
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get('code')
  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(`${origin}/garden`)
  }
  return NextResponse.redirect(`${origin}/login?error=auth`)
}
```

- [ ] **Step 5: (임시) 내 정원 목록과 루트 리다이렉트 작성**

`app/(app)/garden/page.tsx` (계획 3에서 정원 홈으로 교체):
```tsx
import { signOut } from '@/lib/auth/actions'
import { createClient } from '@/lib/supabase/server'

export default async function GardenPage() {
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getClaims()
  const uid = auth?.claims.sub as string

  const [{ data: profile }, { data: gardens }] = await Promise.all([
    supabase.from('profiles').select('nickname').eq('id', uid).single(),
    supabase.from('gardens').select('id, name, kind, max_members, garden_members(count)').order('created_at'),
  ])

  return (
    <main className="flex min-h-dvh flex-col gap-6 px-5 pt-13">
      <h1 className="font-serif text-2xl font-bold">{profile?.nickname}님의 정원</h1>
      <ul className="flex flex-col gap-2">
        {gardens?.map((g) => (
          <li key={g.id} className="flex min-h-11 items-center justify-between rounded-2xl border border-line bg-card px-4">
            <span>{g.name}</span>
            <span className="text-sm text-muted">
              {g.garden_members[0]?.count ?? 0} / {g.max_members}명
            </span>
          </li>
        ))}
      </ul>
      <form action={signOut}>
        <button type="submit" className="h-11 text-sm text-muted underline">
          로그아웃
        </button>
      </form>
    </main>
  )
}
```

`app/page.tsx` (전체 교체):
```tsx
import { redirect } from 'next/navigation'

export default function Home() {
  redirect('/garden')
}
```

- [ ] **Step 6: 타입 검사·빌드**

Run: `npm run typecheck && npm run build`
Expected: 에러 없음. 라우트 목록에 `/login`, `/auth/callback`, `/garden`, `ƒ Proxy (Middleware)` 표시.

- [ ] **Step 7: 브라우저로 흐름 확인**

`npm run dev` 후 브라우저에서:
1. `http://localhost:3000` → `/login`으로 리다이렉트, "개발용 · 테스트 계정으로 로그인" 섹션에 나/서연/민재/하은/도윤 버튼.
2. "나" 클릭 → `/garden`에 "나님의 정원", 목록 `나만의 정원 1 / 1명`, `우리 둘 2 / 2명`, `대학 동기 5 / 8명`.
3. `/login` 직접 접속 → `/garden`으로 돌아옴.
4. 로그아웃 → `/login`. `/garden` 직접 접속 → `/login`.
5. "하은" 로그인 → `나만의 정원`, `대학 동기`만 보임(우리 둘은 안 보임 — RLS).

- [ ] **Step 8: Commit**

```bash
git add lib proxy.ts scripts/seed.ts app components
git commit -m "feat: 세션 proxy, 로그인(카카오·개발용), 개발 시드, 임시 정원 목록"
```

---

### Task 6: PWA — manifest, 아이콘, 서비스워커

**Files:**
- Create: `lib/pwa/icon.tsx`, `app/icons/[size]/route.tsx`, `app/apple-icon.tsx`, `app/icon.tsx`, `app/manifest.ts`
- Create: `public/sw.js`, `components/ServiceWorkerRegister.tsx`
- Modify: `app/layout.tsx`

**Interfaces:**
- Consumes: 없음(독립)
- Produces: `/manifest.webmanifest`, `/icons/192`, `/icons/512`, `/apple-icon`, `/icon`, `/sw.js`(계획 6에서 push 핸들러 추가), `<ServiceWorkerRegister />`

- [ ] **Step 1: 아이콘 그림과 라우트 작성**

`lib/pwa/icon.tsx`:
```tsx
const PETALS = ['#9CC3E4', '#F2B8A2', '#8494C6', '#F2CE8C', '#E9A9BD']

/** 5장 꽃잎 + 금빛 가운데. next/og ImageResponse 안에서만 쓴다. */
export function FlowerIcon({ size }: { size: number }) {
  return (
    <div style={{ width: size, height: size, display: 'flex', background: '#F7F2E9' }}>
      <svg width={size} height={size} viewBox="0 0 100 100">
        {PETALS.map((color, i) => (
          <ellipse
            key={color}
            cx="50"
            cy="31"
            rx="13"
            ry="19"
            fill={color}
            fillOpacity="0.85"
            transform={`rotate(${i * 72} 50 50)`}
          />
        ))}
        <circle cx="50" cy="50" r="8" fill="#E0A73E" />
      </svg>
    </div>
  )
}
```

`app/icons/[size]/route.tsx`:
```tsx
import { ImageResponse } from 'next/og'
import { FlowerIcon } from '@/lib/pwa/icon'

const SIZES = new Set([192, 512])

export async function GET(_request: Request, { params }: { params: Promise<{ size: string }> }) {
  const size = Number((await params).size)
  if (!SIZES.has(size)) return new Response('Not found', { status: 404 })
  return new ImageResponse(<FlowerIcon size={size} />, { width: size, height: size })
}
```

`app/apple-icon.tsx`:
```tsx
import { ImageResponse } from 'next/og'
import { FlowerIcon } from '@/lib/pwa/icon'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(<FlowerIcon size={180} />, size)
}
```

`app/icon.tsx`:
```tsx
import { ImageResponse } from 'next/og'
import { FlowerIcon } from '@/lib/pwa/icon'

export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(<FlowerIcon size={32} />, size)
}
```

`app/manifest.ts`:
```ts
import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '하늘정원',
    short_name: '하늘정원',
    description: '하루 한 번, 지금 보이는 하늘색으로 피우는 꽃',
    lang: 'ko',
    start_url: '/garden',
    scope: '/',
    display: 'standalone',
    background_color: '#F7F2E9',
    theme_color: '#F7F2E9',
    icons: [
      { src: '/icons/192', sizes: '192x192', type: 'image/png' },
      { src: '/icons/512', sizes: '512x512', type: 'image/png' },
      { src: '/icons/512', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
```

- [ ] **Step 2: 서비스워커와 등록 컴포넌트 작성**

`public/sw.js`:
```js
// 하늘정원 서비스워커. 계획 6에서 push·notificationclick, 계획 8에서 앱 셸 캐시를 추가한다.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))
```

`components/ServiceWorkerRegister.tsx`:
```tsx
'use client'

import { useEffect } from 'react'

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
      // 등록 실패는 앱 사용을 막지 않는다.
    })
  }, [])
  return null
}
```

`app/layout.tsx` 수정 — import 추가와 `<body>` 변경:
```tsx
import { ServiceWorkerRegister } from '@/components/ServiceWorkerRegister'
```
```tsx
      <body>
        {children}
        <ServiceWorkerRegister />
      </body>
```

- [ ] **Step 3: 빌드와 응답 확인**

```bash
npm run build
npm run start
```
(백그라운드 실행 후 다른 셸에서)
```bash
curl -s http://localhost:3000/manifest.webmanifest
curl -s -o /dev/null -w "%{http_code} %{content_type}\n" http://localhost:3000/icons/192
curl -s -o /dev/null -w "%{http_code} %{content_type}\n" http://localhost:3000/icons/100
curl -s -o /dev/null -w "%{http_code} %{content_type}\n" http://localhost:3000/sw.js
```
Expected: manifest JSON에 `"name":"하늘정원"`, `"display":"standalone"`, `"start_url":"/garden"`. `/icons/192` → `200 image/png`, `/icons/100` → `404`, `/sw.js` → `200 application/javascript; charset=utf-8`. (로그인 없이 접근돼야 한다 — proxy 공개 경로 확인.)

- [ ] **Step 4: 브라우저 확인**

브라우저에서 `http://localhost:3000/icons/512`를 열어 종이색 배경에 5색 꽃잎·금빛 가운데 꽃이 보이는지 확인. 로그인 후 개발자 도구(또는 `navigator.serviceWorker.getRegistration()`)로 `/sw.js`가 `activated` 상태인지 확인.

- [ ] **Step 5: Commit**

```bash
git add lib/pwa app/icons app/apple-icon.tsx app/icon.tsx app/manifest.ts app/layout.tsx public/sw.js components/ServiceWorkerRegister.tsx
git commit -m "feat(pwa): manifest, 꽃 아이콘, 서비스워커 등록"
```

---

## 완료 기준 (계획 1)

- `npm test`, `npm run test:db`, `npm run typecheck`, `npm run build` 모두 통과
- 개발 로그인 5개 계정으로 로그인·로그아웃, 계정별로 속한 정원만 보임
- `/manifest.webmanifest`, `/icons/*`, `/sw.js`가 로그인 없이 응답하고 서비스워커가 활성화됨
- 설계 1a·2단계 완료 기준 충족. 실제 iPhone 검증(1b)은 계획 5에서 한다.
