# 계획 1 후속 과제 (다음 계획에 반영)

계획 1(기반) 최종 리뷰에서 나온 항목 중 이후 계획으로 미룬 것. 각 계획을 작성할 때 해당 절을 태스크로 옮긴다.

## 결정 대기 (사람)
- **초대 코드 무차별 대입**: 32^6 코드, 시도 제한 없음, `random()` 사용. 권장안 — 6자리 유지 + 사용자별 실패 시도 제한(예: 1시간 10회, 초과 시 `too_many_attempts`) + `extensions.gen_random_bytes`로 코드 생성. 주의: 실패를 기록한 뒤 `raise`하면 기록이 롤백되므로, `join_garden`은 실패 시 예외 대신 상태 값을 반환해야 한다. 계획 4에서 구현, 계획 5(배포) 전 필수.

## 계획 2 (하늘 담기)
- `plant_sky` 경로 검증 강화: `^<uid>/<today>/[0-9a-f-]{36}\.(jpg|png)$`
- `plant_sky` 메모 60자 초과 시 원시 23514 대신 `invalid_note`
- `set_plantings`에서 사진 행 잠금(`for update`)
- 클라이언트에서 `dominant_color` 대문자화(DB 체크는 대문자만 허용)
- RPC 타입 래퍼: 생성 타입의 nullability 오류(`old_image_path`는 null 가능, `p_note` null 허용)를 감싼다
- sky 테스트 정리: setup 에러 확인, `today`를 테스트마다 계산, 순서 의존 줄이기, 누락 케이스(anon 거부, `unplant` not_owner, 교체된 옛 파일 비가시, `get_month` 전 멤버 제외)

## 계획 3 (정원 홈)
- `avatar_url` 렌더 전 스킴 검증(https만) 또는 컬럼 수정 권한 회수. 가입 트리거에서 http→https 정규화

## 계획 4 (그룹)
- 위 "초대 코드" 결정 반영
- 동시 `create_garden` 코드 중복 시 23505 대신 재시도
- 정원 이름 `trim`이 U+3000·탭을 못 거름
- 정원 테스트 보강: reorder에 비멤버 id, anon 거부, setup 에러 확인

## 계획 5 (실로그인·배포)
- 개발 로그인에 `VERCEL_ENV !== 'production'` 가드 추가, 시드에 dev 프로젝트 ref 허용 목록
- 카카오 이메일 동의 항목/비즈 앱 여부 또는 Supabase "이메일 없는 사용자 허용" 설정 확인
- JWT 서명 키가 비대칭(asymmetric)인지 확인(`getClaims` 네트워크 호출 방지)
- 서비스워커 활성화를 실제 Chrome/iPhone에서 확인(앱 내장 브라우저에서는 등록 불가)
- `KakaoLoginButton` bfcache 복귀 시 pending 해제(`pageshow`)
- CI에서 `npm ci` 사용

## 계획 6 (알림)
- `push_subscriptions.endpoint` PK 충돌: 다른 계정이 같은 기기 구독 시 소유권을 넘기는 upsert RPC

## 계획 8 (다듬기)
- 로그아웃을 `{ scope: 'local' }`로(다른 기기 세션 유지)
- 공백만 있는 닉네임 막기(check에 trim)
- 정책의 `auth.uid()`를 `(select auth.uid())`로
- 계정 삭제 시 solo/빈 정원 정리
- maskable 아이콘 안전 영역(80%) 안으로
- 에러 색 `#7A3E2C`를 토큰으로
