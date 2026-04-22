import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  const body = await req.json()

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const cancel_token = crypto.randomUUID()

  const { data, error } = await supabaseAdmin
    .from('agendamentos')
    .insert({
      profissional_id: body.profissional_id,
      cliente_nome: body.cliente_nome,
      cliente_telefone: body.cliente_telefone,
      servico: body.servico,
      data: body.data,
      horario: body.horario,
      preco: body.preco || '',
      duracao: body.duracao || '',
      status: 'confirmado',
      cancel_token,
    })
    .select('id, cancel_token')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ id: data.id, cancel_token: data.cancel_token })
}
