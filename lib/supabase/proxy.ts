import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PUBLIC_PREFIXES = ['/login', '/auth', '/manifest.webmanifest', '/sw.js', '/icons', '/icon', '/apple-icon']

function redirectTo(request: NextRequest, response: NextResponse, pathname: string) {
  const url = request.nextUrl.clone()
  url.pathname = pathname
  url.search = ''
  const redirect = NextResponse.redirect(url)
  response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie))
  ;['Cache-Control', 'Expires', 'Pragma'].forEach((name) => {
    const value = response.headers.get(name)
    if (value) redirect.headers.set(name, value)
  })
  return redirect
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
          Object.entries(headers ?? {}).forEach(([key, value]) => response.headers.set(key, value))
        },
      },
    },
  )

  // createServerClient와 getClaims 사이에 다른 코드를 넣지 않는다(세션 끊김 방지).
  const { data } = await supabase.auth.getClaims()
  const signedIn = Boolean(data?.claims)
  const { pathname } = request.nextUrl
  const isPublic = PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))

  if (!signedIn && !isPublic) {
    return redirectTo(request, response, '/login')
  }
  if (signedIn && pathname === '/login') {
    return redirectTo(request, response, '/garden')
  }
  return response
}
