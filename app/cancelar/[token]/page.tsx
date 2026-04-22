'use client'

import { useState, useEffect, use } from 'react'

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

function fmtDate(str: string) {
  const [y, m, d] = str.split('-')
  return `${parseInt(d)} de ${MESES[parseInt(m)-1]} de ${y}`
}

const STATUS_LABEL: Record<string, string> = {
  confirmado: '✅ Confirmado',
  concluido:  '✔️ Concluído',
  pendente:   '⏳ Aguardando',
  cancelado:  '❌ Cancelado',
}

const STATUS_COLOR: Record<string, string> = {
  confirmado: '#dcfce7',
  concluido:  '#f3f4f6',
  pendente:   '#fef3c7',
  cancelado:  '#fee2e2',
}

export default function CancelarPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)

  const [ag, setAg]           = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNF]     = useState(false)
  const [canceling, setCanc]  = useState(false)
  const [done, setDone]       = useState(false)
  const [confirm, setConfirm] = useState(false)

  useEffect(() => { if (token) load() }, [token])

  async function load() {
    const res = await fetch(`/api/cancelar?token=${token}`)
    if (!res.ok) { setNF(true); setLoading(false); return }
    const data = await res.json()
    setAg(data)
    setLoading(false)
  }

  async function cancelar() {
    setCanc(true)
    const res = await fetch('/api/cancelar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
    setCanc(false)
    if (res.ok) { setDone(true); setAg((a: any) => ({ ...a, status: 'cancelado' })) }
  }

  if (loading) return (
    <div style={{ display:'flex', height:'100vh', alignItems:'center', justifyContent:'center', fontFamily:'system-ui', background:'#f2f1ec' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ fontSize:28, fontWeight:700, color:'#0d1f17' }}>agen<span style={{ color:'#34d399' }}>dei</span></div>
        <div style={{ color:'#6b7280', marginTop:8, fontSize:14 }}>Carregando...</div>
      </div>
    </div>
  )

  if (notFound) return (
    <div style={{ display:'flex', height:'100vh', alignItems:'center', justifyContent:'center', fontFamily:'system-ui', background:'#f2f1ec' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ fontSize:40, marginBottom:12 }}>😕</div>
        <div style={{ fontSize:18, fontWeight:600 }}>Agendamento não encontrado</div>
        <div style={{ fontSize:13, color:'#6b7280', marginTop:6 }}>Este link é inválido ou já expirou.</div>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight:'100vh', background:'#f2f1ec', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'system-ui', padding:16 }}>
      <div style={{ background:'#fff', borderRadius:20, padding:'32px 28px', maxWidth:400, width:'100%', boxShadow:'0 4px 24px rgba(0,0,0,0.08)' }}>

        <div style={{ textAlign:'center', marginBottom:24 }}>
          <div style={{ fontSize:14, fontWeight:600, color:'#6b7280', marginBottom:8 }}>agen<span style={{ color:'#0d1f17' }}>dei</span></div>
          <div style={{ fontSize:20, fontWeight:700, color:'#0d1f17' }}>
            {done ? '✅ Agendamento cancelado' : 'Meu agendamento'}
          </div>
          {ag?.profissional_nome && (
            <div style={{ fontSize:13, color:'#6b7280', marginTop:4 }}>com {ag.profissional_nome}</div>
          )}
        </div>

        <div style={{ background:'#f9fafb', borderRadius:14, padding:16, marginBottom:20 }}>
          {[
            { ic:'✂️', label:'Serviço',  val: ag?.servico },
            { ic:'📅', label:'Data',     val: ag?.data ? fmtDate(ag.data) : '' },
            { ic:'🕐', label:'Horário',  val: ag?.horario?.slice(0,5) },
            { ic:'👤', label:'Cliente',  val: ag?.cliente_nome },
          ].map((r,i) => (
            <div key={i} style={{ display:'flex', gap:10, marginBottom: i<3?10:0 }}>
              <span style={{ fontSize:16 }}>{r.ic}</span>
              <div>
                <div style={{ fontSize:11, color:'#9ca3af' }}>{r.label}</div>
                <div style={{ fontSize:14, fontWeight:600 }}>{r.val}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ background: STATUS_COLOR[ag?.status] || '#f3f4f6', borderRadius:10, padding:'10px 14px', fontSize:13, fontWeight:600, textAlign:'center', marginBottom:20 }}>
          {STATUS_LABEL[ag?.status] || ag?.status}
        </div>

        {!done && ag?.status !== 'cancelado' && ag?.status !== 'concluido' && (
          <>
            {!confirm ? (
              <button onClick={() => setConfirm(true)}
                style={{ width:'100%', padding:13, border:'none', borderRadius:12, fontSize:14, fontWeight:700, background:'#fee2e2', color:'#dc2626', cursor:'pointer', fontFamily:'inherit' }}>
                Cancelar agendamento
              </button>
            ) : (
              <div>
                <div style={{ fontSize:13, color:'#dc2626', fontWeight:500, textAlign:'center', marginBottom:12 }}>
                  ⚠️ Tem certeza? Esta ação não pode ser desfeita.
                </div>
                <div style={{ display:'flex', gap:8 }}>
                  <button onClick={cancelar} disabled={canceling}
                    style={{ flex:1, padding:12, border:'none', borderRadius:10, fontSize:14, fontWeight:700, background:'#dc2626', color:'#fff', cursor:'pointer', fontFamily:'inherit', opacity:canceling?0.7:1 }}>
                    {canceling ? 'Cancelando...' : 'Sim, cancelar'}
                  </button>
                  <button onClick={() => setConfirm(false)}
                    style={{ flex:1, padding:12, border:'1.5px solid #e5e7eb', borderRadius:10, fontSize:14, fontWeight:500, background:'#fff', color:'#374151', cursor:'pointer', fontFamily:'inherit' }}>
                    Voltar
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {(done || ag?.status === 'cancelado') && (
          <div style={{ fontSize:13, color:'#6b7280', textAlign:'center' }}>
            Agendamento cancelado com sucesso.
          </div>
        )}

        {ag?.status === 'concluido' && (
          <div style={{ fontSize:13, color:'#6b7280', textAlign:'center' }}>
            Este agendamento já foi concluído e não pode ser cancelado.
          </div>
        )}
      </div>
    </div>
  )
}
