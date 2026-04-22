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
    .select('id, cliente_nome, servico, data, horario, status, avaliacao, avaliacao_comentario, profissional_id')
    .eq('cancel_token', token)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Agendamento não encontrado' }, { status: 404 })

  const { data: prof } = await supabaseAdmin
    .from('profiles')
    .select('nome')
    .eq('id', data.profissional_id)
    .single()

  return NextResponse.json({ ...data, profissional_nome: prof?.nome || '' })
}

export async function POST(req: NextRequest) {
  const { token, avaliacao, avaliacao_comentario } = await req.json()
  if (!token || !avaliacao) return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
  if (avaliacao < 1 || avaliacao > 5) return NextResponse.json({ error: 'Avaliação inválida' }, { status: 400 })

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: ag } = await supabaseAdmin
    .from('agendamentos')
    .select('status, avaliacao')
    .eq('cancel_token', token)
    .single()

  if (!ag) return NextResponse.json({ error: 'Agendamento não encontrado' }, { status: 404 })
  if (ag.avaliacao) return NextResponse.json({ error: 'Já avaliado' }, { status: 400 })

  const { error } = await supabaseAdmin
    .from('agendamentos')
    .update({ avaliacao, avaliacao_comentario: avaliacao_comentario || null })
    .eq('cancel_token', token)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
