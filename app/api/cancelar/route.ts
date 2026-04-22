import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  if (!token) return NextResponse.json({ error: 'Token inválido' }, { status: 400 })

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data, error } = await supabaseAdmin
    .from('agendamentos')
    .select('id, cliente_nome, servico, data, horario, status, profissional_id')
    .eq('cancel_token', token)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Agendamento não encontrado' }, { status: 404 })

  // Busca nome do profissional
  const { data: prof } = await supabaseAdmin
    .from('profiles')
    .select('nome')
    .eq('id', data.profissional_id)
    .single()

  return NextResponse.json({ ...data, profissional_nome: prof?.nome || '' })
}

export async function POST(req: NextRequest) {
  const { token } = await req.json()
  if (!token) return NextResponse.json({ error: 'Token inválido' }, { status: 400 })

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: ag } = await supabaseAdmin
    .from('agendamentos')
    .select('status')
    .eq('cancel_token', token)
    .single()

  if (!ag) return NextResponse.json({ error: 'Agendamento não encontrado' }, { status: 404 })
  if (ag.status === 'cancelado') return NextResponse.json({ error: 'Já cancelado' }, { status: 400 })

  const { error } = await supabaseAdmin
    .from('agendamentos')
    .update({ status: 'cancelado' })
    .eq('cancel_token', token)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
