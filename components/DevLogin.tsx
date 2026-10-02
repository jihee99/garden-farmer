import { devLogin } from '@/app/login/actions'
import { SEED_USERS } from '@/lib/dev/seed-users'

export function DevLogin() {
  return (
    <section aria-label="개발용 로그인" className="flex flex-col gap-2 rounded-2xl border border-dashed border-line p-4">
      <p className="text-sm text-muted">개발용 · 테스트 계정으로 로그인</p>
      <div className="flex flex-wrap gap-2">
        {SEED_USERS.map((u) => (
          <form key={u.email} action={devLogin}>
            <input type="hidden" name="email" value={u.email} />
            <button type="submit" className="h-11 min-w-11 rounded-full border border-line bg-card px-4">
              {u.nickname}
            </button>
          </form>
        ))}
      </div>
    </section>
  )
}
