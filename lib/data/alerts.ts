import type { DbClient } from './client'
import { toAppError } from './errors'

export async function getTodayAlert(db: DbClient, localDate: string): Promise<Date | null> {
  const { data, error } = await db.from('daily_alerts').select('alert_at').eq('local_date', localDate).maybeSingle()
  if (error) throw toAppError(error)
  return data ? new Date(data.alert_at) : null
}
