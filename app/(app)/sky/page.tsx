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
