import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')

  if (!code) {
    return NextResponse.redirect(new URL('/login?erro=sem_codigo', requestUrl.origin))
  }

  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet: any[]) {
          cookiesToSet.forEach(({ name, value, options }: any) => {
            cookieStore.set(name, value, options)
          })
        },
      },
    }
  )

  const { data: { session }, error: sessionError } = await supabase.auth.exchangeCodeForSession(code)

  if (sessionError || !session?.user) {
    return NextResponse.redirect(new URL('/login?erro=sessao', requestUrl.origin))
  }

  const user = session.user

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, plan')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile) {
    await fetch(
      process.env.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1/profiles',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
          'Authorization': 'Bearer ' + session.access_token,
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({
          id: user.id,
          email: user.email,
          name: user.user_metadata?.full_name ?? '',
          full_name: user.user_metadata?.full_name ?? '',
          avatar_url: user.user_metadata?.avatar_url ?? '',
          plan: 'free',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }),
      }
    )
    return NextResponse.redirect(new URL('/planos', requestUrl.origin))
  }

  return NextResponse.redirect(new URL('/dashboard', requestUrl.origin))
}
