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
