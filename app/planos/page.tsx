'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function Planos() {
  const [anual, setAnual]     = useState(true)
  const [loading, setLoading] = useState<string|null>(null)
  const [user, setUser]       = useState<any>(null)
  const [erro, setErro]       = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUser(data.user)
    })
    // Checar se voltou com erro
    const params = new URLSearchParams(window.location.search)
    if (params.get('erro')) setErro('Pagamento não concluído. Tente novamente.')
  }, [])

  async function assinar(plano: string) {
    if (plano === 'starter') {
      if (user?.id) {
        await supabase.from('profiles').update({ onboarded: true, plano: 'starter' }).eq('id', user.id)
      }
      window.location.href = '/'
      return
    }

    setLoading(plano)
    setErro('')

    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plano,
          email: user?.email || '',
          userId: user?.id || '',
        }),
      })

      const data = await res.json()

      if (data.error) {
        setErro('Erro ao processar pagamento. Tente novamente.')
        setLoading(null)
        return
      }

      // Redireciona para o checkout do Mercado Pago
      window.location.href = data.init_point

    } catch {
      setErro('Erro de conexão. Tente novamente.')
      setLoading(null)
    }
  }

  const preco = anual ? 29 : 39
  const total = anual ? 348 : 39

  return (
    <div style={{ minHeight:'100vh', background:'#f2f1ec', fontFamily:'system-ui, sans-serif', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'32px 16px' }}>

      {/* Logo */}
      <div style={{ textAlign:'center', marginBottom:28 }}>
        <div style={{ fontSize:28, fontWeight:700, color:'#0d1f17', marginBottom:4 }}>
          agen<span style={{ color:'#34d399' }}>dei</span>
        </div>
        <div style={{ fontSize:14, color:'#6b7280' }}>Escolha seu plano e comece agora</div>
      </div>

      {/* Trial badge */}
      <div style={{ background:'#dcfce7', color:'#166534', fontSize:13, fontWeight:600, padding:'8px 20px', borderRadius:99, marginBottom:28 }}>
        🎉 7 dias grátis — sem cobrar nada agora
      </div>

      {erro && (
        <div style={{ background:'#fee2e2', color:'#dc2626', padding:'10px 20px', borderRadius:10, fontSize:13, marginBottom:20, maxWidth:640, width:'100%', textAlign:'center' }}>
          {erro}
        </div>
      )}

      {/* Toggle mensal/anual */}
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:28 }}>
        <span style={{ fontSize:14, color: anual?'#9ca3af':'#111827', fontWeight: anual?400:600 }}>Mensal</span>
        <div onClick={()=>setAnual(!anual)}
          style={{ width:48, height:26, borderRadius:99, background: anual?'#0d1f17':'#e5e7eb', cursor:'pointer', position:'relative', transition:'background .2s' }}>
          <div style={{ position:'absolute', width:20, height:20, borderRadius:'50%', background:'#fff', top:3, left: anual?25:3, transition:'left .2s', boxShadow:'0 1px 3px rgba(0,0,0,.2)' }} />
        </div>
        <span style={{ fontSize:14, color: anual?'#111827':'#9ca3af', fontWeight: anual?600:400 }}>
          Anual <span style={{ fontSize:11, background:'#dcfce7', color:'#166534', padding:'2px 7px', borderRadius:99, fontWeight:600, marginLeft:4 }}>2 meses grátis</span>
        </span>
      </div>

      {/* Cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))', gap:16, width:'100%', maxWidth:640, marginBottom:28 }}>

        {/* Starter */}
        <div style={{ background:'#fff', borderRadius:20, padding:'28px 24px', border:'1.5px solid #e5e7eb' }}>
          <div style={{ fontSize:13, fontWeight:600, color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:12 }}>Starter</div>
          <div style={{ fontSize:38, fontWeight:700, color:'#111827', marginBottom:4 }}>Grátis</div>
          <div style={{ fontSize:13, color:'#9ca3af', marginBottom:20 }}>para sempre</div>
          <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:24 }}>
            {[
              { ok:true,  txt:'Até 20 agendamentos/mês' },
              { ok:true,  txt:'Página do cliente' },
              { ok:true,  txt:'Cadastro de serviços' },
              { ok:true,  txt:'Histórico de clientes' },
              { ok:false, txt:'Notificações WhatsApp' },
              { ok:false, txt:'Relatórios avançados' },
              { ok:false, txt:'Suporte prioritário' },
            ].map((f,i)=>(
              <div key={i} style={{ fontSize:13.5, color: f.ok?'#111827':'#9ca3af', display:'flex', gap:8 }}>
                <span>{f.ok?'✅':'❌'}</span>{f.txt}
              </div>
            ))}
          </div>
          <button onClick={()=>assinar('starter')} disabled={!!loading}
            style={{ width:'100%', padding:'11px', border:'1.5px solid #e5e7eb', borderRadius:10, fontSize:14, fontWeight:600, background:'#fff', cursor:'pointer', fontFamily:'inherit', color:'#111827' }}>
            Continuar grátis
          </button>
        </div>

        {/* Pro */}
        <div style={{ background:'#0d1f17', borderRadius:20, padding:'28px 24px', border:'1.5px solid #0d1f17', position:'relative', overflow:'hidden' }}>
          <div style={{ position:'absolute', top:16, right:16, background:'#34d399', color:'#0d1f17', fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:99 }}>
            MAIS POPULAR
          </div>
          <div style={{ fontSize:13, fontWeight:600, color:'#34d399', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:12 }}>Pro</div>
          <div style={{ display:'flex', alignItems:'baseline', gap:4, marginBottom:4 }}>
            <span style={{ fontSize:16, fontWeight:500, color:'rgba(255,255,255,0.5)' }}>R$</span>
            <span style={{ fontSize:38, fontWeight:700, color:'#fff' }}>{preco}</span>
            <span style={{ fontSize:14, color:'rgba(255,255,255,0.5)' }}>/mês</span>
          </div>
          <div style={{ fontSize:13, color:'rgba(255,255,255,0.4)', marginBottom:20 }}>
            {anual ? `Cobrado R$ ${total}/ano` : 'Cobrado mensalmente'}
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:24 }}>
            {[
              'Agendamentos ilimitados',
              'Notificações WhatsApp automáticas',
              'Relatórios financeiros completos',
              'Pix integrado no agendamento',
              'Suporte prioritário',
              '7 dias grátis para testar',
            ].map((f,i)=>(
              <div key={i} style={{ fontSize:13.5, color:'rgba(255,255,255,0.85)', display:'flex', gap:8 }}>
                <span style={{ color:'#34d399', flexShrink:0 }}>✓</span>{f}
              </div>
            ))}
          </div>

          {/* Métodos de pagamento */}
          <div style={{ display:'flex', gap:6, marginBottom:16, flexWrap:'wrap' }}>
            {['💳 Cartão','📱 Pix','🏦 Boleto'].map(m=>(
              <span key={m} style={{ fontSize:11, background:'rgba(255,255,255,0.1)', color:'rgba(255,255,255,0.7)', padding:'3px 10px', borderRadius:99 }}>{m}</span>
            ))}
          </div>

          <button onClick={()=>assinar(anual?'anual':'mensal')} disabled={!!loading}
            style={{ width:'100%', padding:'12px', border:'none', borderRadius:10, fontSize:14, fontWeight:700, background:'#34d399', cursor: loading?'default':'pointer', fontFamily:'inherit', color:'#0d1f17', opacity: loading?0.7:1 }}>
            {loading ? 'Aguarde...' : 'Começar teste grátis →'}
          </button>

          <div style={{ textAlign:'center', fontSize:11.5, color:'rgba(255,255,255,0.35)', marginTop:10 }}>
            Sem compromisso. Cancele quando quiser.
          </div>
        </div>
      </div>

      {/* Benefícios */}
      <div style={{ background:'#fff', borderRadius:16, padding:'20px 24px', width:'100%', maxWidth:640, border:'1px solid rgba(0,0,0,0.08)' }}>
        <div style={{ fontSize:13, fontWeight:600, color:'#6b7280', marginBottom:12 }}>Por que vale a pena?</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
          {[
            { ic:'💰', val:'R$ 29/mês', label:'Menos que 1 atendimento' },
            { ic:'⏱️', val:'+3h/semana', label:'Economizadas no WhatsApp' },
            { ic:'📉', val:'-80%', label:'Menos faltas com lembretes' },
          ].map(s=>(
            <div key={s.label} style={{ textAlign:'center' }}>
              <div style={{ fontSize:20, marginBottom:4 }}>{s.ic}</div>
              <div style={{ fontSize:15, fontWeight:700, color:'#0d1f17' }}>{s.val}</div>
              <div style={{ fontSize:11, color:'#9ca3af', marginTop:2 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop:20, fontSize:12, color:'#9ca3af', textAlign:'center' }}>
        Já tem uma conta?{' '}
        <span onClick={()=>window.location.href='/'} style={{ color:'#059669', fontWeight:600, cursor:'pointer' }}>
          Entrar no dashboard
        </span>
      </div>
    </div>
  )
}
