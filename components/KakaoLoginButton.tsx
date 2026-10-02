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
