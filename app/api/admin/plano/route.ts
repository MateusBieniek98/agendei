import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const ADMIN_EMAIL = 'mateusonepiece98@gmail.com'

// Service role bypassa o RLS — nunca exponha esta key no client
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { userId, plano, meses } = await req.json()

    // Verifica se o request vem de um usuário autenticado
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !user) return NextResponse.json({ error: 'Token inválido' }, { status: 401 })
    if (user.email !== ADMIN_EMAIL) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

    // Calcula expiração
    let plano_expira: string | null = null
    if (plano === 'pro' && meses !== 'permanente') {
      plano_expira = new Date(Date.now() + Number(meses) * 30 * 24 * 60 * 60 * 1000)
        .toISOString().split('T')[0]
    }

    const { error } = await supabaseAdmin
      .from('profiles')
      .update({
        plano: plano === 'pro' ? 'pro' : 'starter',
        plano_expira: plano === 'pro' ? plano_expira : null,
      })
      .eq('id', userId)

    if (error) {
      console.error('Erro ao atualizar plano:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
