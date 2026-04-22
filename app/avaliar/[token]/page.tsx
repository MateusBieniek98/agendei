'use client'

import { useState, useEffect, use } from 'react'

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

function fmtDate(str: string) {
  const [y, m, d] = str.split('-')
  return `${parseInt(d)} de ${MESES[parseInt(m)-1]} de ${y}`
}

const LABELS = ['', 'Ruim 😞', 'Regular 😐', 'Bom 🙂', 'Ótimo 😄', 'Excelente 🤩']

export default function AvaliarPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)

  const [ag, setAg]           = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNF]     = useState(false)
  const [estrelas, setEstrelas] = useState(0)
  const [hover, setHover]     = useState(0)
  const [comentario, setComentario] = useState('')
  const [saving, setSaving]   = useState(false)
  const [done, setDone]       = useState(false)

  useEffect(() => { if (token) load() }, [token])

  async function load() {
    const res = await fetch(`/api/avaliar?token=${token}`)
    if (!res.ok) { setNF(true); setLoading(false); return }
    const data = await res.json()
    setAg(data)
    if (data.avaliacao) { setEstrelas(data.avaliacao); setDone(true) }
    setLoading(false)
  }

  async function enviar() {
    if (!estrelas) return
    setSaving(true)
    const res = await fetch('/api/avaliar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, avaliacao: estrelas, avaliacao_comentario: comentario }),
    })
    setSaving(false)
    if (res.ok) setDone(true)
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
        <div style={{ fontSize:18, fontWeight:600 }}>Link inválido</div>
        <div style={{ fontSize:13, color:'#6b7280', marginTop:6 }}>Este link de avaliação não foi encontrado.</div>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight:'100vh', background:'#f2f1ec', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'system-ui', padding:16 }}>
      <div style={{ background:'#fff', borderRadius:20, padding:'32px 28px', maxWidth:400, width:'100%', boxShadow:'0 4px 24px rgba(0,0,0,0.08)' }}>

        <div style={{ textAlign:'center', marginBottom:24 }}>
          <div style={{ fontSize:14, fontWeight:600, color:'#6b7280', marginBottom:8 }}>agen<span style={{ color:'#0d1f17' }}>dei</span></div>
          {done ? (
            <>
              <div style={{ fontSize:48, marginBottom:8 }}>🎉</div>
              <div style={{ fontSize:20, fontWeight:700, color:'#0d1f17' }}>Obrigado pela avaliação!</div>
              <div style={{ fontSize:13, color:'#6b7280', marginTop:4 }}>Sua opinião é muito importante.</div>
              <div style={{ display:'flex', justifyContent:'center', gap:4, marginTop:16 }}>
                {[1,2,3,4,5].map(n => (
                  <span key={n} style={{ fontSize:32, color: n <= estrelas ? '#f59e0b' : '#e5e7eb' }}>★</span>
                ))}
              </div>
              {ag?.avaliacao_comentario && (
                <div style={{ background:'#f9fafb', borderRadius:10, padding:'10px 14px', fontSize:13, color:'#374151', marginTop:12, textAlign:'left' }}>
                  "{ag.avaliacao_comentario}"
                </div>
              )}
            </>
          ) : (
            <>
              <div style={{ fontSize:20, fontWeight:700, color:'#0d1f17' }}>Como foi seu atendimento?</div>
              <div style={{ fontSize:13, color:'#6b7280', marginTop:4 }}>com {ag?.profissional_nome}</div>
            </>
          )}
        </div>

        {!done && (
          <>
            <div style={{ background:'#f9fafb', borderRadius:14, padding:16, marginBottom:20 }}>
              {[
                { ic:'✂️', label:'Serviço', val: ag?.servico },
                { ic:'📅', label:'Data',    val: ag?.data ? fmtDate(ag.data) : '' },
                { ic:'🕐', label:'Horário', val: ag?.horario?.slice(0,5) },
              ].map((r,i) => (
                <div key={i} style={{ display:'flex', gap:10, marginBottom: i<2?8:0 }}>
                  <span style={{ fontSize:16 }}>{r.ic}</span>
                  <div>
                    <div style={{ fontSize:11, color:'#9ca3af' }}>{r.label}</div>
                    <div style={{ fontSize:14, fontWeight:600 }}>{r.val}</div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ textAlign:'center', marginBottom:20 }}>
              <div style={{ fontSize:13, fontWeight:600, color:'#374151', marginBottom:12 }}>Toque nas estrelas para avaliar</div>
              <div style={{ display:'flex', justifyContent:'center', gap:6, marginBottom:8 }}>
                {[1,2,3,4,5].map(n => (
                  <span
                    key={n}
                    onClick={() => setEstrelas(n)}
                    onMouseEnter={() => setHover(n)}
                    onMouseLeave={() => setHover(0)}
                    style={{ fontSize:40, cursor:'pointer', color: n <= (hover || estrelas) ? '#f59e0b' : '#e5e7eb', transition:'color .1s' }}>
                    ★
                  </span>
                ))}
              </div>
              {(hover || estrelas) > 0 && (
                <div style={{ fontSize:13, fontWeight:600, color:'#f59e0b' }}>{LABELS[hover || estrelas]}</div>
              )}
            </div>

            <div style={{ marginBottom:16 }}>
              <textarea
                placeholder="Deixe um comentário (opcional)..."
                value={comentario}
                onChange={e=>setComentario(e.target.value)}
                rows={3}
                style={{ width:'100%', padding:'10px 13px', border:'1.5px solid #e5e7eb', borderRadius:10, fontSize:14, fontFamily:'inherit', outline:'none', color:'#111827', boxSizing:'border-box', resize:'vertical' }}
              />
            </div>

            <button onClick={enviar} disabled={!estrelas || saving}
              style={{ width:'100%', padding:13, border:'none', borderRadius:12, fontSize:15, fontWeight:700, background: estrelas ? '#0d1f17' : '#e5e7eb', color: estrelas ? '#fff' : '#9ca3af', cursor: estrelas ? 'pointer' : 'default', fontFamily:'inherit', opacity:saving?0.7:1 }}>
              {saving ? 'Enviando...' : 'Enviar avaliação ✓'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
