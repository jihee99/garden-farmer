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
