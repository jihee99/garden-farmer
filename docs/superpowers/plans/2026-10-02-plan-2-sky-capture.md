# 계획 2: 하늘 담기 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 사용자가 `/sky`에서 하늘을 찍어(또는 앨범에서 골라) 압축·대표색 추출 후 여러 정원에 심고, 오늘 심은 하늘의 정원 변경·다시 찍기·지우기를 할 수 있게 한다.

**Architecture:** 이미지 처리 중 순수 계산(색 변환, k-means 대표색, 색 이름, 크기 맞춤, 알림 칩)은 `lib/image`·`lib/domain`에 두고 Vitest로 검증한다. 브라우저 전용 처리(createImageBitmap·canvas 압축)는 `lib/image/compress.ts` 하나에 모은다. Supabase 호출은 `lib/data/*` 래퍼가 타입·에러 코드를 정리하고(`AppError`), 화면은 서버 컴포넌트가 초기 데이터를 읽어 클라이언트 컴포넌트 `SkyCapture`에 넘긴다. 전체 흐름은 Playwright(로컬 Chrome) E2E로 확인한다.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind 4, @supabase/ssr, Vitest 5, Playwright(@playwright/test, `channel: 'chrome'`)

**설계 문서:** `docs/superpowers/specs/2026-09-30-sky-garden-design.md` (8.3 하늘 담기, 6장 RPC, 10장 에러 처리)
**이전 계획 후속 과제:** `docs/superpowers/plans/2026-10-02-plan-1-followups.md` "계획 2" 절 — 이 계획의 Task 1·3에서 처리

## Global Constraints

- 저장소 루트: `C:\Users\JBT\project\garden-farmer` — 모든 명령은 여기서 실행(Git Bash). 커밋 작성자는 저장소 로컬 설정을 그대로 쓴다. 커밋 메시지 끝에 빈 줄 + `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- 사용자당 하루 하늘 1장. 같은 사진이 여러 정원에 심긴다. 다시 찍기(교체)는 오늘만, 교체 시 모든 정원에 반영.
- 날짜는 서버가 Asia/Seoul로 결정한다. 클라이언트는 업로드 경로에만 `seoulDate()`를 쓴다.
- 이미지 경로(버킷 `skies` 내부): `{uid}/{local_date}/{uuid}.jpg` (테스트·시드는 `.png`도 허용).
- 압축: 긴 변 1600px, JPEG 품질 0.8, EXIF 회전 보정(`createImageBitmap(file, { imageOrientation: 'from-image' })`).
- 대표색: 긴 변 64px로 줄인 픽셀 → k-means(k=3) → 픽셀 비율 15% 이상인 군집 중 채도가 가장 높은 색. HSL 명도 < 0.2이면 밤 남색으로 보정(색상 220~235°는 유지, 그 밖이면 228°, 채도 0.3~0.6로 제한, 명도 0.28). 결과는 대문자 `#RRGGBB`.
- 한 줄 메모는 선택, 최대 60자.
- 남은 시간 칩: 오늘 `daily_alerts.alert_at`부터 2분 동안만 `m:ss 남음`, 그 밖에는 `오늘 안에 언제든`. 업로드를 막지 않는다.
- 오프라인이면 심기 버튼 비활성 + 안내 문구. 업로드 실패 시 같은 압축본으로 "다시 시도" 가능.
- 에러 문구는 `lib/data/errors.ts`의 `messageFor(code)` 한국어 문구로만 보여준다.
- 디자인(목업 "2 · 하늘 담기"): 사진 영역 높이 330px·모서리 28px·배경 #C7DDEF, 하늘빛 칩 카드(border line, bg card, 모서리 18px, 원 40px), 정원 체크 행 최소 44px·모서리 14px, 심기 버튼 높이 54px·bg sky-deep·흰 글씨 17px, 남은 시간 칩 bg #F2DCD2·글씨 #7A3E2C. 터치 영역 최소 44px.
- 비밀값은 `.env.local`에만. 출력·로그에 찍지 않는다.
- DB 테스트는 공유 dev 클라우드 프로젝트를 쓴다. Auth 로그인 한도 기본값(IP당 5분 30회)을 넘지 않게 전체 DB 스위트는 작업당 한두 번만 돌린다.

---

## File Structure

| 파일 | 책임 |
|---|---|
| `supabase/migrations/20261002000100_sky_validation.sql` | `plant_sky` 경로·메모 검증, `set_plantings` 행 잠금 |
| `lib/image/color.ts` | RGB↔HSL, hex 변환 |
| `lib/image/dominant-color.ts` | 픽셀 → 대표색 |
| `lib/image/color-name.ts` | 대표색 → "맑은 물빛" 등 이름 |
| `lib/image/size.ts` | 긴 변 기준 크기 맞춤 |
| `lib/image/compress.ts` | (브라우저) 파일 → JPEG Blob + 색 표본 픽셀 |
| `lib/domain/alert-chip.ts` | 남은 시간 칩 문구 |
| `lib/data/errors.ts` | `AppError`, 에러 코드 → 한국어 문구 |
| `lib/data/client.ts` | `DbClient` 타입 |
| `lib/data/sky.ts` | 하늘 업로드·심기·정원 변경·삭제·오늘 하늘 조회·signed URL |
| `lib/data/gardens.ts` | 내 정원 목록(인원 수 포함) |
| `lib/data/alerts.ts` | 오늘 알림 시각 |
| `lib/hooks/use-online.ts` | 온라인 상태 훅 |
| `components/sky/SkyCapture.tsx` | 하늘 담기 화면 상태·흐름 |
| `components/sky/CaptureInputs.tsx` | "하늘 찍기"/"앨범에서 고르기"/"다시 찍기" 파일 입력 |
| `components/sky/SkyColorChip.tsx` | 오늘의 하늘빛 카드 |
| `components/sky/GardenChecklist.tsx` | 심을 정원 체크 목록 |
| `components/sky/AlertChip.tsx` | 남은 시간 칩 |
| `app/(app)/sky/page.tsx` | 서버: 초기 데이터 로드 |
| `app/(app)/garden/page.tsx` | (수정) "하늘 담기" 링크 |
| `playwright.config.ts`, `tests/e2e/helpers.ts`, `tests/e2e/sky.spec.ts` | E2E |

---

### Task 1: DB 검증 보강 (경로·메모·정원 변경 잠금)

**Files:**
- Create: `supabase/migrations/20261002000100_sky_validation.sql`
- Modify: `tests/db/sky.test.ts` (beforeAll 에러 확인, 새 테스트 1개)

**Interfaces:**
- Consumes: 기존 `plant_sky`, `set_plantings`(0400·0300 정의), 테스트 헬퍼(`createTestUser`, `expectRpcError`, `trackUpload`, `admin`)
- Produces: `plant_sky` 새 에러 코드 `invalid_note`. `invalid_path` 조건이 `^<uid>/<오늘>/<uuid>\.(jpg|png)$`로 엄격해짐. 시그니처 변화 없음.

- [ ] **Step 1: `tests/db/sky.test.ts`의 `beforeAll`을 에러를 확인하도록 교체**

기존:
```ts
  beforeAll(async () => {
    a = await createTestUser('에이')
    b = await createTestUser('비')
    outsider = await createTestUser('남')
    const { data } = await a.client.rpc('create_garden', { p_name: '같은 하늘', p_max_members: 2 })
    shared = (data as { id: string; invite_code: string }).id
    await b.client.rpc('join_garden', { p_code: (data as { invite_code: string }).invite_code })
    aSolo = await soloGardenId(a)
  })
```
교체:
```ts
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
```

- [ ] **Step 2: 실패하는 검증 테스트 추가**

`it('plant_sky: 입력 검증', ...)` 바로 다음에 추가:
```ts
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
```

- [ ] **Step 3: 실패 확인**

Run: `npm run test:db -- sky`
Expected: 새 테스트 FAIL — 어제 날짜 경로가 거부되지 않음(`expected undefined to be 'invalid_path'` 류). (이 실행에서 다른 테스트가 연쇄로 실패해도 된다 — 거부되지 않은 호출이 오늘 사진을 바꾸기 때문.)

- [ ] **Step 4: 마이그레이션 작성**

`supabase/migrations/20261002000100_sky_validation.sql`:
```sql
-- 하늘 RPC 보강 2: 경로·메모 검증, set_plantings 행 잠금

create or replace function public.plant_sky(p_image_path text, p_color text, p_note text, p_garden_ids uuid[])
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
  if p_image_path is null
     or p_image_path !~ ('^' || uid::text || '/' || to_char(today, 'YYYY-MM-DD') || '/[0-9a-f-]{36}\.(jpg|png)$')
  then
    raise exception 'invalid_path';
  end if;
  if p_color is null or p_color !~ '^#[0-9A-F]{6}$' then raise exception 'invalid_color'; end if;
  if p_note is not null and char_length(trim(p_note)) > 60 then raise exception 'invalid_note'; end if;

  insert into public.sky_photos (user_id, local_date, taken_at, image_path, dominant_color, note)
  values (uid, today, now(), p_image_path, p_color, nullif(trim(p_note), ''))
  on conflict (user_id, local_date) do nothing
  returning id into pid;

  if pid is null then
    select * into existing from public.sky_photos where user_id = uid and local_date = today for update;
    pid := existing.id;
    old_path := nullif(existing.image_path, p_image_path);
    update public.sky_photos
       set image_path = p_image_path,
           dominant_color = p_color,
           note = nullif(trim(p_note), ''),
           taken_at = now()
     where id = pid;
  end if;

  perform public.sync_plantings(pid, today, p_garden_ids);
  return query select pid, old_path;
end
$$;

create or replace function public.set_plantings(p_photo uuid, p_garden_ids uuid[])
returns void
language plpgsql security definer set search_path = '' as $$
declare
  s public.sky_photos := public.own_photo(p_photo);
begin
  perform 1 from public.sky_photos where id = s.id for update;
  if s.local_date <> public.seoul_today() then raise exception 'not_today'; end if;
  perform public.assert_member_of_all(p_garden_ids);
  perform public.sync_plantings(s.id, s.local_date, p_garden_ids);
end
$$;
```

- [ ] **Step 5: 적용·통과 확인**

```bash
npm run db:push -- --yes
npm run db:types
npm run test:db
```
Expected: 마이그레이션 적용 성공. 전체 DB 스위트 통과(schema 5, gardens 7, sky 11 — 기존 10 + 새 1). `database.types.ts`는 시그니처가 같아 변화가 없을 수 있다.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20261002000100_sky_validation.sql tests/db/sky.test.ts lib/supabase/database.types.ts
git commit -m "feat(db): plant_sky 경로·메모 검증 강화, set_plantings 행 잠금"
```

---

### Task 2: 색·크기 순수 함수 (대표색, 색 이름, 크기 맞춤)

**Files:**
- Create: `lib/image/color.ts`, `lib/image/dominant-color.ts`, `lib/image/color-name.ts`, `lib/image/size.ts`
- Test: `tests/unit/color.test.ts`, `tests/unit/dominant-color.test.ts`, `tests/unit/color-name.test.ts`, `tests/unit/size.test.ts`

**Interfaces:**
- Produces:
  - `type Rgb = [number, number, number]`, `type Hsl = { h: number; s: number; l: number }` (h 0~360, s·l 0~1)
  - `rgbToHsl(rgb: Rgb): Hsl`, `hslToRgb(hsl: Hsl): Rgb`, `toHex(rgb: Rgb): string`(대문자), `fromHex(hex: string): Rgb`
  - `dominantColor(rgba: Uint8ClampedArray): string` — RGBA 픽셀 배열 → 대문자 `#RRGGBB`
  - `colorName(hex: string): string`
  - `fitWithin(width: number, height: number, maxSide: number): { width: number; height: number }`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/unit/color.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { fromHex, hslToRgb, rgbToHsl, toHex, type Rgb } from '@/lib/image/color'

describe('color', () => {
  it('rgbToHsl: 목업 하늘색 #9CC3E4', () => {
    const { h, s, l } = rgbToHsl([156, 195, 228])
    expect(h).toBeCloseTo(207.5, 0)
    expect(s).toBeCloseTo(0.57, 2)
    expect(l).toBeCloseTo(0.753, 2)
  })

  it('rgbToHsl: 무채색은 채도 0', () => {
    expect(rgbToHsl([128, 128, 128])).toEqual({ h: 0, s: 0, l: 128 / 255 })
  })

  it('hslToRgb는 rgbToHsl의 역함수', () => {
    const samples: Rgb[] = [[156, 195, 228], [242, 184, 162], [132, 148, 198], [10, 15, 30], [255, 255, 255], [0, 0, 0]]
    for (const rgb of samples) expect(hslToRgb(rgbToHsl(rgb))).toEqual(rgb)
  })

  it('toHex는 대문자, fromHex는 역변환', () => {
    expect(toHex([156, 195, 228])).toBe('#9CC3E4')
    expect(toHex([0, 10, 255])).toBe('#000AFF')
    expect(fromHex('#9CC3E4')).toEqual([156, 195, 228])
    expect(fromHex('#9cc3e4')).toEqual([156, 195, 228])
  })
})
```

`tests/unit/dominant-color.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { rgbToHsl, fromHex, type Rgb } from '@/lib/image/color'
import { dominantColor } from '@/lib/image/dominant-color'

function pixels(parts: [Rgb, number][], alpha = 255): Uint8ClampedArray {
  const out: number[] = []
  for (const [rgb, count] of parts) for (let i = 0; i < count; i++) out.push(...rgb, alpha)
  return new Uint8ClampedArray(out)
}

describe('dominantColor', () => {
  it('한 가지 색이면 그 색', () => {
    expect(dominantColor(pixels([[[156, 195, 228], 50]]))).toBe('#9CC3E4')
  })

  it('회색 건물 60% + 파란 하늘 40%면 채도 높은 하늘색', () => {
    expect(dominantColor(pixels([[[176, 176, 176], 60], [[127, 181, 221], 40]]))).toBe('#7FB5DD')
  })

  it('15% 미만의 작은 군집은 채도가 높아도 무시한다', () => {
    expect(dominantColor(pixels([[[169, 184, 198], 90], [[255, 0, 0], 10]]))).toBe('#A9B8C6')
  })

  it('반투명 픽셀(alpha < 128)은 무시한다', () => {
    const transparentRed = pixels([[[255, 0, 0], 30]], 0)
    const blue = pixels([[[127, 181, 221], 10]])
    expect(dominantColor(new Uint8ClampedArray([...transparentRed, ...blue]))).toBe('#7FB5DD')
  })

  it('어두운 밤하늘은 남색으로 보정한다(색상 220~235°는 유지)', () => {
    const { h, l } = rgbToHsl(fromHex(dominantColor(pixels([[[10, 15, 30], 20]]))))
    expect(h).toBeGreaterThanOrEqual(220)
    expect(h).toBeLessThanOrEqual(235)
    expect(l).toBeCloseTo(0.28, 1)
  })

  it('색상이 없는 검정은 228° 남색으로 보정한다', () => {
    const { h, s, l } = rgbToHsl(fromHex(dominantColor(pixels([[[0, 0, 0], 20]]))))
    expect(h).toBeCloseTo(228, -1)
    expect(s).toBeCloseTo(0.3, 1)
    expect(l).toBeCloseTo(0.28, 1)
  })

  it('픽셀이 하나도 없으면 남색 기본값', () => {
    const { l } = rgbToHsl(fromHex(dominantColor(new Uint8ClampedArray())))
    expect(l).toBeCloseTo(0.28, 1)
  })
})
```

`tests/unit/color-name.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { colorName } from '@/lib/image/color-name'

describe('colorName', () => {
  it.each([
    ['#9CC3E4', '맑은 물빛'],
    ['#4F86B8', '푸른 하늘빛'],
    ['#8494C6', '깊은 파란빛'],
    ['#2B3963', '밤 남색빛'],
    ['#F2CE8C', '노을 살구빛'],
    ['#F2B8A2', '노을 다홍빛'],
    ['#C7B2DE', '저녁 보랏빛'],
    ['#E9A9BD', '노을 분홍빛'],
    ['#EEEEEE', '구름 흰빛'],
    ['#8A8A8A', '흐린 잿빛'],
  ])('%s → %s', (hex, name) => {
    expect(colorName(hex)).toBe(name)
  })
})
```

`tests/unit/size.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { fitWithin } from '@/lib/image/size'

describe('fitWithin', () => {
  it('긴 변을 maxSide로 줄이고 비율을 유지한다', () => {
    expect(fitWithin(4032, 3024, 1600)).toEqual({ width: 1600, height: 1200 })
    expect(fitWithin(3024, 4032, 64)).toEqual({ width: 48, height: 64 })
  })

  it('이미 작으면 그대로', () => {
    expect(fitWithin(800, 600, 1600)).toEqual({ width: 800, height: 600 })
  })

  it('아주 가늘어도 1px 이상', () => {
    expect(fitWithin(10000, 1, 64)).toEqual({ width: 64, height: 1 })
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npm test`
Expected: 새 4개 파일 FAIL — 모듈 없음.

- [ ] **Step 3: 구현**

`lib/image/color.ts`:
```ts
export type Rgb = [number, number, number]
/** h: 0~360, s·l: 0~1 */
export type Hsl = { h: number; s: number; l: number }

export function rgbToHsl([r, g, b]: Rgb): Hsl {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const l = (max + min) / 2
  const d = max - min
  if (d === 0) return { h: 0, s: 0, l }

  const s = d / (1 - Math.abs(2 * l - 1))
  let h: number
  if (max === rn) h = ((gn - bn) / d) % 6
  else if (max === gn) h = (bn - rn) / d + 2
  else h = (rn - gn) / d + 4
  h *= 60
  if (h < 0) h += 360
  return { h, s, l }
}

export function hslToRgb({ h, s, l }: Hsl): Rgb {
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  const [r, g, b] =
    h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x]
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)]
}

export function toHex([r, g, b]: Rgb): string {
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`.toUpperCase()
}

export function fromHex(hex: string): Rgb {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
```

`lib/image/dominant-color.ts`:
```ts
import { hslToRgb, rgbToHsl, toHex, type Hsl, type Rgb } from './color'

const K = 3
const ITERATIONS = 10
const MIN_SHARE = 0.15
const DARK_LIGHTNESS = 0.2
const NAVY_HUE_RANGE: [number, number] = [220, 235]
const NAVY_DEFAULT_HUE = 228
const NAVY_SATURATION: [number, number] = [0.3, 0.6]
const NAVY_LIGHTNESS = 0.28

type Cluster = { center: Rgb; count: number }

/** 작게 줄인 이미지의 RGBA 픽셀에서 하늘 대표색을 대문자 #RRGGBB로 고른다. */
export function dominantColor(rgba: Uint8ClampedArray): string {
  const pixels = opaquePixels(rgba)
  if (pixels.length === 0) return toNightNavy({ h: NAVY_DEFAULT_HUE, s: 0, l: 0 })

  const clusters = kMeans(pixels).filter((c) => c.count > 0)
  const large = clusters.filter((c) => c.count / pixels.length >= MIN_SHARE)
  const candidates = large.length > 0 ? large : clusters
  const best = candidates.reduce((a, b) => {
    const sa = rgbToHsl(a.center).s
    const sb = rgbToHsl(b.center).s
    return sb > sa || (sb === sa && b.count > a.count) ? b : a
  })

  const hsl = rgbToHsl(best.center)
  return hsl.l < DARK_LIGHTNESS ? toNightNavy(hsl) : toHex(best.center)
}

function opaquePixels(rgba: Uint8ClampedArray): Rgb[] {
  const out: Rgb[] = []
  for (let i = 0; i + 3 < rgba.length; i += 4) {
    if (rgba[i + 3] >= 128) out.push([rgba[i], rgba[i + 1], rgba[i + 2]])
  }
  return out
}

function distance(a: Rgb, b: Rgb): number {
  return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2
}

function luma([r, g, b]: Rgb): number {
  return 0.299 * r + 0.587 * g + 0.114 * b
}

/** 결정적 초기값: 밝기 중앙값 픽셀에서 시작해, 이미 고른 중심들과 가장 먼 픽셀을 차례로 고른다. */
function initialCenters(pixels: Rgb[]): Rgb[] {
  const byLuma = [...pixels].sort((p, q) => luma(p) - luma(q))
  const centers: Rgb[] = [byLuma[Math.floor(byLuma.length / 2)]]
  while (centers.length < K) {
    let farthest = pixels[0]
    let farthestDistance = -1
    for (const p of pixels) {
      const d = Math.min(...centers.map((c) => distance(p, c)))
      if (d > farthestDistance) {
        farthest = p
        farthestDistance = d
      }
    }
    centers.push(farthest)
  }
  return centers
}

function kMeans(pixels: Rgb[]): Cluster[] {
  let centers = initialCenters(pixels)
  let clusters: Cluster[] = []
  for (let iteration = 0; iteration < ITERATIONS; iteration++) {
    const sums = centers.map(() => [0, 0, 0, 0])
    for (const p of pixels) {
      let nearest = 0
      let nearestDistance = Infinity
      centers.forEach((c, k) => {
        const d = distance(p, c)
        if (d < nearestDistance) {
          nearest = k
          nearestDistance = d
        }
      })
      const s = sums[nearest]
      s[0] += p[0]
      s[1] += p[1]
      s[2] += p[2]
      s[3] += 1
    }
    clusters = centers.map((c, k) => {
      const [r, g, b, n] = sums[k]
      return n === 0 ? { center: c, count: 0 } : { center: [Math.round(r / n), Math.round(g / n), Math.round(b / n)], count: n }
    })
    centers = clusters.map((c) => c.center)
  }
  return clusters
}

function toNightNavy({ h, s }: Hsl): string {
  const [minHue, maxHue] = NAVY_HUE_RANGE
  const hue = s > 0 && h >= minHue && h <= maxHue ? h : NAVY_DEFAULT_HUE
  const [minSat, maxSat] = NAVY_SATURATION
  const saturation = Math.min(maxSat, Math.max(minSat, s))
  return toHex(hslToRgb({ h: hue, s: saturation, l: NAVY_LIGHTNESS }))
}
```

`lib/image/color-name.ts`:
```ts
import { fromHex, rgbToHsl } from './color'

/** 대표색에 붙이는 이름. 하늘정원 하늘 담기 화면의 "오늘의 하늘빛 · ○○"에 쓴다. */
export function colorName(hex: string): string {
  const { h, s, l } = rgbToHsl(fromHex(hex))
  if (l < 0.3) return '밤 남색빛'
  if (s < 0.15) return l > 0.75 ? '구름 흰빛' : '흐린 잿빛'
  if (h < 20 || h >= 345) return '노을 다홍빛'
  if (h < 45) return '노을 살구빛'
  if (h < 70) return '햇살 노란빛'
  if (h < 160) return '풀잎 초록빛'
  if (h < 190) return '청록 물빛'
  if (h < 215) return l > 0.7 ? '맑은 물빛' : '푸른 하늘빛'
  if (h < 250) return '깊은 파란빛'
  if (h < 290) return '저녁 보랏빛'
  return '노을 분홍빛'
}
```

`lib/image/size.ts`:
```ts
/** 비율을 유지하며 긴 변을 maxSide 이하로 맞춘다(확대하지 않음). */
export function fitWithin(width: number, height: number, maxSide: number): { width: number; height: number } {
  const scale = Math.min(1, maxSide / Math.max(width, height))
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}
```

- [ ] **Step 4: 통과 확인**

Run: `npm test`
Expected: 기존 2개 파일 + 새 4개 파일 모두 통과. 실패하는 색 이름 기대값이 있으면 구현의 경계값이 아니라 **테스트 기대값이 설계 의도(위 표)와 맞는지** 먼저 계산해 보고, 구현 경계는 바꾸지 말고 보고한다.

- [ ] **Step 5: Commit**

```bash
git add lib/image tests/unit/color.test.ts tests/unit/dominant-color.test.ts tests/unit/color-name.test.ts tests/unit/size.test.ts
git commit -m "feat(image): 대표색 k-means 추출, 색 이름, 크기 맞춤"
```

---

### Task 3: 데이터 래퍼·에러 문구·알림 칩

**Files:**
- Create: `lib/data/errors.ts`, `lib/data/client.ts`, `lib/data/sky.ts`, `lib/data/gardens.ts`, `lib/data/alerts.ts`, `lib/domain/alert-chip.ts`
- Test: `tests/unit/errors.test.ts`, `tests/unit/alert-chip.test.ts`, `tests/db/sky-data.test.ts`

**Interfaces:**
- Consumes: `Database` 타입, RPC `plant_sky`/`set_plantings`/`delete_sky`, 테이블 `sky_photos`(+`plantings` 임베드), `gardens`(+`garden_members(count)`), `daily_alerts`
- Produces:
  - `class AppError extends Error { code: string; userMessage: string }`, `messageFor(code: string): string`, `toAppError(e: { message: string }): AppError`, `userMessageOf(e: unknown): string`
  - `type DbClient = SupabaseClient<Database>`
  - `SKY_BUCKET = 'skies'`, `skyImagePath(userId: string, localDate: string, ext?: 'jpg' | 'png'): string`
  - `uploadSkyImage(db: DbClient, path: string, image: Blob): Promise<void>` (실패 시 `AppError('upload_failed')`)
  - `plantSky(db, input: { imagePath: string; color: string; note: string | null; gardenIds: string[] }): Promise<{ photoId: string; oldImagePath: string | null }>` (색은 대문자로 보냄)
  - `setPlantings(db, photoId: string, gardenIds: string[]): Promise<void>`
  - `deleteSky(db, photoId: string): Promise<string>` (삭제된 경로)
  - `removeSkyImage(db, path: string | null): Promise<void>` (실패해도 던지지 않음)
  - `signedSkyUrl(db, path: string): Promise<string | null>` (1시간)
  - `type TodaySky = { id: string; imagePath: string; color: string; note: string | null; gardenIds: string[] }`, `getTodaySky(db, userId: string, localDate: string): Promise<TodaySky | null>`
  - `type GardenOption = { id: string; name: string; kind: 'solo' | 'group'; memberCount: number }`, `listMyGardens(db): Promise<GardenOption[]>`
  - `getTodayAlert(db, localDate: string): Promise<Date | null>`
  - `ALERT_WINDOW_MS = 120000`, `alertChip(now: Date, alertAt: Date | null): { label: string; counting: boolean }`

- [ ] **Step 1: 실패하는 단위 테스트 작성**

`tests/unit/errors.test.ts`:
```ts
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

  it('userMessageOf: AppError가 아니면 기본 문구', () => {
    expect(userMessageOf(new AppError('upload_failed'))).toBe('사진을 올리지 못했어요. 다시 시도해 주세요.')
    expect(userMessageOf(new TypeError('Failed to fetch'))).toBe('잠시 문제가 생겼어요. 다시 시도해 주세요.')
  })
})
```

`tests/unit/alert-chip.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { alertChip } from '@/lib/domain/alert-chip'

const at = new Date('2026-10-02T04:47:00Z')
const later = (ms: number) => new Date(at.getTime() + ms)

describe('alertChip', () => {
  it('알림이 없으면 언제든', () => {
    expect(alertChip(at, null)).toEqual({ label: '오늘 안에 언제든', counting: false })
  })

  it('알림 전이면 언제든', () => {
    expect(alertChip(later(-1000), at)).toEqual({ label: '오늘 안에 언제든', counting: false })
  })

  it('알림 순간에는 2:00', () => {
    expect(alertChip(at, at)).toEqual({ label: '2:00 남음', counting: true })
  })

  it('8초 뒤에는 1:52', () => {
    expect(alertChip(later(8000), at)).toEqual({ label: '1:52 남음', counting: true })
  })

  it('2분이 지나면 언제든', () => {
    expect(alertChip(later(120_000), at)).toEqual({ label: '오늘 안에 언제든', counting: false })
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npm test`
Expected: 새 2개 파일 FAIL — 모듈 없음.

- [ ] **Step 3: 에러·알림 칩 구현**

`lib/data/errors.ts`:
```ts
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

  constructor(code: string) {
    super(code)
    this.name = 'AppError'
    this.code = code
  }

  get userMessage(): string {
    return messageFor(this.code)
  }
}

export function toAppError(error: { message: string }): AppError {
  return new AppError(error.message)
}

export function userMessageOf(error: unknown): string {
  return error instanceof AppError ? error.userMessage : FALLBACK
}
```

`lib/domain/alert-chip.ts`:
```ts
export const ALERT_WINDOW_MS = 2 * 60 * 1000

/** 하늘 알림 뒤 2분 동안은 남은 시간을, 그 밖에는 '오늘 안에 언제든'을 보여준다(업로드는 막지 않는다). */
export function alertChip(now: Date, alertAt: Date | null): { label: string; counting: boolean } {
  if (alertAt) {
    const elapsed = now.getTime() - alertAt.getTime()
    if (elapsed >= 0 && elapsed < ALERT_WINDOW_MS) {
      const seconds = Math.ceil((ALERT_WINDOW_MS - elapsed) / 1000)
      return { label: `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')} 남음`, counting: true }
    }
  }
  return { label: '오늘 안에 언제든', counting: false }
}
```

- [ ] **Step 4: 단위 테스트 통과 확인**

Run: `npm test`
Expected: 모든 단위 테스트 통과.

- [ ] **Step 5: 실패하는 데이터 래퍼 통합 테스트 작성**

`tests/db/sky-data.test.ts`:
```ts
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
  return new Blob([gradientPng(8, 8, [127, 181, 221], [190, 214, 236])], { type: 'image/png' })
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
```

- [ ] **Step 6: 실패 확인**

Run: `npm run test:db -- sky-data`
Expected: FAIL — `@/lib/data/sky` 등 모듈 없음.

- [ ] **Step 7: 데이터 래퍼 구현**

`lib/data/client.ts`:
```ts
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'

export type DbClient = SupabaseClient<Database>
```

`lib/data/sky.ts`:
```ts
import type { DbClient } from './client'
import { AppError, toAppError } from './errors'

export const SKY_BUCKET = 'skies'
const SIGNED_URL_SECONDS = 60 * 60

export function skyImagePath(userId: string, localDate: string, ext: 'jpg' | 'png' = 'jpg'): string {
  return `${userId}/${localDate}/${crypto.randomUUID()}.${ext}`
}

export async function uploadSkyImage(db: DbClient, path: string, image: Blob): Promise<void> {
  const { error } = await db.storage.from(SKY_BUCKET).upload(path, image, { contentType: image.type || 'image/jpeg' })
  if (error) throw new AppError('upload_failed')
}

export type PlantSkyInput = { imagePath: string; color: string; note: string | null; gardenIds: string[] }

export async function plantSky(db: DbClient, input: PlantSkyInput): Promise<{ photoId: string; oldImagePath: string | null }> {
  const { data, error } = await db.rpc('plant_sky', {
    p_image_path: input.imagePath,
    p_color: input.color.toUpperCase(),
    p_note: input.note ?? '', // 서버가 빈 문자열을 null로 바꾼다
    p_garden_ids: input.gardenIds,
  })
  if (error) throw toAppError(error)
  const row = data[0]
  // 생성 타입은 old_image_path를 string으로 적지만 첫 심기에서는 null이다.
  return { photoId: row.photo_id, oldImagePath: (row.old_image_path as string | null) ?? null }
}

export async function setPlantings(db: DbClient, photoId: string, gardenIds: string[]): Promise<void> {
  const { error } = await db.rpc('set_plantings', { p_photo: photoId, p_garden_ids: gardenIds })
  if (error) throw toAppError(error)
}

export async function deleteSky(db: DbClient, photoId: string): Promise<string> {
  const { data, error } = await db.rpc('delete_sky', { p_photo: photoId })
  if (error) throw toAppError(error)
  return data
}

/** 더 이상 쓰이지 않는 사진 파일을 지운다. 실패해도 사용자 흐름은 막지 않는다(고아 파일 허용). */
export async function removeSkyImage(db: DbClient, path: string | null): Promise<void> {
  if (!path) return
  await db.storage.from(SKY_BUCKET).remove([path])
}

export async function signedSkyUrl(db: DbClient, path: string): Promise<string | null> {
  const { data } = await db.storage.from(SKY_BUCKET).createSignedUrl(path, SIGNED_URL_SECONDS)
  return data?.signedUrl ?? null
}

export type TodaySky = { id: string; imagePath: string; color: string; note: string | null; gardenIds: string[] }

export async function getTodaySky(db: DbClient, userId: string, localDate: string): Promise<TodaySky | null> {
  const { data, error } = await db
    .from('sky_photos')
    .select('id, image_path, dominant_color, note, plantings(garden_id)')
    .eq('user_id', userId)
    .eq('local_date', localDate)
    .maybeSingle()
  if (error) throw toAppError(error)
  if (!data) return null
  return {
    id: data.id,
    imagePath: data.image_path,
    color: data.dominant_color,
    note: data.note,
    gardenIds: data.plantings.map((p) => p.garden_id),
  }
}
```

`lib/data/gardens.ts`:
```ts
import type { DbClient } from './client'
import { toAppError } from './errors'

export type GardenOption = { id: string; name: string; kind: 'solo' | 'group'; memberCount: number }

export async function listMyGardens(db: DbClient): Promise<GardenOption[]> {
  const { data, error } = await db.from('gardens').select('id, name, kind, garden_members(count)').order('created_at')
  if (error) throw toAppError(error)
  return data.map((g) => ({
    id: g.id,
    name: g.name,
    kind: g.kind as GardenOption['kind'],
    memberCount: g.garden_members[0]?.count ?? 0,
  }))
}
```

`lib/data/alerts.ts`:
```ts
import type { DbClient } from './client'
import { toAppError } from './errors'

export async function getTodayAlert(db: DbClient, localDate: string): Promise<Date | null> {
  const { data, error } = await db.from('daily_alerts').select('alert_at').eq('local_date', localDate).maybeSingle()
  if (error) throw toAppError(error)
  return data ? new Date(data.alert_at) : null
}
```

- [ ] **Step 8: 통과 확인**

```bash
npm test
npm run test:db -- sky-data
npm run typecheck
```
Expected: 단위 전부 통과, `sky-data.test.ts` 5 passed, 타입 에러 없음. (테스트의 `me.client`는 타입 없는 클라이언트라 `DbClient` 자리에 그대로 들어간다. 타입 에러가 나면 테스트 쪽에서만 `as unknown as DbClient`로 맞추고 보고한다.)

- [ ] **Step 9: Commit**

```bash
git add lib/data lib/domain/alert-chip.ts tests/unit/errors.test.ts tests/unit/alert-chip.test.ts tests/db/sky-data.test.ts
git commit -m "feat(data): 하늘·정원·알림 데이터 래퍼, 에러 문구, 남은 시간 칩"
```

---

### Task 4: 하늘 담기 화면 — 새로 심기 + E2E

**Files:**
- Create: `lib/image/compress.ts`, `lib/hooks/use-online.ts`
- Create: `components/sky/SkyCapture.tsx`, `components/sky/CaptureInputs.tsx`, `components/sky/SkyColorChip.tsx`, `components/sky/GardenChecklist.tsx`, `components/sky/AlertChip.tsx`
- Create: `app/(app)/sky/page.tsx`
- Modify: `app/(app)/garden/page.tsx` ("하늘 담기" 링크)
- Create: `playwright.config.ts`, `tests/e2e/helpers.ts`, `tests/e2e/sky.spec.ts`
- Modify: `package.json` (`@playwright/test`, 스크립트 `test:e2e`)

**Interfaces:**
- Consumes: Task 2 `dominantColor`, `colorName`, `fitWithin`; Task 3 `AppError`, `userMessageOf`, `skyImagePath`, `uploadSkyImage`, `plantSky`, `removeSkyImage`, `listMyGardens`, `getTodayAlert`, `GardenOption`, `alertChip`; `seoulDate`; `createClient`(브라우저/서버); `gradientPng`; `SEED_USERS`
- Produces:
  - `prepareSkyImage(file: File): Promise<{ blob: Blob; colorPixels: Uint8ClampedArray }>`
  - `useOnline(): boolean`
  - `<SkyCapture userId gardens alertAt />` (Task 5에서 `todaySky`, `todayImageUrl` props 추가)
  - `<CaptureInputs onFile busy />`, `<RetakeInput onFile label />`, `<SkyColorChip color />`, `<GardenChecklist gardens selected onChange />`, `<AlertChip alertAt />`
  - E2E 헬퍼 `admin`, `userId(email)`, `clearTodaySky(uid)`, `devLoginAs(page, nickname)`, `skyFile(top: Rgb)`, `todaySkyRow(uid)`, `objectExists(path)`

- [ ] **Step 1: Playwright 설치와 설정**

```bash
npm install -D @playwright/test
```
(브라우저는 내려받지 않는다 — 설치된 Chrome을 `channel: 'chrome'`으로 쓴다.)

`package.json` `scripts`에 추가:
```json
    "test:e2e": "playwright test"
```

`playwright.config.ts`:
```ts
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  workers: 1,
  use: {
    baseURL: 'http://localhost:3000',
    channel: 'chrome',
    viewport: { width: 390, height: 844 },
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000/login',
    reuseExistingServer: true,
    timeout: 120_000,
  },
})
```

`.gitignore`에는 이미 `test-results/`, `playwright-report/`가 있다(확인만).

- [ ] **Step 2: E2E 헬퍼와 실패하는 E2E 테스트 작성**

`tests/e2e/helpers.ts`:
```ts
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import type { Page } from '@playwright/test'
import { seoulDate } from '../../lib/domain/date'
import type { Rgb } from '../../lib/image/color'
import { gradientPng } from '../../scripts/lib/png'

config({ path: '.env.local' })

export const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
})

export async function userId(email: string): Promise<string> {
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 })
  if (error) throw error
  const user = data.users.find((u) => u.email === email)
  if (!user) throw new Error(`시드 계정이 없습니다(${email}). 먼저 npm run seed`)
  return user.id
}

/** 시드 계정의 오늘 하늘을 지워 테스트를 반복 가능하게 한다. */
export async function clearTodaySky(uid: string) {
  const { data, error } = await admin
    .from('sky_photos')
    .select('id, image_path')
    .eq('user_id', uid)
    .eq('local_date', seoulDate())
  if (error) throw error
  for (const photo of data) {
    await admin.from('sky_photos').delete().eq('id', photo.id)
    if (photo.image_path.startsWith(`${uid}/`)) await admin.storage.from('skies').remove([photo.image_path])
  }
}

export async function todaySkyRow(uid: string) {
  const { data, error } = await admin
    .from('sky_photos')
    .select('image_path, note, dominant_color, plantings(garden_id)')
    .eq('user_id', uid)
    .eq('local_date', seoulDate())
    .maybeSingle()
  if (error) throw error
  return data
}

export async function objectExists(path: string): Promise<boolean> {
  const dir = path.slice(0, path.lastIndexOf('/'))
  const name = path.slice(path.lastIndexOf('/') + 1)
  const { data, error } = await admin.storage.from('skies').list(dir, { search: name })
  if (error) throw error
  return data.some((o) => o.name === name)
}

export async function devLoginAs(page: Page, nickname: string) {
  await page.goto('/login')
  await page.getByRole('button', { name: nickname, exact: true }).click()
  await page.waitForURL('**/garden')
}

export function skyFile(top: Rgb) {
  return { name: 'sky.png', mimeType: 'image/png', buffer: gradientPng(360, 480, top, [236, 240, 244]) }
}
```

`tests/e2e/sky.spec.ts`:
```ts
import { expect, test } from '@playwright/test'
import { clearTodaySky, devLoginAs, skyFile, todaySkyRow, userId } from './helpers'

const ME = 'me@garden-farmer.test'

test.beforeEach(async () => {
  await clearTodaySky(await userId(ME))
})

test('하늘을 찍어 모든 정원에 심는다', async ({ page }) => {
  await devLoginAs(page, '나')
  await page.getByRole('link', { name: '하늘 담기' }).click()
  await expect(page.getByRole('heading', { name: '지금, 하늘' })).toBeVisible()
  await expect(page.getByText('오늘 안에 언제든')).toBeVisible()
  await expect(page.getByRole('button', { name: '하늘 심기' })).toBeDisabled()

  await page.getByLabel('하늘 찍기').setInputFiles(skyFile([127, 181, 221]))
  await expect(page.getByText(/오늘의 하늘빛 · /)).toBeVisible()
  await expect(page.getByRole('img', { name: '방금 찍은 하늘' })).toBeVisible()
  await expect(page.getByRole('checkbox')).toHaveCount(3)
  for (const box of await page.getByRole('checkbox').all()) await expect(box).toBeChecked()

  await page.getByLabel('한 줄 남기기 (선택)').fill('테스트 하늘')
  await page.getByRole('button', { name: '하늘 심기' }).click()
  await page.waitForURL('**/garden')

  const row = await todaySkyRow(await userId(ME))
  expect(row?.note).toBe('테스트 하늘')
  expect(row?.dominant_color).toMatch(/^#[0-9A-F]{6}$/)
  expect(row?.image_path).toMatch(/\.jpg$/)
  expect(row?.plantings).toHaveLength(3)
})
```

- [ ] **Step 3: 실패 확인**

먼저 시드가 있는지 확인한다: `npm run seed` (이미 있으면 `하늘 기록 0장 …` 출력).
Run: `npm run test:e2e`
Expected: FAIL — `/garden`에 "하늘 담기" 링크가 없음(`getByRole('link', { name: '하늘 담기' })` 타임아웃).

- [ ] **Step 4: 브라우저 이미지 처리와 온라인 훅 작성**

`lib/image/compress.ts`:
```ts
import { AppError } from '@/lib/data/errors'
import { fitWithin } from './size'

const MAX_SIDE = 1600
const COLOR_SAMPLE_SIDE = 64
const JPEG_QUALITY = 0.8

export type PreparedSky = { blob: Blob; colorPixels: Uint8ClampedArray }

/** (브라우저 전용) 사진 파일을 업로드용 JPEG와 대표색 표본 픽셀로 만든다. */
export async function prepareSkyImage(file: File): Promise<PreparedSky> {
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    throw new AppError('image_unreadable')
  }
  try {
    const full = fitWithin(bitmap.width, bitmap.height, MAX_SIDE)
    const blob = await toJpeg(draw(bitmap, full.width, full.height))
    const sample = fitWithin(bitmap.width, bitmap.height, COLOR_SAMPLE_SIDE)
    const ctx = draw(bitmap, sample.width, sample.height)
    return { blob, colorPixels: ctx.getImageData(0, 0, sample.width, sample.height).data }
  } finally {
    bitmap.close()
  }
}

function draw(bitmap: ImageBitmap, width: number, height: number): CanvasRenderingContext2D {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new AppError('image_unreadable')
  ctx.drawImage(bitmap, 0, 0, width, height)
  return ctx
}

function toJpeg(ctx: CanvasRenderingContext2D): Promise<Blob> {
  return new Promise((resolve, reject) => {
    ctx.canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new AppError('image_unreadable'))),
      'image/jpeg',
      JPEG_QUALITY,
    )
  })
}
```

`lib/hooks/use-online.ts`:
```ts
'use client'

import { useSyncExternalStore } from 'react'

function subscribe(onChange: () => void) {
  window.addEventListener('online', onChange)
  window.addEventListener('offline', onChange)
  return () => {
    window.removeEventListener('online', onChange)
    window.removeEventListener('offline', onChange)
  }
}

export function useOnline(): boolean {
  return useSyncExternalStore(subscribe, () => navigator.onLine, () => true)
}
```

- [ ] **Step 5: 화면 조각 컴포넌트 작성**

`components/sky/AlertChip.tsx`:
```tsx
'use client'

import { useEffect, useState } from 'react'
import { alertChip } from '@/lib/domain/alert-chip'

export function AlertChip({ alertAt }: { alertAt: string | null }) {
  // 서버·클라이언트 시각 차이로 인한 hydration 불일치를 피하려고 마운트 후에 그린다.
  const [now, setNow] = useState<Date | null>(null)

  useEffect(() => {
    setNow(new Date())
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  if (!now) return <div className="h-[30px] w-24" aria-hidden />
  const { label, counting } = alertChip(now, alertAt ? new Date(alertAt) : null)
  return (
    <div
      className={`rounded-[14px] px-3 py-1.5 text-[13px] ${counting ? 'bg-[#F2DCD2] text-[#7A3E2C]' : 'bg-card text-muted'}`}
    >
      {label}
    </div>
  )
}
```

`components/sky/CaptureInputs.tsx`:
```tsx
'use client'

import type { ChangeEvent } from 'react'

type OnFile = (file: File) => void

function pick(onFile: OnFile) {
  return (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = '' // 같은 파일을 다시 골라도 change가 나도록
    if (file) onFile(file)
  }
}

/** 사진이 없을 때 사진 영역 가운데: 카메라 촬영 + 앨범 선택(카메라를 못 쓸 때). */
export function CaptureInputs({ onFile, busy }: { onFile: OnFile; busy: boolean }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3">
      <label className="flex h-[54px] min-w-44 cursor-pointer items-center justify-center rounded-full bg-sky-deep px-6 text-[17px] text-white shadow-[0_6px_18px_rgba(79,114,153,.3)]">
        {busy ? '하늘을 읽는 중…' : '하늘 찍기'}
        <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={pick(onFile)} disabled={busy} />
      </label>
      <label className="flex min-h-11 cursor-pointer items-center px-3 text-sm text-ink underline">
        앨범에서 고르기
        <input type="file" accept="image/*" className="sr-only" onChange={pick(onFile)} disabled={busy} />
      </label>
    </div>
  )
}

/** 사진 위 오른쪽 아래 "다시 찍기". */
export function RetakeInput({ onFile, label = '다시 찍기' }: { onFile: OnFile; label?: string }) {
  return (
    <label className="absolute bottom-3.5 right-4 flex min-h-11 cursor-pointer items-center rounded-xl bg-[rgb(255_253_248/0.78)] px-3 text-[13px] text-ink">
      {label}
      <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={pick(onFile)} />
    </label>
  )
}
```

`components/sky/SkyColorChip.tsx`:
```tsx
import { colorName } from '@/lib/image/color-name'

export function SkyColorChip({ color }: { color: string }) {
  return (
    <div className="flex items-center gap-3.5 rounded-[18px] border border-line bg-card px-3.5 py-3">
      <div
        aria-hidden
        className="h-10 w-10 shrink-0 rounded-full shadow-[inset_0_-6px_10px_rgba(255,255,255,.45)]"
        style={{ background: color }}
      />
      <div className="flex flex-col gap-0.5">
        <p className="text-[15px]">오늘의 하늘빛 · {colorName(color)}</p>
        <p className="text-[13px] text-muted">이 색으로 꽃잎이 칠해져요</p>
      </div>
    </div>
  )
}
```

`components/sky/GardenChecklist.tsx`:
```tsx
'use client'

import type { GardenOption } from '@/lib/data/gardens'

const SHOW_COUNT_FROM = 3

export function GardenChecklist({
  gardens,
  selected,
  onChange,
}: {
  gardens: GardenOption[]
  selected: string[]
  onChange: (ids: string[]) => void
}) {
  function toggle(id: string, checked: boolean) {
    onChange(checked ? [...selected, id] : selected.filter((x) => x !== id))
  }

  return (
    <fieldset className="m-0 flex flex-col gap-1.5 border-0 p-0">
      <legend className="pb-2 text-sm text-muted">어느 정원에 심을까요?</legend>
      {gardens.map((g) => (
        <label
          key={g.id}
          className="flex min-h-11 items-center justify-between rounded-[14px] bg-[rgb(255_253_248/0.6)] px-3.5 text-[15px]"
        >
          {g.memberCount >= SHOW_COUNT_FROM ? `${g.name} · ${g.memberCount}명` : g.name}
          <input
            type="checkbox"
            className="h-5 w-5 accent-sky-deep"
            checked={selected.includes(g.id)}
            onChange={(e) => toggle(g.id, e.target.checked)}
          />
        </label>
      ))}
    </fieldset>
  )
}
```

- [ ] **Step 6: `SkyCapture`와 페이지 작성**

`components/sky/SkyCapture.tsx`:
```tsx
'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { userMessageOf } from '@/lib/data/errors'
import type { GardenOption } from '@/lib/data/gardens'
import { plantSky, removeSkyImage, skyImagePath, uploadSkyImage } from '@/lib/data/sky'
import { seoulDate } from '@/lib/domain/date'
import { useOnline } from '@/lib/hooks/use-online'
import { prepareSkyImage } from '@/lib/image/compress'
import { dominantColor } from '@/lib/image/dominant-color'
import { createClient } from '@/lib/supabase/client'
import { AlertChip } from './AlertChip'
import { CaptureInputs, RetakeInput } from './CaptureInputs'
import { GardenChecklist } from './GardenChecklist'
import { SkyColorChip } from './SkyColorChip'

type Props = { userId: string; gardens: GardenOption[]; alertAt: string | null }

type Captured = { blob: Blob; previewUrl: string; color: string; uploadedPath: string | null }

export function SkyCapture({ userId, gardens, alertAt }: Props) {
  const router = useRouter()
  const online = useOnline()
  const [captured, setCaptured] = useState<Captured | null>(null)
  const [selected, setSelected] = useState<string[]>(() => gardens.map((g) => g.id))
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState<'reading' | 'planting' | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    return () => {
      if (captured) URL.revokeObjectURL(captured.previewUrl)
    }
  }, [captured])

  async function onFile(file: File) {
    setError(null)
    setBusy('reading')
    try {
      const { blob, colorPixels } = await prepareSkyImage(file)
      setCaptured({ blob, previewUrl: URL.createObjectURL(blob), color: dominantColor(colorPixels), uploadedPath: null })
    } catch (e) {
      setError(userMessageOf(e))
    } finally {
      setBusy(null)
    }
  }

  async function plant() {
    if (!captured) return
    setError(null)
    setBusy('planting')
    const db = createClient()
    try {
      // 업로드는 됐는데 심기에 실패한 경우, 다시 시도할 때 같은 파일을 재사용한다.
      let path = captured.uploadedPath
      if (!path) {
        path = skyImagePath(userId, seoulDate())
        await uploadSkyImage(db, path, captured.blob)
        setCaptured({ ...captured, uploadedPath: path })
      }
      const { oldImagePath } = await plantSky(db, {
        imagePath: path,
        color: captured.color,
        note: note.trim() || null,
        gardenIds: selected,
      })
      await removeSkyImage(db, oldImagePath)
      router.push('/garden')
      router.refresh()
    } catch (e) {
      setError(userMessageOf(e))
      setBusy(null)
    }
  }

  const canPlant = captured !== null && busy === null && online && selected.length > 0

  return (
    <main className="flex min-h-dvh flex-col gap-[18px] px-5 pb-7 pt-13">
      <header className="flex items-center justify-between">
        <Link href="/garden" className="flex min-h-11 items-center gap-1 text-[15px] text-ink">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M15 5l-7 7 7 7" />
          </svg>
          정원
        </Link>
        <h1 className="font-serif text-lg font-bold">지금, 하늘</h1>
        <AlertChip alertAt={alertAt} />
      </header>

      <section aria-label="하늘 사진" className="relative h-[330px] shrink-0 overflow-hidden rounded-[28px] bg-[#C7DDEF]">
        {captured ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element -- blob URL 미리보기 */}
            <img src={captured.previewUrl} alt="방금 찍은 하늘" className="h-full w-full object-cover" />
            <RetakeInput onFile={onFile} />
          </>
        ) : (
          <CaptureInputs onFile={onFile} busy={busy === 'reading'} />
        )}
      </section>

      {captured && (
        <>
          <SkyColorChip color={captured.color} />
          <GardenChecklist gardens={gardens} selected={selected} onChange={setSelected} />
          <label className="flex flex-col gap-1.5 text-sm text-muted">
            한 줄 남기기 (선택)
            <input
              type="text"
              maxLength={60}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="점심 먹고 올려다본 하늘"
              className="h-[46px] rounded-[14px] border border-[#DCD2C1] bg-[#FFFDF8] px-3.5 text-[15px] text-ink"
            />
          </label>
        </>
      )}

      {error && (
        <p role="alert" className="text-sm text-[#7A3E2C]">
          {error}
        </p>
      )}
      {!online && (
        <p role="status" className="text-sm text-muted">
          오프라인이에요. 연결되면 하늘을 심을 수 있어요.
        </p>
      )}

      <button
        type="button"
        onClick={plant}
        disabled={!canPlant}
        className="mt-auto h-[54px] shrink-0 rounded-full bg-sky-deep text-[17px] text-white shadow-[0_6px_18px_rgba(79,114,153,.3)] disabled:opacity-50"
      >
        {busy === 'planting' ? '심는 중…' : '하늘 심기'}
      </button>
    </main>
  )
}
```

`app/(app)/sky/page.tsx`:
```tsx
import { redirect } from 'next/navigation'
import { SkyCapture } from '@/components/sky/SkyCapture'
import { getTodayAlert } from '@/lib/data/alerts'
import { listMyGardens } from '@/lib/data/gardens'
import { seoulDate } from '@/lib/domain/date'
import { createClient } from '@/lib/supabase/server'

export default async function SkyPage() {
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getClaims()
  const uid = auth?.claims.sub
  if (!uid) redirect('/login')

  const today = seoulDate()
  const [gardens, alertAt] = await Promise.all([listMyGardens(supabase), getTodayAlert(supabase, today)])

  return <SkyCapture userId={uid} gardens={gardens} alertAt={alertAt?.toISOString() ?? null} />
}
```

`app/(app)/garden/page.tsx` — import에 `Link` 추가하고 `<h1>` 바로 다음에 링크 추가:
```tsx
import Link from 'next/link'
```
```tsx
      <Link
        href="/sky"
        className="flex h-[54px] items-center justify-center rounded-full bg-sky-deep text-[17px] text-white shadow-[0_6px_18px_rgba(79,114,153,.3)]"
      >
        하늘 담기
      </Link>
```

- [ ] **Step 7: 통과 확인**

```bash
npm run typecheck
npm test
npm run test:e2e
```
Expected: 타입 에러 없음, 단위 통과, E2E `하늘을 찍어 모든 정원에 심는다` 1 passed. 3000 포트에 이미 서버가 떠 있으면 재사용하고, 아니면 Playwright가 `npm run dev`를 띄웠다 내린다.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json playwright.config.ts lib/image/compress.ts lib/hooks components/sky "app/(app)/sky" "app/(app)/garden/page.tsx" tests/e2e
git commit -m "feat(sky): 하늘 담기 화면 — 촬영·압축·대표색·정원 선택·심기, Playwright E2E"
```

---

### Task 5: 오늘 심은 하늘 관리 — 정원 바꾸기·다시 찍기·지우기

**Files:**
- Modify: `components/sky/SkyCapture.tsx`
- Modify: `app/(app)/sky/page.tsx`
- Modify: `tests/e2e/sky.spec.ts` (테스트 1개 추가)

**Interfaces:**
- Consumes: Task 3 `getTodaySky`, `signedSkyUrl`, `setPlantings`, `deleteSky`, `removeSkyImage`, `TodaySky`; Task 4 컴포넌트·헬퍼
- Produces: `<SkyCapture userId gardens alertAt todaySky todayImageUrl />` — `todaySky: TodaySky | null`, `todayImageUrl: string | null`

- [ ] **Step 1: 실패하는 E2E 테스트 추가**

`tests/e2e/sky.spec.ts` import를 다음으로 교체:
```ts
import { expect, test } from '@playwright/test'
import { clearTodaySky, devLoginAs, objectExists, skyFile, todaySkyRow, userId } from './helpers'
```
파일 끝에 추가:
```ts
test('오늘 심은 하늘의 정원을 바꾸고, 다시 찍고, 지운다', async ({ page }) => {
  const uid = await userId(ME)
  await devLoginAs(page, '나')
  await page.goto('/sky')
  await page.getByLabel('하늘 찍기').setInputFiles(skyFile([127, 181, 221]))
  await page.getByRole('button', { name: '하늘 심기' }).click()
  await page.waitForURL('**/garden')

  // 오늘 하늘이 있으면 사진·정원 체크 상태를 보여준다
  await page.goto('/sky')
  await expect(page.getByRole('img', { name: '오늘 심은 하늘' })).toBeVisible()
  await expect(page.getByRole('button', { name: '정원 바꾸기 저장' })).toBeDisabled()
  await page.getByRole('checkbox', { name: '우리 둘' }).uncheck()
  await page.getByRole('button', { name: '정원 바꾸기 저장' }).click()
  await expect.poll(async () => (await todaySkyRow(uid))?.plantings.length).toBe(2)

  // 다시 찍으면 현재 정원(2곳)을 유지한 채 사진만 바뀌고 옛 파일은 지워진다
  const before = (await todaySkyRow(uid))!.image_path
  await page.getByLabel('다시 찍기').setInputFiles(skyFile([242, 184, 162]))
  await expect(page.getByRole('img', { name: '방금 찍은 하늘' })).toBeVisible()
  await page.getByRole('button', { name: '하늘 심기' }).click()
  await page.waitForURL('**/garden')
  const after = await todaySkyRow(uid)
  expect(after!.image_path).not.toBe(before)
  expect(after!.plantings).toHaveLength(2)
  await expect.poll(() => objectExists(before)).toBe(false)

  // 지우면 처음 상태로 돌아간다
  await page.goto('/sky')
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: '하늘 지우기' }).click()
  await expect(page.getByLabel('하늘 찍기')).toBeAttached()
  await expect.poll(() => todaySkyRow(uid)).toBeNull()
  await expect.poll(() => objectExists(after!.image_path)).toBe(false)
})
```

- [ ] **Step 2: 실패 확인**

Run: `npm run test:e2e`
Expected: 새 테스트 FAIL — `오늘 심은 하늘` 이미지 없음. 첫 테스트는 계속 통과.

- [ ] **Step 3: 페이지에서 오늘 하늘 로드**

`app/(app)/sky/page.tsx` 전체 교체:
```tsx
import { redirect } from 'next/navigation'
import { SkyCapture } from '@/components/sky/SkyCapture'
import { getTodayAlert } from '@/lib/data/alerts'
import { listMyGardens } from '@/lib/data/gardens'
import { getTodaySky, signedSkyUrl } from '@/lib/data/sky'
import { seoulDate } from '@/lib/domain/date'
import { createClient } from '@/lib/supabase/server'

export default async function SkyPage() {
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getClaims()
  const uid = auth?.claims.sub
  if (!uid) redirect('/login')

  const today = seoulDate()
  const [gardens, alertAt, todaySky] = await Promise.all([
    listMyGardens(supabase),
    getTodayAlert(supabase, today),
    getTodaySky(supabase, uid, today),
  ])
  const todayImageUrl = todaySky ? await signedSkyUrl(supabase, todaySky.imagePath) : null

  // 오늘 하늘이 생기거나 지워지면 상태를 새로 시작하도록 key를 바꾼다.
  return (
    <SkyCapture
      key={todaySky?.id ?? 'new'}
      userId={uid}
      gardens={gardens}
      alertAt={alertAt?.toISOString() ?? null}
      todaySky={todaySky}
      todayImageUrl={todayImageUrl}
    />
  )
}
```

- [ ] **Step 4: `SkyCapture`에 오늘 하늘 모드 추가**

`components/sky/SkyCapture.tsx` 전체 교체:
```tsx
'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { userMessageOf } from '@/lib/data/errors'
import type { GardenOption } from '@/lib/data/gardens'
import {
  deleteSky,
  plantSky,
  removeSkyImage,
  setPlantings,
  skyImagePath,
  uploadSkyImage,
  type TodaySky,
} from '@/lib/data/sky'
import { seoulDate } from '@/lib/domain/date'
import { useOnline } from '@/lib/hooks/use-online'
import { prepareSkyImage } from '@/lib/image/compress'
import { dominantColor } from '@/lib/image/dominant-color'
import { createClient } from '@/lib/supabase/client'
import { AlertChip } from './AlertChip'
import { CaptureInputs, RetakeInput } from './CaptureInputs'
import { GardenChecklist } from './GardenChecklist'
import { SkyColorChip } from './SkyColorChip'

type Props = {
  userId: string
  gardens: GardenOption[]
  alertAt: string | null
  todaySky: TodaySky | null
  todayImageUrl: string | null
}

type Captured = { blob: Blob; previewUrl: string; color: string; uploadedPath: string | null }
type Busy = 'reading' | 'planting' | 'saving' | 'deleting' | null

function sameSet(a: string[], b: string[]) {
  return a.length === b.length && a.every((x) => b.includes(x))
}

export function SkyCapture({ userId, gardens, alertAt, todaySky, todayImageUrl }: Props) {
  const router = useRouter()
  const online = useOnline()
  const [captured, setCaptured] = useState<Captured | null>(null)
  const [selected, setSelected] = useState<string[]>(() => todaySky?.gardenIds ?? gardens.map((g) => g.id))
  const [note, setNote] = useState(todaySky?.note ?? '')
  const [busy, setBusy] = useState<Busy>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    return () => {
      if (captured) URL.revokeObjectURL(captured.previewUrl)
    }
  }, [captured])

  async function run(kind: Exclude<Busy, null>, task: () => Promise<void>) {
    setError(null)
    setBusy(kind)
    try {
      await task()
    } catch (e) {
      setError(userMessageOf(e))
      setBusy(null)
    }
  }

  function onFile(file: File) {
    void run('reading', async () => {
      const { blob, colorPixels } = await prepareSkyImage(file)
      setCaptured({ blob, previewUrl: URL.createObjectURL(blob), color: dominantColor(colorPixels), uploadedPath: null })
      setBusy(null)
    })
  }

  function plant() {
    if (!captured) return
    void run('planting', async () => {
      const db = createClient()
      // 업로드는 됐는데 심기에 실패한 경우, 다시 시도할 때 같은 파일을 재사용한다.
      let path = captured.uploadedPath
      if (!path) {
        path = skyImagePath(userId, seoulDate())
        await uploadSkyImage(db, path, captured.blob)
        setCaptured({ ...captured, uploadedPath: path })
      }
      const { oldImagePath } = await plantSky(db, {
        imagePath: path,
        color: captured.color,
        note: note.trim() || null,
        gardenIds: selected,
      })
      await removeSkyImage(db, oldImagePath)
      router.push('/garden')
      router.refresh()
    })
  }

  function saveGardens() {
    if (!todaySky) return
    void run('saving', async () => {
      await setPlantings(createClient(), todaySky.id, selected)
      router.refresh()
      setBusy(null)
    })
  }

  function removeToday() {
    if (!todaySky || !window.confirm('오늘 하늘을 지울까요? 모든 정원에서 내 꽃잎이 비어요.')) return
    void run('deleting', async () => {
      const db = createClient()
      const path = await deleteSky(db, todaySky.id)
      await removeSkyImage(db, path)
      router.refresh()
    })
  }

  const viewingToday = todaySky !== null && captured === null
  const shownColor = captured?.color ?? todaySky?.color ?? null
  const canPlant = captured !== null && busy === null && online && selected.length > 0
  const canSave =
    viewingToday && busy === null && online && selected.length > 0 && !sameSet(selected, todaySky.gardenIds)

  return (
    <main className="flex min-h-dvh flex-col gap-[18px] px-5 pb-7 pt-13">
      <header className="flex items-center justify-between">
        <Link href="/garden" className="flex min-h-11 items-center gap-1 text-[15px] text-ink">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M15 5l-7 7 7 7" />
          </svg>
          정원
        </Link>
        <h1 className="font-serif text-lg font-bold">지금, 하늘</h1>
        <AlertChip alertAt={alertAt} />
      </header>

      <section aria-label="하늘 사진" className="relative h-[330px] shrink-0 overflow-hidden rounded-[28px] bg-[#C7DDEF]">
        {captured ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element -- blob URL 미리보기 */}
            <img src={captured.previewUrl} alt="방금 찍은 하늘" className="h-full w-full object-cover" />
            <RetakeInput onFile={onFile} />
          </>
        ) : viewingToday ? (
          <>
            {todayImageUrl && (
              // eslint-disable-next-line @next/next/no-img-element -- 1시간짜리 signed URL
              <img src={todayImageUrl} alt="오늘 심은 하늘" className="h-full w-full object-cover" />
            )}
            <RetakeInput onFile={onFile} />
          </>
        ) : (
          <CaptureInputs onFile={onFile} busy={busy === 'reading'} />
        )}
      </section>

      {shownColor && <SkyColorChip color={shownColor} />}

      {(captured || viewingToday) && (
        <>
          <GardenChecklist gardens={gardens} selected={selected} onChange={setSelected} />
          {captured ? (
            <label className="flex flex-col gap-1.5 text-sm text-muted">
              한 줄 남기기 (선택)
              <input
                type="text"
                maxLength={60}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="점심 먹고 올려다본 하늘"
                className="h-[46px] rounded-[14px] border border-[#DCD2C1] bg-[#FFFDF8] px-3.5 text-[15px] text-ink"
              />
            </label>
          ) : (
            todaySky?.note && <p className="text-[15px] text-ink">“{todaySky.note}”</p>
          )}
        </>
      )}

      {error && (
        <p role="alert" className="text-sm text-[#7A3E2C]">
          {error}
        </p>
      )}
      {!online && (
        <p role="status" className="text-sm text-muted">
          오프라인이에요. 연결되면 하늘을 심을 수 있어요.
        </p>
      )}

      {viewingToday ? (
        <div className="mt-auto flex flex-col gap-2">
          <button
            type="button"
            onClick={saveGardens}
            disabled={!canSave}
            className="h-[54px] rounded-full bg-sky-deep text-[17px] text-white shadow-[0_6px_18px_rgba(79,114,153,.3)] disabled:opacity-50"
          >
            {busy === 'saving' ? '저장 중…' : '정원 바꾸기 저장'}
          </button>
          <button
            type="button"
            onClick={removeToday}
            disabled={busy !== null || !online}
            className="h-11 text-sm text-muted underline disabled:opacity-50"
          >
            {busy === 'deleting' ? '지우는 중…' : '하늘 지우기'}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={plant}
          disabled={!canPlant}
          className="mt-auto h-[54px] shrink-0 rounded-full bg-sky-deep text-[17px] text-white shadow-[0_6px_18px_rgba(79,114,153,.3)] disabled:opacity-50"
        >
          {busy === 'planting' ? '심는 중…' : '하늘 심기'}
        </button>
      )}
    </main>
  )
}
```

- [ ] **Step 5: 통과 확인**

```bash
npm run typecheck
npm test
npm run test:e2e
```
Expected: 타입 에러 없음, 단위 통과, E2E 2 passed.

- [ ] **Step 6: Commit**

```bash
git add components/sky/SkyCapture.tsx "app/(app)/sky/page.tsx" tests/e2e/sky.spec.ts
git commit -m "feat(sky): 오늘 심은 하늘의 정원 바꾸기·다시 찍기·지우기"
```

---

## 완료 기준 (계획 2)

- `npm test`, `npm run test:db`, `npm run test:e2e`, `npm run typecheck`, `npm run build` 모두 통과
- 개발 로그인 "나"로 `/garden` → "하늘 담기" → 촬영(파일 선택) → 대표색·이름 표시 → 정원 선택·메모 → 심기 → `/garden` 복귀
- 오늘 하늘이 있으면 사진·정원 체크 상태 표시, 정원 바꾸기·다시 찍기(옛 파일 삭제)·지우기 동작
- 설계 3단계 완료 기준 중 "🔶 iPhone 카메라"는 계획 5(실로그인·배포)에서 실기기로 확인한다
