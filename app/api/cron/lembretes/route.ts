import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const maxDuration = 60

const ZAPI_INSTANCE = process.env.ZAPI_INSTANCE_ID!
const ZAPI_TOKEN    = process.env.ZAPI_TOKEN!
const CRON_SECRET   = process.env.CRON_SECRET!

const MESES = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro']

function fmtDate(str: string) {
  const [, m, d] = str.split('-')
  return `${parseInt(d)} de ${MESES[parseInt(m)-1]}`
}

async function enviarWhatsApp(telefone: string, mensagem: string) {
  const num = telefone.replace(/\D/g, '')
  const phone = num.startsWith('55') ? num : `55${num}`

  const res = await fetch(
    `https://api.z-api.io/instances/${ZAPI_INSTANCE}/token/${ZAPI_TOKEN}/send-text`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, message: mensagem }),
    }
  )
  return res.ok
}

export async function GET(req: NextRequest) {
  // Verifica segurança do cron (permite acesso com ?secret= para debug)
  const auth = req.headers.get('authorization')
  const secretParam = req.nextUrl.searchParams.get('secret')
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}` && secretParam !== CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Data de amanhã (permite override via ?date= para testes)
  const dateParam = req.nextUrl.searchParams.get('date')
  let dataAmanha: string
  if (dateParam) {
    dataAmanha = dateParam
  } else {
    const amanha = new Date()
    amanha.setDate(amanha.getDate() + 1)
    dataAmanha = amanha.toISOString().split('T')[0]
  }

  // DEBUG: busca todos agendamentos recentes para verificar
  const { data: debug } = await supabase
    .from('agendamentos')
    .select('id, data, status, lembrete_enviado, cliente_nome')
    .order('created_at', { ascending: false })
    .limit(5)

  // Busca agendamentos de amanhã que ainda não receberam lembrete
  const { data: agendamentos, error } = await supabase
    .from('agendamentos')
    .select('id, cliente_nome, cliente_telefone, servico, data, horario, profissional_id, cancel_token')
    .eq('data', dataAmanha)
    .eq('lembrete_enviado', false)
    .in('status', ['confirmado', 'pendente'])

  if (error) {
    console.error('Erro ao buscar agendamentos:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!agendamentos || agendamentos.length === 0) {
    return NextResponse.json({ ok: true, enviados: 0, msg: 'Nenhum lembrete para enviar', debug: { dataAmanha, ultimos5: debug } })
  }

  // Busca nomes dos profissionais
  const profIds = [...new Set(agendamentos.map(a => a.profissional_id))]
  const { data: profissionais } = await supabase
    .from('profiles')
    .select('id, nome')
    .in('id', profIds)

  const profMap: Record<string, string> = {}
  profissionais?.forEach(p => { profMap[p.id] = p.nome })

  let enviados = 0
  const erros: string[] = []

  for (const ag of agendamentos) {
    if (!ag.cliente_telefone) continue

    const profNome = profMap[ag.profissional_id] || 'seu profissional'
    const cancelLink = ag.cancel_token
      ? `\n\nPrecisa cancelar? Acesse: https://www.appdamarei.com/cancelar/${ag.cancel_token}`
      : ''

    const mensagem =
      `Olá, ${ag.cliente_nome}! 👋\n\n` +
      `Lembrando que você tem um agendamento *amanhã*:\n\n` +
      `✂️ *Serviço:* ${ag.servico}\n` +
      `👤 *Profissional:* ${profNome}\n` +
      `📅 *Data:* ${fmtDate(ag.data)}\n` +
      `🕐 *Horário:* ${ag.horario?.slice(0, 5)}\n` +
      `${cancelLink}\n\n` +
      `_Mensagem automática enviada pelo Marei_ 💚`

    const ok = await enviarWhatsApp(ag.cliente_telefone, mensagem)

    if (ok) {
      await supabase
        .from('agendamentos')
        .update({ lembrete_enviado: true })
        .eq('id', ag.id)
      enviados++
    } else {
      erros.push(ag.id)
    }
  }

  return NextResponse.json({
    ok: true,
    enviados,
    total: agendamentos.length,
    erros: erros.length > 0 ? erros : undefined,
  })
}
