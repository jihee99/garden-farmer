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
