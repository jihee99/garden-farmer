import { redirect } from 'next/navigation'
import { signOut } from '@/lib/auth/actions'
import { createClient } from '@/lib/supabase/server'

export default async function GardenPage() {
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getClaims()
  const uid = auth?.claims.sub
  if (!uid) redirect('/login')

  const [{ data: profile }, { data: gardens }] = await Promise.all([
    supabase.from('profiles').select('nickname').eq('id', uid).single(),
    supabase.from('gardens').select('id, name, kind, max_members, garden_members(count)').order('created_at'),
  ])

  return (
    <main className="flex min-h-dvh flex-col gap-6 px-5 pt-13">
      <h1 className="font-serif text-2xl font-bold">{profile?.nickname}님의 정원</h1>
      <ul className="flex flex-col gap-2">
        {gardens?.map((g) => (
          <li key={g.id} className="flex min-h-11 items-center justify-between rounded-2xl border border-line bg-card px-4">
            <span>{g.name}</span>
            <span className="text-sm text-muted">
              {g.garden_members[0]?.count ?? 0} / {g.max_members}명
            </span>
          </li>
        ))}
      </ul>
      <form action={signOut}>
        <button type="submit" className="h-11 text-sm text-muted underline">
          로그아웃
        </button>
      </form>
    </main>
  )
}
