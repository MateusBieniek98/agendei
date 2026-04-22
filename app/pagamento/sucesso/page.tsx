'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function PagamentoSucesso() {
  const [plano, setPlano]       = useState('')
  const [status, setStatus]     = useState<'atualizando' | 'ok' | 'erro'>('atualizando')

  useEffect(() => {
    const params  = new URLSearchParams(window.location.search)
    const planoParam = params.get('plano') || 'mensal'
    const userId     = params.get('user') || ''
    setPlano(planoParam)
    ativarPlano(userId, planoParam)
  }, [])

  async function ativarPlano(userId: string, plano: string) {
    if (!userId) {
      // Tenta pegar o usuário logado como fallback
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setStatus('erro'); return }
      await atualizarPerfil(user.id, plano)
      return
    }
    await atualizarPerfil(userId, plano)
  }

  async function atualizarPerfil(uid: string, plano: string) {
    const isAnual  = plano === 'anual'
    const diasPlano = isAnual ? 365 : 30
    const expira   = new Date(Date.now() + diasPlano * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    const { error } = await supabase
      .from('profiles')
      .update({ plano: 'pro', plano_expira: expira })
      .eq('id', uid)

    if (error) {
      console.error('Erro ao ativar plano:', error)
      setStatus('erro')
      return
    }
    setStatus('ok')
  }

  if (status === 'atualizando') return (
    <div style={{ minHeight:'100vh', background:'#f2f1ec', fontFamily:'system-ui', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ fontSize:28, fontWeight:700, color:'#0d1f17', marginBottom:12 }}>agen<span style={{ color:'#34d399' }}>dei</span></div>
        <div style={{ fontSize:14, color:'#6b7280' }}>Ativando seu plano Pro...</div>
      </div>
    </div>
  )

  if (status === 'erro') return (
    <div style={{ minHeight:'100vh', background:'#f2f1ec', fontFamily:'system-ui', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div style={{ background:'#fff', borderRadius:20, padding:'40px 32px', maxWidth:420, width:'100%', textAlign:'center', boxShadow:'0 4px 24px rgba(0,0,0,0.08)' }}>
        <div style={{ fontSize:48, marginBottom:16 }}>⚠️</div>
        <div style={{ fontSize:20, fontWeight:700, marginBottom:8 }}>Pagamento recebido!</div>
        <div style={{ fontSize:14, color:'#6b7280', lineHeight:1.6, marginBottom:24 }}>
          O pagamento foi confirmado, mas houve um erro ao ativar o plano automaticamente.<br/>
          Entre em contato para ativarmos manualmente.
        </div>
        <button onClick={()=>window.location.href='/'}
          style={{ width:'100%', padding:'13px', border:'none', borderRadius:12, fontSize:15, fontWeight:700, background:'#0d1f17', color:'#fff', cursor:'pointer', fontFamily:'inherit' }}>
          Ir para o dashboard →
        </button>
      </div>
    </div>
  )

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
