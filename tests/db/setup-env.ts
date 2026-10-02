import { config } from 'dotenv'

config({ path: '.env.local' })

for (const key of ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_SECRET_KEY']) {
  if (!process.env[key]) throw new Error(`${key}가 .env.local에 없습니다`)
}
