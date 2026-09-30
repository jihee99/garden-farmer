export default function Home() {
  return (
    <main className="flex min-h-dvh flex-col justify-center gap-2 px-5">
      <h1 className="font-serif text-3xl font-bold">하늘정원</h1>
      <p className="text-muted">하루 한 번, 지금 보이는 하늘을 심어요</p>
      <div className="mt-4 h-11 w-11 rounded-full bg-sky-deep" aria-label="토큰 확인용 원" />
    </main>
  )
}
