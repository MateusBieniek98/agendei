import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { plano, email, userId } = await req.json()

    const isAnual = plano === 'anual'
    const preco   = isAnual ? 348.00 : 39.00
    const titulo  = isAnual ? 'Agendei Pro — Plano Anual' : 'Agendei Pro — Plano Mensal'

    const body = {
      items: [
        {
          id: plano,
          title: titulo,
          quantity: 1,
          unit_price: preco,
          currency_id: 'BRL',
        }
      ],
      payer: {
        email: email || 'cliente@agendei.app',
      },
      back_urls: {
        success: `${process.env.NEXT_PUBLIC_APP_URL || 'https://agendei-rho.vercel.app'}/pagamento/sucesso?plano=${plano}&user=${userId}`,
        failure: `${process.env.NEXT_PUBLIC_APP_URL || 'https://agendei-rho.vercel.app'}/planos?erro=pagamento`,
        pending: `${process.env.NEXT_PUBLIC_APP_URL || 'https://agendei-rho.vercel.app'}/planos?pendente=true`,
      },
      auto_return: 'approved',
      statement_descriptor: 'AGENDEI APP',
      external_reference: `${userId}_${plano}_${Date.now()}`,
      payment_methods: {
        excluded_payment_types: [],
        installments: isAnual ? 12 : 1,
      },
    }

    const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.MP_ACCESS_TOKEN}`,
      },
      body: JSON.stringify(body),
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('MP error:', data)
      return NextResponse.json({ error: 'Erro ao criar preferência' }, { status: 500 })
    }

    return NextResponse.json({
      id: data.id,
      init_point: data.init_point,
      sandbox_init_point: data.sandbox_init_point,
    })

  } catch (error) {
    console.error('Checkout error:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}