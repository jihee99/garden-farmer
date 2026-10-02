# 하늘정원 — 설계 문서

- 작성일: 2026-09-30
- 기반: `SPEC.md`, `sky-garden-mockup.html`
- 범위: MVP 전체(SPEC 9장 1~8단계). 구현은 단계별로 끊어 동작 확인 후 진행.
- 이 문서가 SPEC과 다를 경우 **이 문서가 우선**한다. 변경점은 12장에 모아 둔다.

---

## 1. 컨셉과 차별점

하루 한 번 지금 보이는 하늘을 찍으면, 함께하는 사람들의 하늘색이 모여 그날의 꽃 한 송이가 피는 수채화 감성 기록 앱.

설계 결정을 내릴 때 지키는 세 가지(비슷한 그룹 기록 앱과 구분되는 지점):

1. **피사체는 하늘 하나.** 일상 기록이 아니다.
2. **결과물은 추상.** 사진이 아니라 색이 남고, 색이 꽃이 된다. 사진은 재료이고 하루 상세에서만 크게 보인다.
3. **나의 하늘은 하루 하나.** 같은 하늘 한 장이 내가 속한 여러 정원에 동시에 핀다. 정원별로 다른 사진을 올리지 않는다.

## 2. 아키텍처 개요

**방식: 클라이언트 중심 + DB 로직**

- Next.js(App Router) + TypeScript + Tailwind CSS, Vercel 배포, iOS 홈 화면 PWA.
- `@supabase/ssr`로 쿠키 세션과 미들웨어(세션 갱신, 미로그인 리다이렉트)만 서버에서 처리.
- 화면은 클라이언트 컴포넌트가 `supabase-js`로 직접 조회한다. 보안은 RLS가 담당한다.
- 규칙이 있는 쓰기는 전부 Postgres 함수(RPC)와 트리거로 처리한다. 테이블 직접 insert/update/delete 정책은 두지 않는다.
- 순수 로직(꽃 계산, 날짜, 통계, 색 추출)은 `lib/domain`, `lib/image`에 두고 단위 테스트한다.
- 예외: 공유 카드 이미지는 클라이언트(`html-to-image`), 푸시는 Supabase Edge Function + `pg_cron` + `pg_net`.

선택하지 않은 대안:
- 서버 컴포넌트 + Server Actions 중심: 카메라/색 추출이 어차피 클라이언트이고, PWA 오프라인 처리와 맞지 않음.
- 별도 REST 레이어: RLS + RPC가 이미 API 역할을 하므로 중복.

## 3. 프로젝트 구조

```
garden-farmer/
├─ proxy.ts                   # Next 16 proxy(구 middleware): 세션 갱신, 미로그인 리다이렉트
├─ app/
│  ├─ onboarding/              # 컨셉 3장 → 홈 화면 추가 안내 → 로그인 → 알림 허용
│  ├─ login/                   # 카카오 로그인 + (개발 환경) 테스트 계정 로그인
│  ├─ auth/callback/           # 카카오 OAuth 코드 교환(PKCE) 후 세션 확정
│  ├─ (app)/garden/            # 정원 홈  ?g=<gardenId>&m=YYYY-MM
│  ├─ (app)/garden/[date]/     # 하루 상세 ?g=<gardenId>
│  ├─ (app)/sky/               # 하늘 담기
│  ├─ (app)/collection/        # 모아보기 + 공유 카드
│  ├─ (app)/gardens/new/       # 정원 만들기
│  ├─ (app)/gardens/join/      # 초대 코드 입력
│  ├─ (app)/settings/          # 프로필, 알림, 꽃잎 순서, 나가기, 로그아웃
│  ├─ manifest.ts
│  └─ layout.tsx               # 폰트, 토큰, 배경 번짐
├─ components/                 # Flower, Stone, Sprout, DayCell, MonthGrid, GardenPills,
│                              # AvatarStack, SkyTile, TabBar, Wash, DevLogin
├─ lib/
│  ├─ domain/
│  │  ├─ flower.ts             # 꽃 계산 규칙(5장)
│  │  ├─ date.ts               # Asia/Seoul 날짜·월 경계
│  │  └─ month-stats.ts        # 피어난 꽃 / 다 함께 모인 날 / 돌멩이
│  ├─ image/
│  │  ├─ compress.ts           # 긴 변 1600px, JPEG 0.8, EXIF 회전 보정
│  │  ├─ dominant-color.ts     # 대표색 추출
│  │  └─ color-name.ts         # 색 → "맑은 물빛" 등 이름
│  ├─ supabase/                # client.ts, server.ts, proxy.ts, database.types.ts
│  ├─ data/                    # 조회·RPC 래퍼(gardens, sky, month) + 에러 코드 → 한국어 문구
│  └─ push/                    # 구독/해제
├─ public/sw.js                # push 수신, notificationclick, 앱 셸 캐시
├─ supabase/
│  ├─ migrations/              # 테이블, RLS, RPC, 트리거, cron
│  ├─ functions/send-sky-alert/
│  └─ config.toml
├─ scripts/seed.ts             # 개발용 테스트 계정·정원·샘플 기록(admin API)
├─ tests/
│  ├─ unit/                    # Vitest 순수 로직
│  ├─ db/                      # Vitest 통합: dev 프로젝트에 RPC·RLS 검증
│  └─ e2e/                     # Playwright 스모크
└─ docs/superpowers/specs/
```

### 경계 원칙
- `lib/domain`은 UI·Supabase에 의존하지 않는 순수 함수만 둔다.
- `components/Flower`는 `petals: (string | null)[]`, `full: boolean`만 받아 그린다. 계산하지 않는다.
- 화면은 `lib/data`로 조회 → `lib/domain`으로 변환 → 컴포넌트에 전달.

## 4. 데이터 모델

SPEC 6장을 기준으로 아래를 변경·추가한다.

```sql
profiles (
  id uuid primary key references auth.users on delete cascade,
  nickname text not null,
  avatar_url text,
  notify boolean not null default true,          -- 추가: 하늘 알림 on/off
  created_at timestamptz default now()
)

gardens (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null check (kind in ('solo','group')),
  invite_code text unique,                       -- solo는 null
  max_members int not null default 8 check (max_members between 1 and 8),
  created_by uuid references profiles(id),
  created_at timestamptz default now()
)
-- '둘' 정원 = kind 'group', max_members 2 / '그룹' = kind 'group', max_members 8 / solo = max_members 1

garden_members (
  garden_id uuid references gardens(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  petal_order int not null,                      -- 추가: 꽃잎·아바타·타일 순서(1부터)
  joined_at timestamptz default now(),
  primary key (garden_id, user_id),
  unique (garden_id, petal_order) deferrable initially deferred
)

sky_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  local_date date not null,                      -- Asia/Seoul, 서버가 결정
  taken_at timestamptz not null,
  image_path text not null,                      -- skies/{uid}/{local_date}/{uuid}.jpg
  dominant_color text not null check (dominant_color ~ '^#[0-9A-F]{6}$'),
  note text check (char_length(note) <= 60),
  unique (user_id, local_date)                   -- 사용자당 하루 1장
)

plantings (
  garden_id uuid references gardens(id) on delete cascade,
  sky_photo_id uuid references sky_photos(id) on delete cascade,
  local_date date not null,
  primary key (garden_id, sky_photo_id)
)

push_subscriptions (
  user_id uuid references profiles(id) on delete cascade,
  endpoint text primary key,
  p256dh text not null,
  auth text not null,
  created_at timestamptz default now()
)

daily_alerts (
  local_date date primary key,
  alert_at timestamptz not null,
  sent_at timestamptz                            -- 추가: 발송 선점/중복 방지
)
```

- 초대 코드: 헷갈리는 문자(0, O, 1, I)를 뺀 대문자+숫자 6자리. 충돌 시 재생성.
- 이미지 경로에 uuid를 넣어 교체 시 캐시·signed URL 충돌을 피한다.

## 5. 꽃 계산 규칙 (`lib/domain/flower.ts`)

입력: 날짜, 오늘 날짜, 멤버 id 배열(`petal_order` 오름차순), 그날의 `{ userId → color }`.
출력: `DayBloom = { kind: 'stone' } | { kind: 'sprout' } | { kind: 'flower', petals: (string|null)[], full: boolean } | { kind: 'future' }`

- 꽃잎 수: 1명 → 5장 / 2명 → 6장 / n명(3~8) → n장
- 꽃잎 i의 주인: 1명 `0`, 2명 `i % 2`, n명 `i`
- 주인이 심었으면 `dominant_color`, 아니면 `null`(흰 꽃잎 + 점선)
- 심은 사람 0명: 지난 날 → `stone`, 오늘 → `sprout`, 미래 → `future`(흐린 날짜 숫자만)
- 전원 참여 → `full: true`(가운데 #E0A73E + 연한 광채)
- 꽃잎 0번은 12시 방향, 시계 방향으로 `i * 360 / 꽃잎 수`도.
- **모든 멤버에게 같은 꽃이 보인다.** 순서는 `petal_order`이고 멤버 누구나 바꿀 수 있다.
- 꽃은 **현재 멤버** 기준으로 매번 계산한다. 순서 변경·멤버 이탈은 지난 달 꽃에도 반영된다.

## 6. RPC와 트리거

모든 RPC는 `security definer`, `auth.uid()` 기준으로 동작하고, 실패 시 식별 가능한 에러 코드(`raise exception using errcode = 'P0001', message = '<code>'`)를 낸다.

| 함수 | 동작 | 에러 코드 |
|---|---|---|
| `handle_new_user()` (auth.users insert 트리거) | 카카오 메타데이터(`name`/`nickname`, `avatar_url`)로 profiles 생성, "나만의 정원"(solo) 생성·가입 | — |
| `create_garden(name, max_members)` | group 정원 + 초대 코드 생성, 생성자를 `petal_order` 1로 가입. 반환: id, invite_code | `invalid_size` |
| `join_garden(code)` | 정원 행 `for update` 잠금 → 인원 확인 → 마지막 순서로 가입 | `invalid_code`, `garden_full`, `already_member` |
| `leave_garden(garden_id)` | 내 plantings 삭제, 멤버 삭제, 남은 `petal_order` 1부터 재정렬. 마지막 멤버면 정원 삭제 | `cannot_leave_solo` |
| `reorder_petals(garden_id, user_ids[])` | 배열이 현재 멤버 전원과 정확히 일치할 때만 순서 반영 | `not_member`, `invalid_order` |
| `plant_sky(image_path, dominant_color, note, garden_ids[])` | 날짜는 서버가 `(now() at time zone 'Asia/Seoul')::date`로 결정. 오늘 사진이 없으면 생성, 있으면 **교체**(이미지·색·메모·taken_at 갱신). plantings를 `garden_ids`와 정확히 일치시킨다(교체 화면은 현재 심긴 정원을 미리 체크해 넘기므로 그대로 유지됨). 이미지 경로 첫 세그먼트는 본인 uid여야 함. 반환: photo_id, 교체된 예전 `image_path` | `not_member`, `no_gardens`, `invalid_path`, `invalid_color` |
| `set_plantings(photo_id, garden_ids[])` | **오늘** 사진을 심을 정원을 추가·제거 | `not_owner`, `not_today`, `not_member` |
| `unplant(photo_id, garden_id)` | 특정 정원에서만 내 하늘을 뺀다(지난 날 포함) | `not_owner` |
| `delete_sky(photo_id)` | 하늘을 지운다(지난 날 포함). plantings는 cascade. 반환: `image_path` | `not_owner` |
| `get_month(garden_id, month text)` | `(local_date, user_id, dominant_color)` 목록 | `not_member` |

- 교체·삭제 후 클라이언트가 반환된 경로로 Storage 파일을 지운다. 실패해도 사용자 흐름은 막지 않는다(고아 파일은 허용).
- 지난 날에 새로 심거나 교체하는 경로는 없다.

## 7. RLS와 Storage

- `is_member(garden_id)`: security definer 헬퍼(RLS 재귀 방지).
- `profiles`: 본인 + 같은 정원 멤버 조회. 본인만 `nickname`, `notify` 수정.
- `gardens`, `garden_members`, `plantings`: `is_member`인 정원만 조회.
- `sky_photos`: 본인 것 또는 내가 속한 정원에 심어진 것만 조회.
- `push_subscriptions`: 본인 것만 조회·추가·삭제.
- `daily_alerts`: 로그인 사용자 조회 가능(카운트다운용).
- Storage 버킷 `skies`(비공개, 5MB, `image/jpeg`·`image/png` — png는 개발 시드용):
  - insert: 경로 첫 세그먼트가 `auth.uid()`인 경우만.
  - select: `sky_photos` 조회 조건과 동일(image_path 조인).
  - delete: 본인 경로만.
  - 표시: `createSignedUrl` 1시간.

## 8. 화면과 흐름

디자인은 목업(정원 홈 / 하늘 담기 / 월말 공유 카드)과 SPEC 8장 토큰을 따른다. 터치 영역 최소 44px, 텍스트 대비 4.5:1 이상.

### 8.1 온보딩과 로그인
- iOS 홈 화면 PWA는 Safari와 쿠키·저장소를 공유하지 않는다. 따라서 **설치 후 PWA 안에서 로그인**한다.
- 순서: 컨셉 3장 → (Safari이고 standalone이 아니면) 홈 화면 추가 안내 → 카카오 로그인(PKCE) → 알림 허용.
- 데스크톱·안드로이드는 설치 안내를 건너뛸 수 있다.
- 1b단계에서 실제 iPhone으로 검증한다. 실패 시 대안: Safari에서 로그인 → 콜백 페이지가 1회용 코드(5분 유효) 표시 → PWA에서 코드 입력 → 세션 인계.
- **개발 로그인**: `NEXT_PUBLIC_DEV_LOGIN=true`일 때만 `DevLogin` 컴포넌트가 렌더된다. 시드 계정(나/서연/민재/하은/도윤)으로 이메일+비밀번호 로그인. 프로덕션 빌드에서는 환경변수가 없어 코드가 제거된다.

### 8.2 정원 홈 `/garden?g=&m=`
- 상단: 연·계절, "N월의 정원", 이번 달 핀 꽃 수, 멤버 아바타(`petal_order` 순).
- 정원 전환 알약 탭(이름 + 인원). 마지막으로 본 정원을 localStorage에 기억.
- 월 이동: 좌우 화살표/스와이프.
- 6열 달력 그리드: 날짜별 꽃·돌멩이·새싹, 미래는 흐린 숫자.
- 날짜 탭 → 하단 카드: 멤버별 하늘색 타일(빈 자리 점선), 안내 문구, "사진 보기".
- 현재 정원의 `plantings`를 Realtime 구독 → 친구가 심으면 해당 날짜 다시 계산.
- 하단 탭: 정원 / (가운데 원형) 하늘 담기 / 모아보기.

### 8.3 하늘 담기 `/sky`
1. `<input type="file" accept="image/*" capture="environment">`로 촬영.
2. `createImageBitmap(file, { imageOrientation: 'from-image' })` → canvas로 긴 변 1600px, JPEG 0.8.
3. 대표색: 64px로 축소 → k-means(k=3) → 점유율 15% 이상 군집 중 채도(크로마 = RGB 최댓값−최솟값)가 가장 높은 색. HSL 채도는 흰 구름·그림자에서 1에 가까워져 쓰지 않는다. HSL 명도 < 0.2이면 밤 남색 계열(색상 220~235°, 명도 0.25~0.3)로 보정.
4. 색 이름: 색상/명도 구간표(약 12개)에서 이름을 찾아 "오늘의 하늘빛 · 맑은 물빛"으로 표시.
5. 심을 정원 체크(기본 전체), 한 줄 메모(선택, 60자).
6. "하늘 심기" → Storage 업로드 → `plant_sky` → 정원 홈으로 이동, 오늘 칸 꽃 피는 애니메이션.

- 이미 오늘 심었으면: 오늘 사진, 심은 정원 체크 상태(`set_plantings`로 변경), "다시 찍기"(교체), "지우기".
- 남은 시간 칩: 오늘 `alert_at`부터 2분 안일 때만 "1:52 남음". 그 외에는 "오늘 안에 언제든". 칩은 감성 요소이며 업로드를 막지 않는다.

### 8.4 하루 상세 `/garden/[date]?g=`
- 그날 멤버들의 하늘 사진(signed URL). 2명이면 반반 "같은 하늘" 뷰, 그 외 그리드.
- 빈 자리는 점선 타일.
- 내 사진: "이 정원에서 빼기"(`unplant`), "하늘 지우기"(`delete_sky`, 확인 다이얼로그). 오늘이면 "다시 찍기"(→ `/sky`).

### 8.5 모아보기 / 공유 카드 `/collection`
- 정원·월 선택 → 9:16 카드(월, 정원 문구, 꽃 그리드, 피어난 꽃/다 함께 모인 날/돌멩이).
- `html-to-image`로 1080×1920 PNG → `navigator.share({ files })` 가능하면 공유 시트, 아니면 다운로드.
- 카드 안 배경 번짐은 `filter: blur` 대신 `radial-gradient`로 그린다(Safari 캡처 안정성). 꽃잎 `mix-blend-mode`가 캡처에서 깨지면 불투명 색으로 대체.

### 8.6 정원 만들기 / 초대 코드 입력
- 만들기: 이름 + 둘/그룹 선택 → 초대 코드 표시 + 공유 버튼(`navigator.share` 텍스트).
- 참여: 6칸 코드 입력(대문자 자동 변환).

### 8.7 설정
- 닉네임 수정, 알림 on/off(`profiles.notify` + 구독 관리), 정원별 꽃잎 순서(드래그 → `reorder_petals`), 정원 나가기, 로그아웃.

## 9. 하늘 알림

- **구독**: 알림 허용 시 VAPID 공개키로 `pushManager.subscribe` → `push_subscriptions` upsert.
- **시각 뽑기**: `pg_cron`이 매일 00:05 KST(15:05 UTC)에 09:00~21:00 KST 사이 랜덤 분을 `daily_alerts`에 insert. 전역 1개.
- **발송**: `pg_cron` 매분 → `alert_at <= now() and sent_at is null` 행이 있으면 `pg_net`으로 Edge Function `send-sky-alert` 호출.
  - 함수가 `update ... set sent_at = now() where sent_at is null returning *`로 선점(중복 방지).
  - `notify = true` 사용자의 모든 구독에 web-push. 404/410이면 구독 삭제.
- **수신**: 서비스워커가 "지금, 하늘을 올려다봐요" 알림 → 탭하면 `/sky` 열기.
- 로컬 개발: 발송 함수 수동 호출 스크립트. 실수신은 iPhone(iOS 16.4+, 홈 화면 PWA)에서만 검증.

## 10. 에러 처리와 오프라인

- RPC 에러 코드 → 한국어 문구 매핑(`lib/data/errors.ts`). 예: `garden_full` → "정원이 가득 찼어요 (8명)".
- 업로드 실패: 압축된 blob을 메모리에 유지, "다시 시도" 한 번으로 재업로드.
- 오프라인(`navigator.onLine` + 이벤트): 심기 버튼 비활성 + 안내 문구. 서비스워커는 앱 셸만 캐시하고 데이터는 캐시하지 않는다.
- signed URL 만료: 이미지 `onError` 시 1회 재발급.
- 카메라 권한 거부/HEIC 디코드 실패: 안내 문구 + 앨범에서 선택 허용(`capture` 없는 input).

## 11. 테스트와 단계별 완료 기준

### 테스트
- **Vitest (순수 로직)**
  - `flower`: 1명/2명/n명, 0명(지난 날 돌멩이·오늘 새싹·미래), 전원(full), 일부 빈 꽃잎.
  - `date`: KST 자정 경계(UTC 14:59/15:00), 월 경계, 월 일수.
  - `month-stats`: 피어난 꽃/다 함께 모인 날/돌멩이(오늘·미래 제외).
  - `dominant-color`: 합성 픽셀 데이터로 대표색 선택, 어두운 입력의 남색 보정.
  - `color-name`: 구간 경계.
- **Vitest DB 통합 테스트** (`tests/db`, dev 클라우드 프로젝트 대상. Docker가 없어 pgTAP 대신 사용): 테스트마다 admin API로 임시 사용자를 만들고 로그인한 클라이언트로 RPC·RLS를 검증한 뒤 삭제. 항목: 첫 로그인 트리거, 정원 인원 초과 참여 거부(2인 정원으로 검증, 크기는 2/8만 허용), 다른 정원 사진 비가시, 오늘 교체 시 plantings 유지, 지난 날 `set_plantings` 거부, `reorder_petals` 검증, 나가기 시 순서 재정렬.
- **Playwright 스모크 1개**: 개발 로그인 → 테스트 이미지로 하늘 심기 → 오늘 칸에 꽃이 보임.

### 실기기 검증
iPhone은 로컬 Supabase에 접근할 수 없으므로 실기기 검증은 **Vercel 프리뷰 + 클라우드 Supabase**로 한다(🔶 표시).

| 단계 | 완료 기준 |
|---|---|
| 1a 뼈대 | `npm run dev` 동작, 토큰·폰트 적용, manifest·서비스워커 등록, dev Supabase 연결, 개발 로그인 성공 |
| 1b 실로그인 | 🔶 iPhone 홈 화면 PWA에서 카카오 로그인 후 세션 유지(실패 시 1회용 코드 방식으로 전환) |
| 2 DB | 마이그레이션 적용, DB 통합 테스트 통과, 첫 로그인에 profile + solo 정원 생성, 시드 로드 |
| 3 하늘 담기 | 압축·색 추출·업로드·심기·교체·삭제·정원 선택 변경 동작, 단위 테스트 통과. 🔶 iPhone 카메라 |
| 4 정원 홈 | 월 조회, 꽃 렌더링, 하단 카드, 하루 상세, Realtime 반영, 스모크 테스트 통과 |
| 5 그룹 | 정원 생성·코드 참여·8명 제한·전환·꽃잎 순서 변경·나가기 |
| 6 알림 | 🔶 iPhone에서 랜덤 시각 푸시 수신, 탭 시 `/sky` |
| 7 공유 카드 | 1080×1920 PNG 생성. 🔶 iPhone 공유 시트/저장 |
| 8 다듬기 | 꽃 피는 애니메이션, 빈 상태, 오프라인 안내 |

## 12. SPEC 대비 변경점

| 항목 | SPEC | 이 문서 |
|---|---|---|
| 로그인 순서 | Safari에서 먼저 로그인 후 설치 | 설치 후 PWA 안에서 로그인(iOS 저장소 분리), 대안 1회용 코드 |
| 개발 로그인 | 없음 | 로컬 전용 테스트 계정 로그인 |
| 꽃잎 순서 | 명시 없음 | `garden_members.petal_order`, 모두에게 같은 꽃, 멤버 누구나 변경 |
| 다시 찍기/삭제 | 명시 없음 | 오늘만 교체(모든 정원 반영), 삭제·특정 정원에서 빼기는 지난 날도 가능 |
| 심을 정원 변경 | 업로드 시 선택 | 오늘 사진은 이후에도 추가/제거 가능 |
| 알림 | pg_cron + Edge Function | + `daily_alerts.sent_at` 선점, `profiles.notify` |
| 이미지 경로 | 미정 | `{uid}/{local_date}/{uuid}.jpg` |
| 공유 카드 번짐 | blur | 카드 캡처용은 radial-gradient |
| 개발 DB | (로컬 가정) | Docker 없이 dev 클라우드 프로젝트, prod와 분리 |
| DB 테스트 | — | pgTAP 대신 Vitest 통합 테스트 |
| 미들웨어 | middleware.ts | Next 16 `proxy.ts` |

## 부록 A. 외부 서비스 준비 (1b단계)

1. **Supabase 프로덕션 프로젝트** 생성(리전: Northeast Asia/Seoul, dev 프로젝트와 별개). Project URL, publishable key, secret key 확보. `supabase link` 후 `supabase db push`.
2. **카카오 Developers**
   - 애플리케이션 추가 → 앱 키의 REST API 키 확보.
   - 카카오 로그인 활성화, 보안 → Client Secret 생성·활성화.
   - Redirect URI: `https://<project>.supabase.co/auth/v1/callback`
   - 동의 항목: 닉네임, 프로필 사진(이메일 없이 진행).
   - 플랫폼 → Web 사이트 도메인에 Vercel 도메인 등록.
3. **Supabase 대시보드** Auth → Providers → Kakao에 REST API 키 / Client Secret 등록. Auth → URL Configuration에 Vercel 도메인과 `/auth/callback` 추가.
4. **VAPID 키**: `npx web-push generate-vapid-keys` → 공개키는 `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, 비공개키는 Edge Function 시크릿.
5. **Vercel**: 저장소 연결, 환경변수(`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`) 등록. `NEXT_PUBLIC_DEV_LOGIN`은 등록하지 않는다.
6. **pg_cron / pg_net** 확장 활성화, cron 잡에서 쓸 Edge Function URL·서비스 키를 Vault에 저장.

## 부록 B. 개발 환경 (Docker 없음)

- 필요: Node.js 20+(현재 22). Supabase CLI는 devDependency(`npx supabase`)로 사용.
- Supabase 프로젝트를 **두 개** 둔다: `garden-farmer-dev`(개발·테스트 계정·통합 테스트), `garden-farmer`(프로덕션, 1b에서 생성). 테스트 계정이 실서비스 DB에 섞이지 않게 한다.
- `.env.local`(커밋 안 함): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `NEXT_PUBLIC_DEV_LOGIN=true`, `DEV_SEED_PASSWORD`. 키 이름만 `.env.example`에 둔다.
- 마이그레이션: `npx supabase link --project-ref <dev ref>` 후 `npx supabase db push`.
- 시드: `npm run seed` → admin API로 테스트 계정 5명(나/서연/민재/하은/도윤), "우리 둘"·"대학 동기" 정원, 이번 달 샘플 기록 생성. 멱등.
- 개발 로그인은 서버 액션이 `DEV_SEED_PASSWORD`로 로그인하므로 비밀번호가 클라이언트 번들에 들어가지 않는다.
- 통합 테스트는 Auth 로그인 rate limit에 걸릴 수 있다. dev 프로젝트의 Auth → Rate Limits에서 로그인 한도를 넉넉히 올린다.
