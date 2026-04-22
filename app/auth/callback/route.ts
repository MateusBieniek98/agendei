import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')

  if (!code) {
    return NextResponse.redirect(new URL('/login?erro=sem_codigo', requestUrl.origin))
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const { data: { session }, error: sessionError } = await supabase.auth.exchangeCodeForSession(code)

  if (sessionError || !session?.user) {
    return NextResponse.redirect(new URL('/login?erro=sessao', requestUrl.origin))
  }

  const user = session.user

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, plano')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile) {
    const nome = user.user_metadata?.full_name || user.user_metadata?.nome || user.email?.split('@')[0] || 'Profissional'
    await supabase.from('profiles').insert({
      id: user.id,
      email: user.email,
      nome,
    })
    return NextResponse.redirect(new URL('/planos', requestUrl.origin))
  }

  if (!profile.plano) {
    return NextResponse.redirect(new URL('/planos', requestUrl.origin))
  }

  return NextResponse.redirect(new URL('/', requestUrl.origin))
}