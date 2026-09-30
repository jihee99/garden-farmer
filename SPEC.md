# 하늘정원 (가칭) — 제품 명세서

> Claude Code 작업용 명세. 이 파일을 레포 루트에 두고 "SPEC.md 읽고 1단계부터 만들어줘"로 시작한다.
> 각 단계가 끝날 때마다 동작 확인 후 다음 단계로 넘어간다.

## 1. 한 줄 컨셉

하루 한 번 지금 보이는 하늘을 찍으면, 함께하는 사람들의 하늘색이 모여 그날의 꽃 한 송이가 피는 수채화 감성 기록 앱.
혼자, 둘, 친구 그룹(최대 8명) 모두 쓸 수 있다.

## 2. 타깃과 톤

- 요즘 세대. 부담 없이 매일 여는 앱: 글 안 써도 됨, 사진 한 장이 기록의 전부
- 좋아요·연속기록 압박 없음. 놓친 날은 귀여운 돌멩이로 남김
- 비주얼: 수채화, 따뜻한 종이색 배경, 번지는 파스텔
- 결과물은 인스타 스토리(9:16) 카드로 공유

## 3. 플랫폼 & 스택

- **iOS 홈 화면용 PWA** (Safari → 홈 화면에 추가 → 풀스크린)
- Next.js (App Router) + TypeScript + Tailwind CSS
- Supabase: Auth, Postgres, Storage(사진), Realtime, Edge Functions, pg_cron
- 배포: Vercel
- Web Push: iOS 16.4+ 에서 홈 화면에 추가된 PWA만 지원 → 설치 유도 화면 필요

## 4. 인증 — 카카오 로그인

- Supabase Auth의 Kakao OAuth provider 사용 (`signInWithOAuth({ provider: 'kakao' })`)
- Kakao Developers에서 앱 생성 → REST API 키 / Client Secret → Supabase 대시보드 Auth > Providers > Kakao에 등록
- Redirect URI: `https://<project>.supabase.co/auth/v1/callback`
- 동의 항목: 닉네임, 프로필 사진 (이메일을 필수 동의로 받으려면 카카오 비즈 앱 전환이 필요할 수 있음 → MVP에선 이메일 없이 진행)
- **주의(iOS PWA)**: standalone 모드에서 OAuth 리다이렉트가 Safari로 튀어 세션이 PWA에 안 돌아오는 경우가 있음.
  - 대응: 로그인은 설치 전 Safari에서 먼저 끝내도록 온보딩 순서 설계, 또는 PKCE 흐름 + 콜백 페이지에서 세션 확정 후 앱으로 복귀 안내
  - 1단계에서 실제 iPhone으로 반드시 검증
- 첫 로그인 시 `profiles` 행 생성 + 개인 정원(solo) 자동 생성

## 5. 핵심 규칙

### 5.1 정원(garden)
- 사용자는 여러 정원을 가질 수 있음: 나만의 정원(1명, 자동 생성), 둘, 그룹(최대 8명)
- 초대 코드(6자리)로 참여
- 월 단위로 한 판이 완성됨

### 5.2 하늘 기록
- 하루 1장 (정원과 무관하게 사용자당 1장)
- 찍은 사진 한 장을 여러 정원에 동시에 심을 수 있음 (체크박스로 선택, 기본값 전체 선택)
- 업로드 시 클라이언트에서 대표색(dominant color) 추출 → `dominant_color` 저장
  - canvas로 축소 후 평균/k-means 3색 중 채도 높은 색. 너무 어두우면 밤 남색 계열로 보정
- 한 줄 메모는 선택
- 이미지는 업로드 전 긴 변 1600px, JPEG 0.8로 압축

### 5.3 꽃 계산 (저장하지 않고 매번 계산)
- 꽃잎 수: 1명 → 5장 전부 같은 색 / 2명 → 6장 번갈아 / n명(3~8) → n장
- 꽃잎 i의 주인: 1명 `0`, 2명 `i % 2`, n명 `i`
- 주인이 그날 하늘을 심었으면 그 `dominant_color`, 아니면 흰 꽃잎 + 점선 테두리
- 그날 심은 사람 0명 → 지난 날은 **돌멩이**, 오늘은 **새싹**
- 전원 참여 → 꽃 가운데가 금빛으로 반짝임 (#E0A73E + 연한 광채)
- 날짜 기준: Asia/Seoul 자정

### 5.4 하늘 알림 (BeReal 방식)
- 정원 단위가 아니라 사용자 단위로 매일 1회, 09:00~21:00 사이 랜덤 시각
- 같은 정원 멤버들이 같은 순간을 공유하도록, 하루 랜덤 시각은 전역 1개로 시작 (추후 정원별로 분리 가능)
- 알림 후 2분 카운트다운은 감성 요소일 뿐, 지나도 그날 안에는 업로드 가능
- 구현: pg_cron이 매일 00:05에 오늘의 시각을 뽑아 저장 → 해당 시각에 Edge Function이 web-push 발송

## 6. 데이터 모델 (Postgres)

```sql
profiles (
  id uuid primary key references auth.users,
  nickname text not null,
  avatar_url text,
  created_at timestamptz default now()
)

gardens (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null check (kind in ('solo','group')),
  invite_code text unique,          -- solo는 null
  max_members int not null default 8,
  created_by uuid references profiles(id),
  created_at timestamptz default now()
)

garden_members (
  garden_id uuid references gardens(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  joined_at timestamptz default now(),
  primary key (garden_id, user_id)
)

sky_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  local_date date not null,         -- Asia/Seoul 기준 날짜
  taken_at timestamptz not null,
  image_path text not null,         -- Storage 경로
  dominant_color text not null,     -- '#9CC3E4'
  note text,
  unique (user_id, local_date)
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
  alert_at timestamptz not null
)
```

### RLS
- `gardens`, `garden_members`, `plantings`: 해당 정원 멤버만 조회
- `sky_photos`: 본인 + 같은 정원에 심어진 사진만 조회 (plantings 조인)
- Storage 버킷 `skies`: 비공개, signed URL로 제공
- 멤버 수 8명 초과 참여는 DB 함수로 막기

### 월별 정원 조회
`plantings` ⨝ `sky_photos` 에서 garden_id + 해당 월로 필터 → (날짜, user_id, dominant_color) 목록 → 5.3 규칙으로 클라이언트에서 꽃 계산.

## 7. 화면

디자인 참고: 하늘정원 목업 캔버스 (정원 홈 / 하늘 담기 / 월말 공유 카드)

1. **온보딩**: 컨셉 3장 → 카카오 로그인 → "홈 화면에 추가" 안내 → 알림 허용
2. **정원 홈** (메인)
   - 상단: 연·계절, "N월의 정원", 이번 달 핀 꽃 수, 멤버 아바타
   - 정원 전환 알약 탭 (나만의 정원 / 우리 둘 / 그룹명 + 인원)
   - 6열 달력 그리드에 날짜별 꽃·돌멩이·새싹
   - 날짜 탭 → 하단 카드: 그날 멤버별 하늘색 타일(빈 자리는 점선), 안내 문구
   - 하단 탭: 정원 / (가운데 원형) 하늘 담기 / 모아보기
3. **하늘 담기**
   - 카메라 촬영 (`<input type="file" accept="image/*" capture="environment">`)
   - 남은 시간 칩, 추출된 하늘빛 표시, 심을 정원 체크, 한 줄 메모, "하늘 심기"
4. **하루 상세**: 그날 멤버들의 하늘 사진을 나란히 (둘일 땐 반반 "같은 하늘" 뷰, 그룹은 그리드)
5. **모아보기 / 공유 카드**: 월말 정원 9:16 카드 + 피어난 꽃 / 다 함께 모인 날 / 돌멩이 수 → 이미지로 저장
6. **정원 만들기 / 초대 코드 입력**
7. **설정**: 프로필, 알림, 로그아웃, 정원 나가기

## 8. 디자인 토큰

| 토큰 | 값 | 용도 |
|---|---|---|
| paper | #F7F2E9 | 배경 |
| card | rgba(255,253,248,0.82) | 카드 |
| line | #E6DDCD | 테두리 |
| ink | #35322D | 본문 |
| muted | #6E675C | 보조 텍스트 |
| sky-deep | #4F7299 | 주요 버튼 |
| wash-blue | #BCD6EC | 배경 번짐 |
| wash-blush | #F2CBBE | 배경 번짐 |
| gold | #E0A73E | 전원 참여 꽃 가운데 |
| stone | #CBC3B5 | 돌멩이 |
| sprout | #9DBB86 | 새싹 |

- 폰트: 제목 Gowun Batang, 본문 Gowun Dodum
- 꽃잎: `border-radius: 50% 50% 46% 46% / 64% 64% 36% 36%`, `mix-blend-mode: multiply`, opacity 0.8, 안쪽 흰 번짐 그림자
- 배경 번짐: 큰 원 + `filter: blur(46px)`, opacity 0.5~0.6
- 터치 영역 최소 44px, 텍스트 대비 4.5:1 이상

## 9. 개발 단계

1. **뼈대**: Next.js 프로젝트, Tailwind 토큰, PWA manifest/아이콘/서비스워커, Supabase 연결, 카카오 로그인 → 실제 iPhone 홈 화면 PWA에서 로그인 검증
2. **DB**: 마이그레이션, RLS, 첫 로그인 시 profile + solo 정원 생성
3. **하늘 담기**: 촬영/압축/대표색 추출/업로드/여러 정원에 심기
4. **정원 홈**: 월별 조회 + 꽃 렌더링 컴포넌트(`<Flower petals=... />`), 날짜 상세 카드
5. **그룹**: 정원 생성, 초대 코드, 멤버 제한, 정원 전환
6. **알림**: push 구독 저장, 일일 랜덤 시각, Edge Function 발송
7. **공유 카드**: 9:16 렌더 → 이미지 저장 (html-to-image 등)
8. **다듬기**: 꽃 피는 애니메이션, 빈 상태, 오프라인 처리

## 10. 나중에 (MVP 밖)
- 수채화 꽃을 SVG 필터(feTurbulence/feDisplacementMap)로 번지게
- 둘 전용 "같은 하늘" 비교 뷰 강화, 타임캡슐 편지
- 계절별 정원 테마, 연말 정원 결산
