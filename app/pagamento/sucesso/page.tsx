'use client'

import { useEffect, useState } from 'react'

export default function PagamentoSucesso() {
  const [plano, setPlano] = useState('')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    setPlano(params.get('plano') || 'pro')
    // Aqui futuramente salva o plano no banco do usuário
  }, [])

  return (
    <div style={{ minHeight:'100vh', background:'#f2f1ec', fontFamily:'system-ui, sans-serif', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div style={{ background:'#fff', borderRadius:20, padding:'40px 32px', maxWidth:420, width:'100%', textAlign:'center', boxShadow:'0 4px 24px rgba(0,0,0,0.08)' }}>
        <div style={{ width:72, height:72, borderRadius:'50%', background:'#dcfce7', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 20px', fontSize:36 }}>✅</div>
        <div style={{ fontSize:24, fontWeight:700, marginBottom:8 }}>Pagamento confirmado!</div>
        <div style={{ fontSize:14, color:'#6b7280', lineHeight:1.6, marginBottom:28 }}>
          Bem-vindo ao <strong>Agendei Pro</strong>! Seu plano {plano === 'anual' ? 'anual' : 'mensal'} está ativo.
        </div>
        <div style={{ background:'#f0fdf4', borderRadius:12, padding:'16px', marginBottom:24, textAlign:'left' }}>
          {[
            '✓ Agendamentos ilimitados ativados',
            '✓ Notificações WhatsApp liberadas',
            '✓ Relatórios completos disponíveis',
            '✓ Suporte prioritário ativado',
          ].map((f,i)=>(
            <div key={i} style={{ fontSize:13.5, color:'#166534', marginBottom: i<3?8:0 }}>{f}</div>
          ))}
        </div>
        <button onClick={()=>window.location.href='/'}
          style={{ width:'100%', padding:'13px', border:'none', borderRadius:12, fontSize:15, fontWeight:700, background:'#0d1f17', color:'#fff', cursor:'pointer', fontFamily:'inherit' }}>
          Ir para o dashboard →
        </button>
      </div>
    </div>
  )
}
