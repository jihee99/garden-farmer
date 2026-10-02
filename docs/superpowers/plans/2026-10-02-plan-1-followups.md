# 계획 1 후속 과제 (다음 계획에 반영)

계획 1(기반) 최종 리뷰에서 나온 항목 중 이후 계획으로 미룬 것. 각 계획을 작성할 때 해당 절을 태스크로 옮긴다.

## 결정됨
- **초대 코드 무차별 대입 (2026-10-02 결정: 6자리 유지 + 시도 제한)**: 32^6 코드, 시도 제한 없음, `random()` 사용. 권장안 — 6자리 유지 + 사용자별 실패 시도 제한(예: 1시간 10회, 초과 시 `too_many_attempts`) + `extensions.gen_random_bytes`로 코드 생성. 주의: 실패를 기록한 뒤 `raise`하면 기록이 롤백되므로, `join_garden`은 실패 시 예외 대신 상태 값을 반환해야 한다. 계획 4에서 구현, 계획 5(배포) 전 필수.

## 계획 2 (하늘 담기) — 완료
- 경로 검증 강화, `invalid_note`, `set_plantings` 잠금, 색 대문자화, RPC 타입 래퍼, sky 테스트 beforeAll 에러 확인: 계획 2에서 처리
- 남은 sky 테스트 정리(테스트마다 `today` 계산, 순서 의존, anon 거부, `unplant` not_owner, 교체된 옛 파일 비가시, `get_month` 전 멤버 제외, `.jpg`·60자 경계) → 계획 3·4로 이월

## 계획 3 (정원 홈)
- signed URL 만료/실패 시 `onError`로 1회 재발급(설계 10장). 하늘 담기·하루 상세·정원 공용 헬퍼로
- `get_month` 전 멤버 제외 테스트
- `avatar_url` 렌더 전 스킴 검증(https만) 또는 컬럼 수정 권한 회수. 가입 트리거에서 http→https 정규화

## 계획 4 (그룹)
- 위 "초대 코드" 결정 반영
- 동시 `create_garden` 코드 중복 시 23505 대신 재시도
- 정원 이름 `trim`이 U+3000·탭을 못 거름
- 정원 테스트 보강: reorder에 비멤버 id, anon 거부, setup 에러 확인

## 계획 5 (실로그인·배포)
- iPhone에서 `createImageBitmap` EXIF 회전·큰 사진(48MP) 메모리 확인, 카메라/사진 보관함 선택 시트 확인
- `crypto.randomUUID`는 보안 컨텍스트 필요 — 휴대폰 LAN http 개발 대신 HTTPS 프리뷰로 확인
- 개발 로그인에 `VERCEL_ENV !== 'production'` 가드 추가, 시드에 dev 프로젝트 ref 허용 목록
- 카카오 이메일 동의 항목/비즈 앱 여부 또는 Supabase "이메일 없는 사용자 허용" 설정 확인
- JWT 서명 키가 비대칭(asymmetric)인지 확인(`getClaims` 네트워크 호출 방지)
- 서비스워커 활성화를 실제 Chrome/iPhone에서 확인(앱 내장 브라우저에서는 등록 불가)
- `KakaoLoginButton` bfcache 복귀 시 pending 해제(`pageshow`)
- CI에서 `npm ci` 사용

## 계획 6 (알림)
- E2E가 "오늘 안에 언제든"을 가정 — 알림 시각이 생기면 E2E에서 알림을 피하거나 고정
- `push_subscriptions.endpoint` PK 충돌: 다른 계정이 같은 기기 구독 시 소유권을 넘기는 upsert RPC

## 계획 8 (다듬기)
- 하늘 담기 UX: 정원 저장 후 성공 표시/새 props 전까지 버튼 비활성, 지우기 후 refresh 실패 시 멈춤, 다시 찍기 취소, 오늘 모드 오프라인 문구, 정원 0개 체크 시 안내, 파일 입력 label focus-within 링·촬영 후 포커스 이동, 바쁨 표시 일관성
- `colorName` 경계 다듬기(밝은 215~250°가 "깊은 파란빛", 어두운 모든 색상이 "밤 남색빛")
- 만료 세션(JWT expired)을 `not_authenticated` 문구로
- `set_plantings` 잠금을 `own_photo` 이전으로(사이 삭제 시 원시 FK 에러)
- 로그아웃을 `{ scope: 'local' }`로(다른 기기 세션 유지)
- 공백만 있는 닉네임 막기(check에 trim)
- 정책의 `auth.uid()`를 `(select auth.uid())`로
- 계정 삭제 시 solo/빈 정원 정리
- maskable 아이콘 안전 영역(80%) 안으로
- 에러 색 `#7A3E2C`를 토큰으로
