'use client'

import { useState, useEffect, use } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const DIAS  = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']
const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const HORAS = ['08:00','08:30','09:00','09:30','10:00','10:30','11:00','11:30','13:00','13:30','14:00','14:30','15:00','15:30','16:00','16:30','17:00','17:30','18:00']
const DEFAULT_SERVICES = ['Manicure','Pedicure','Corte','Barba','Massagem','Consulta','Outro']

const inp: React.CSSProperties = { width:'100%', padding:'10px 13px', border:'1.5px solid #e5e7eb', borderRadius:10, fontSize:14, fontFamily:'inherit', outline:'none', color:'#111827', boxSizing:'border-box' }
const lbl: React.CSSProperties = { fontSize:12.5, fontWeight:500, color:'#6b7280', display:'block', marginBottom:5 }

export default function AgendarPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params)

  const [prof, setProf]         = useState<any>(null)
  const [servicos, setServicos] = useState<any[]>([])
  const [step, setStep]         = useState(1)
  const [selSvc, setSelSvc]     = useState<any>(null)
  const [selDate, setSelDate]   = useState<Date|null>(null)
  const [selTime, setSelTime]   = useState('')
  const [ocupados, setOcupados] = useState<string[]>([])
  const [nome, setNome]         = useState('')
  const [tel, setTel]           = useState('')
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [done, setDone]         = useState(false)
  const [notFound, setNF]       = useState(false)
  const [mes, setMes]           = useState(() => new Date())

  useEffect(() => { if (slug) loadProf() }, [slug])

  async function loadProf() {
    try {
      const { data: byId } = await supabase.from('profiles').select('*').eq('id', slug).single()
      if (byId) { setProf(byId); await loadServicos(byId.id); setLoading(false); return }

      const { data: todos } = await supabase.from('profiles').select('*')
      const found = (todos || []).find((p: any) => {
        const s = (p.nome || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,'')
        return s === slug
      })
      if (found) { setProf(found); await loadServicos(found.id); setLoading(false); return }

      setNF(true); setLoading(false)
    } catch { setNF(true); setLoading(false) }
  }

  async function loadServicos(uid: string) {
    const { data } = await supabase.from('servicos').select('*').eq('profissional_id', uid).order('nome')
    setServicos(data || [])
  }

  async function loadOcupados(date: Date) {
    const d = date.toISOString().split('T')[0]
    const { data } = await supabase.from('agendamentos').select('horario').eq('profissional_id', prof.id).eq('data', d)
    setOcupados((data || []).map((a: any) => a.horario?.slice(0,5)))
  }

  function selectDate(d: Date) { setSelDate(d); setSelTime(''); loadOcupados(d); setStep(3) }

  async function confirmar() {
    if (!nome || !tel) return alert('Preencha nome e WhatsApp!')
    setSaving(true)
    await supabase.from('agendamentos').insert({
      profissional_id: prof.id,
      cliente_nome: nome,
      cliente_telefone: tel,
      servico: selSvc?.nome || selSvc,
      data: selDate!.toISOString().split('T')[0],
      horario: selTime,
      preco: selSvc?.preco || '',
      duracao: selSvc?.duracao || '',
      status: 'confirmado',
    })
    setSaving(false); setDone(true)
  }

  function fmtDate(d: Date) { return `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}` }

  const hoje = new Date(); hoje.setHours(0,0,0,0)
  const primeiroDia = new Date(mes.getFullYear(), mes.getMonth(), 1)
  const ultimoDia   = new Date(mes.getFullYear(), mes.getMonth()+1, 0)
  const diasVazios  = primeiroDia.getDay()
  const dias: (Date|null)[] = [...Array(diasVazios).fill(null)]
  for (let d=1; d<=ultimoDia.getDate(); d++) dias.push(new Date(mes.getFullYear(), mes.getMonth(), d))

  // Usa serviços do banco ou padrão
  const svcList = servicos.length > 0
    ? servicos
    : DEFAULT_SERVICES.map(s => ({ id:s, nome:s, preco:'', duracao:'' }))

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
        <div style={{ fontSize:18, fontWeight:600 }}>Profissional não encontrado</div>
        <div style={{ fontSize:13, color:'#6b7280', marginTop:6 }}>Verifique o link e tente novamente</div>
      </div>
    </div>
  )

  if (done) return (
    <div style={{ minHeight:'100vh', background:'#f2f1ec', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'system-ui', padding:16 }}>
      <div style={{ background:'#fff', borderRadius:20, padding:'32px 28px', maxWidth:400, width:'100%', textAlign:'center', boxShadow:'0 4px 24px rgba(0,0,0,0.08)' }}>
        <div style={{ width:64, height:64, borderRadius:'50%', background:'#dcfce7', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px', fontSize:32 }}>✅</div>
        <div style={{ fontSize:22, fontWeight:700, marginBottom:8 }}>Agendado!</div>
        <div style={{ fontSize:14, color:'#6b7280', lineHeight:1.6, marginBottom:20 }}>Seu horário com <strong>{prof?.nome}</strong> foi confirmado.</div>
        <div style={{ background:'#f9fafb', borderRadius:14, padding:16, textAlign:'left', marginBottom:20 }}>
          {[
            { ic:'✂️', label:'Serviço', val: selSvc?.nome },
            { ic:'📅', label:'Data',    val: selDate ? fmtDate(selDate) : '' },
            { ic:'🕐', label:'Horário', val: selTime },
            { ic:'👤', label:'Cliente', val: nome },
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
        <button onClick={()=>{ setStep(1); setSelSvc(null); setSelDate(null); setSelTime(''); setNome(''); setTel(''); setDone(false) }}
          style={{ width:'100%', padding:12, border:'1.5px solid #e5e7eb', borderRadius:12, fontSize:14, fontWeight:500, background:'#fff', cursor:'pointer', fontFamily:'inherit' }}>
          Fazer outro agendamento
        </button>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight:'100vh', background:'#f2f1ec', fontFamily:'system-ui, sans-serif', padding:'20px 16px 40px' }}>
      <div style={{ maxWidth:420, margin:'0 auto' }}>

        <div style={{ textAlign:'center', marginBottom:20 }}>
          <div style={{ fontSize:14, fontWeight:600, color:'#6b7280', marginBottom:12 }}>agen<span style={{ color:'#0d1f17' }}>dei</span></div>
          <div style={{ width:64, height:64, borderRadius:'50%', background:'linear-gradient(135deg,#059669,#34d399)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, fontWeight:700, color:'#fff', margin:'0 auto 10px' }}>
            {prof?.nome?.split(' ').map((n:string)=>n[0]).join('').toUpperCase().slice(0,2)}
          </div>
          <div style={{ fontSize:18, fontWeight:700 }}>{prof?.nome}</div>
          <div style={{ fontSize:13, color:'#6b7280', marginTop:2 }}>Agende seu horário</div>
        </div>

        <div style={{ display:'flex', alignItems:'center', marginBottom:24, padding:'0 8px' }}>
          {[1,2,3,4].map((n,i) => (
            <div key={n} style={{ display:'flex', alignItems:'center', flex: i<3?1:'auto' as any }}>
              <div style={{ width:28, height:28, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, flexShrink:0,
                background: step>n?'#059669':step===n?'#0d1f17':'#e5e7eb',
                color: step>=n?'#fff':'#9ca3af' }}>
                {step>n?'✓':n}
              </div>
              {i<3 && <div style={{ flex:1, height:2, background: step>n?'#059669':'#e5e7eb', margin:'0 4px' }} />}
            </div>
          ))}
        </div>

        <div style={{ background:'#fff', borderRadius:20, padding:'24px 22px', boxShadow:'0 4px 24px rgba(0,0,0,0.08)' }}>

          {step===1 && (
            <div>
              <div style={{ fontSize:16, fontWeight:600, marginBottom:16 }}>Escolha o serviço</div>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {svcList.map((s:any) => (
                  <div key={s.id||s.nome} onClick={()=>{ setSelSvc(s); setStep(2) }}
                    style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'13px 16px', border:'1.5px solid #e5e7eb', borderRadius:12, cursor:'pointer' }}>
                    <div>
                      <div style={{ fontSize:14, fontWeight:500 }}>{s.nome}</div>
                      {s.duracao && <div style={{ fontSize:12, color:'#6b7280', marginTop:2 }}>⏱ {s.duracao}</div>}
                    </div>
                    <div style={{ textAlign:'right' }}>
                      {s.preco && <div style={{ fontSize:15, fontWeight:700 }}>{s.preco}</div>}
                      <span style={{ color:'#9ca3af', fontSize:14 }}>→</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step===2 && (
            <div>
              <button onClick={()=>setStep(1)} style={{ background:'none', border:'none', fontSize:13, color:'#6b7280', cursor:'pointer', padding:0, marginBottom:16, fontFamily:'inherit' }}>← Voltar</button>
              <div style={{ background:'#f0fdf4', borderRadius:10, padding:'10px 14px', fontSize:13, color:'#059669', fontWeight:500, marginBottom:16 }}>
                ✂️ {selSvc?.nome} {selSvc?.preco && `· ${selSvc.preco}`}
              </div>
              <div style={{ fontSize:16, fontWeight:600, marginBottom:16 }}>Escolha a data</div>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
                <button onClick={()=>setMes(new Date(mes.getFullYear(),mes.getMonth()-1,1))} style={{ width:32, height:32, borderRadius:8, border:'1px solid #e5e7eb', background:'#fff', cursor:'pointer', fontSize:14 }}>‹</button>
                <span style={{ fontSize:14, fontWeight:600 }}>{MESES[mes.getMonth()]} {mes.getFullYear()}</span>
                <button onClick={()=>setMes(new Date(mes.getFullYear(),mes.getMonth()+1,1))} style={{ width:32, height:32, borderRadius:8, border:'1px solid #e5e7eb', background:'#fff', cursor:'pointer', fontSize:14 }}>›</button>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:4 }}>
                {DIAS.map(d=><div key={d} style={{ textAlign:'center', fontSize:11, fontWeight:500, color:'#9ca3af', padding:'4px 0' }}>{d}</div>)}
                {dias.map((d,i) => {
                  if (!d) return <div key={i} />
                  const isPast=d<hoje, isWeekend=d.getDay()===0||d.getDay()===6
                  const isToday=d.toDateString()===hoje.toDateString()
                  const isSel=selDate?.toDateString()===d.toDateString()
                  const disabled=isPast||isWeekend
                  return (
                    <div key={i} onClick={()=>!disabled&&selectDate(d)}
                      style={{ height:36, borderRadius:9, display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, cursor:disabled?'default':'pointer', position:'relative',
                        background:isSel?'#0d1f17':'transparent',
                        color:isSel?'#fff':disabled?'#d1d5db':isToday?'#059669':'#111827',
                        fontWeight:isToday?700:500 }}>
                      {d.getDate()}
                      {!disabled&&!isSel&&<div style={{ position:'absolute', bottom:3, left:'50%', transform:'translateX(-50%)', width:4, height:4, borderRadius:'50%', background:'#34d399' }} />}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {step===3 && (
            <div>
              <button onClick={()=>setStep(2)} style={{ background:'none', border:'none', fontSize:13, color:'#6b7280', cursor:'pointer', padding:0, marginBottom:16, fontFamily:'inherit' }}>← Voltar</button>
              <div style={{ background:'#f0fdf4', borderRadius:10, padding:'10px 14px', fontSize:13, color:'#059669', fontWeight:500, marginBottom:16 }}>
                📅 {selDate&&fmtDate(selDate)}
              </div>
              <div style={{ fontSize:16, fontWeight:600, marginBottom:16 }}>Escolha o horário</div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8 }}>
                {HORAS.map(h => {
                  const ocupado=ocupados.includes(h), sel=selTime===h
                  return (
                    <div key={h} onClick={()=>!ocupado&&setSelTime(h)}
                      style={{ padding:'10px 4px', textAlign:'center', fontSize:13, fontWeight:500, borderRadius:10, cursor:ocupado?'default':'pointer',
                        border:`1.5px solid ${sel?'#0d1f17':ocupado?'#f3f4f6':'#e5e7eb'}`,
                        background:sel?'#0d1f17':ocupado?'#f9f9f9':'#fff',
                        color:sel?'#fff':ocupado?'#d1d5db':'#111827' }}>
                      {h}
                    </div>
                  )
                })}
              </div>
              {selTime && (
                <button onClick={()=>setStep(4)} style={{ width:'100%', marginTop:20, padding:13, border:'none', borderRadius:12, fontSize:15, fontWeight:700, background:'#0d1f17', color:'#fff', cursor:'pointer', fontFamily:'inherit' }}>
                  Continuar →
                </button>
              )}
            </div>
          )}

          {step===4 && (
            <div>
              <button onClick={()=>setStep(3)} style={{ background:'none', border:'none', fontSize:13, color:'#6b7280', cursor:'pointer', padding:0, marginBottom:16, fontFamily:'inherit' }}>← Voltar</button>
              <div style={{ background:'#f9fafb', borderRadius:12, padding:'14px 16px', marginBottom:20 }}>
                {[
                  { ic:'✂️', val:selSvc?.nome },
                  { ic:'📅', val:selDate&&fmtDate(selDate) },
                  { ic:'🕐', val:selTime },
                  { ic:'💰', val:selSvc?.preco||'A combinar' },
                ].map((r,i)=>(
                  <div key={i} style={{ display:'flex', gap:8, marginBottom:i<3?8:0, fontSize:13 }}>
                    <span>{r.ic}</span><span style={{ fontWeight:500 }}>{r.val}</span>
                  </div>
                ))}
              </div>
              <div style={{ fontSize:16, fontWeight:600, marginBottom:16 }}>Seus dados</div>
              <div style={{ marginBottom:13 }}>
                <label style={lbl}>Nome completo</label>
                <input style={inp} type="text" placeholder="Ex: Ana Santos" value={nome} onChange={e=>setNome(e.target.value)} />
              </div>
              <div style={{ marginBottom:20 }}>
                <label style={lbl}>WhatsApp</label>
                <input style={inp} type="tel" placeholder="(67) 99999-0000" value={tel} onChange={e=>setTel(e.target.value)} />
              </div>
              <button onClick={confirmar} disabled={saving}
                style={{ width:'100%', padding:13, border:'none', borderRadius:12, fontSize:15, fontWeight:700, background:'#0d1f17', color:'#fff', cursor:'pointer', fontFamily:'inherit', opacity:saving?0.7:1 }}>
                {saving?'Confirmando...':'Confirmar agendamento ✓'}
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
