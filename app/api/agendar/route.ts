import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const cancel_token = randomUUID()

    const { error } = await supabaseAdmin
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

    if (error) {
      console.error('Supabase insert error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ cancel_token })
  } catch (err: any) {
    console.error('API error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
