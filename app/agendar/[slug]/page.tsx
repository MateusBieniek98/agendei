'use client'

import { useState, useEffect, use } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const DIAS  = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']
const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const MESES_SHORT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
const HORAS = [
  '07:00','07:30','08:00','08:30','09:00','09:30',
  '10:00','10:30','11:00','11:30','12:00','12:30',
  '13:00','13:30','14:00','14:30','15:00','15:30',
  '16:00','16:30','17:00','17:30','18:00','18:30','19:00',
]
const DEFAULT_SERVICES = ['Manicure','Pedicure','Corte','Barba','Massagem','Consulta','Outro']

// ── Design tokens ──────────────────────────────────────────────
const C = {
  dark:    '#0a1a10',
  darkMid: '#0d1f17',
  accent:  '#34d399',
  accentD: '#059669',
  bg:      '#f4f6f4',
  white:   '#ffffff',
  text:    '#0f172a',
  muted:   '#64748b',
  border:  '#e2e8f0',
  red:     '#ef4444',
  green:   '#22c55e',
  wa:      '#25d366',
}

export default function AgendarPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params)

  const [prof, setProf]               = useState<any>(null)
  const [servicos, setServicos]       = useState<any[]>([])
  const [mediaAval, setMediaAval]     = useState<number>(0)
  const [totalAval, setTotalAval]     = useState<number>(0)
  const [step, setStep]               = useState(1)
  const [selSvc, setSelSvc]           = useState<any>(null)
  const [selDate, setSelDate]         = useState<Date|null>(null)
  const [selTime, setSelTime]         = useState('')
  const [ocupados, setOcupados]       = useState<string[]>([])
  const [diasBloqueados, setDB]       = useState<string[]>([])
  const [horasBloqueadas, setHB]      = useState<string[]>([])
  const [nome, setNome]               = useState('')
  const [tel, setTel]                 = useState('')
  const [loading, setLoading]         = useState(true)
  const [saving, setSaving]           = useState(false)
  const [done, setDone]               = useState(false)
  const [cancelToken, setCancelToken] = useState('')
  const [notFound, setNF]             = useState(false)
  const [mes, setMes]                 = useState(() => new Date())

  useEffect(() => { if (slug) loadProf() }, [slug])

  async function loadProf() {
    try {
      let found: any = null

      const { data: bySlug } = await supabase.from('profiles').select('*').eq('slug', slug).single()
      if (bySlug) found = bySlug

      if (!found) {
        const { data: byId } = await supabase.from('profiles').select('*').eq('id', slug).single()
        if (byId) found = byId
      }

      if (!found) {
        const { data: todos } = await supabase.from('profiles').select('*')
        found = (todos || []).find((p: any) => {
          const s = (p.nome || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,'')
          return s === slug
        })
      }

      if (!found) { setNF(true); setLoading(false); return }

      setProf(found)
      await Promise.all([
        loadServicos(found.id),
        loadBloqueios(found.id),
        loadAvaliacoes(found.id),
      ])
      setLoading(false)
    } catch { setNF(true); setLoading(false) }
  }

  async function loadServicos(uid: string) {
    const { data } = await supabase.from('servicos').select('*').eq('profissional_id', uid).order('nome')
    setServicos(data || [])
  }

  async function loadBloqueios(uid: string) {
    const { data } = await supabase.from('bloqueios').select('*').eq('profissional_id', uid)
    setDB((data || []).filter((b:any) => b.dia_inteiro).map((b:any) => b.data))
  }

  async function loadAvaliacoes(uid: string) {
    const { data } = await supabase.from('agendamentos').select('avaliacao').eq('profissional_id', uid).not('avaliacao', 'is', null)
    if (data && data.length > 0) {
      const media = data.reduce((s:number, a:any) => s + (a.avaliacao || 0), 0) / data.length
      setMediaAval(Math.round(media * 10) / 10)
      setTotalAval(data.length)
    }
  }

  async function loadOcupados(date: Date) {
    const d = date.toISOString().split('T')[0]
    const { data: ags } = await supabase.from('agendamentos').select('horario').eq('profissional_id', prof.id).eq('data', d)
    setOcupados((ags || []).map((a: any) => a.horario?.slice(0,5)))
    const { data: bloqs } = await supabase.from('bloqueios').select('horario').eq('profissional_id', prof.id).eq('data', d).eq('dia_inteiro', false)
    setHB((bloqs || []).filter((b:any) => b.horario).map((b:any) => b.horario.slice(0,5)))
  }

  function selectDate(d: Date) { setSelDate(d); setSelTime(''); loadOcupados(d); setStep(3) }

  async function confirmar() {
    if (!nome.trim() || !tel.trim()) return
    setSaving(true)
    const { data: newAg } = await supabase.from('agendamentos').insert({
      profissional_id: prof.id,
      cliente_nome: nome,
      cliente_telefone: tel,
      servico: selSvc?.nome || selSvc,
      data: selDate!.toISOString().split('T')[0],
      horario: selTime,
      preco: selSvc?.preco || '',
      duracao: selSvc?.duracao || '',
      status: 'confirmado',
    }).select('cancel_token').single()
    if (newAg?.cancel_token) setCancelToken(newAg.cancel_token)
    setSaving(false)
    setDone(true)
    if (prof?.telefone) {
      const num = prof.telefone.replace(/\D/g,'')
      const dataFmt = selDate ? `${selDate.getDate()}/${selDate.getMonth()+1}/${selDate.getFullYear()}` : ''
      const msg = encodeURIComponent(`Olá ${prof.nome}! Acabei de marcar pelo Marei:\n\n✂️ Serviço: ${selSvc?.nome||selSvc}\n📅 Data: ${dataFmt}\n🕐 Horário: ${selTime}\n👤 Nome: ${nome}\n\nAguardo confirmação! 😊`)
      setTimeout(() => window.open(`https://wa.me/55${num}?text=${msg}`, '_blank'), 1500)
    }
  }

  function fmtDate(d: Date) { return `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}` }
  function initials(n: string) { return (n||'').split(' ').map((x:string)=>x[0]).join('').toUpperCase().slice(0,2) }

  const hoje = new Date(); hoje.setHours(0,0,0,0)
  const primeiroDia = new Date(mes.getFullYear(), mes.getMonth(), 1)
  const ultimoDia   = new Date(mes.getFullYear(), mes.getMonth()+1, 0)
  const dias: (Date|null)[] = [...Array(primeiroDia.getDay()).fill(null)]
  for (let d=1; d<=ultimoDia.getDate(); d++) dias.push(new Date(mes.getFullYear(), mes.getMonth(), d))

  const svcList = servicos.length > 0
    ? servicos
    : DEFAULT_SERVICES.map(s => ({ id:s, nome:s, preco:'', duracao:'' }))

  const todosOcupados = HORAS.every(h => ocupados.includes(h) || horasBloqueadas.includes(h))

  // ── Loading ──────────────────────────────────────────────────
  if (loading) return (
    <div style={{ display:'flex', height:'100vh', alignItems:'center', justifyContent:'center', background:C.dark, fontFamily:'system-ui' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ fontSize:32, fontWeight:800, color:C.white, letterSpacing:-1 }}>
          ma<span style={{ color:C.accent }}>rei</span>
        </div>
        <div style={{ display:'flex', gap:6, justifyContent:'center', marginTop:16 }}>
          {[0,1,2].map(i => (
            <div key={i} style={{ width:8, height:8, borderRadius:'50%', background:C.accent, opacity:0.4,
              animation:`pulse 1.2s ease-in-out ${i*0.2}s infinite` }} />
          ))}
        </div>
        <style>{`@keyframes pulse { 0%,100%{opacity:.4;transform:scale(1)} 50%{opacity:1;transform:scale(1.3)} }`}</style>
      </div>
    </div>
  )

  // ── Not found ─────────────────────────────────────────────────
  if (notFound) return (
    <div style={{ display:'flex', height:'100vh', flexDirection:'column', alignItems:'center', justifyContent:'center', background:C.dark, fontFamily:'system-ui', padding:24 }}>
      <div style={{ fontSize:32, fontWeight:800, color:C.white, letterSpacing:-1, marginBottom:32 }}>ma<span style={{ color:C.accent }}>rei</span></div>
      <div style={{ fontSize:48, marginBottom:16 }}>😕</div>
      <div style={{ fontSize:20, fontWeight:700, color:C.white }}>Profissional não encontrado</div>
      <div style={{ fontSize:14, color:'rgba(255,255,255,0.5)', marginTop:8 }}>Verifique o link e tente novamente</div>
    </div>
  )

  // ── Success ───────────────────────────────────────────────────
  if (done) return (
    <div style={{ minHeight:'100vh', background:C.bg, fontFamily:'system-ui', display:'flex', flexDirection:'column' }}>
      {/* Header */}
      <div style={{ background:C.dark, padding:'20px 24px 32px' }}>
        <div style={{ fontSize:22, fontWeight:800, color:C.white, letterSpacing:-0.5 }}>ma<span style={{ color:C.accent }}>rei</span></div>
      </div>

      <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', padding:'24px 16px' }}>
        <div style={{ width:'100%', maxWidth:420 }}>
          {/* Success card */}
          <div style={{ background:C.white, borderRadius:24, overflow:'hidden', boxShadow:'0 8px 40px rgba(0,0,0,0.10)' }}>
            <div style={{ background:`linear-gradient(135deg, ${C.darkMid}, #1a4a30)`, padding:'32px 28px', textAlign:'center' }}>
              <div style={{ width:72, height:72, borderRadius:'50%', background:'rgba(52,211,153,0.2)', border:`3px solid ${C.accent}`, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px', fontSize:36 }}>✓</div>
              <div style={{ fontSize:24, fontWeight:800, color:C.white, letterSpacing:-0.5 }}>Tudo certo!</div>
              <div style={{ fontSize:14, color:'rgba(255,255,255,0.6)', marginTop:6 }}>Seu horário foi confirmado com <strong style={{ color:C.accent }}>{prof?.nome}</strong></div>
            </div>
            <div style={{ padding:'24px 24px 28px' }}>
              {/* Booking summary */}
              <div style={{ display:'flex', flexDirection:'column', gap:12, marginBottom:20 }}>
                {[
                  { ic:'✂️', label:'Serviço',  val: selSvc?.nome },
                  { ic:'📅', label:'Data',     val: selDate ? fmtDate(selDate) : '' },
                  { ic:'🕐', label:'Horário',  val: selTime },
                  { ic:'👤', label:'Cliente',  val: nome },
                ].map((r,i) => (
                  <div key={i} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 14px', background:C.bg, borderRadius:12 }}>
                    <span style={{ fontSize:20, flexShrink:0 }}>{r.ic}</span>
                    <div>
                      <div style={{ fontSize:11, color:C.muted, fontWeight:500, textTransform:'uppercase', letterSpacing:'0.05em' }}>{r.label}</div>
                      <div style={{ fontSize:14, fontWeight:700, color:C.text, marginTop:1 }}>{r.val}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pix */}
              {prof?.pix_key && (
                <div style={{ background:'#f0fdf4', border:'1.5px solid #bbf7d0', borderRadius:14, padding:'14px 16px', marginBottom:16 }}>
                  <div style={{ fontSize:11, fontWeight:700, color:C.accentD, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:6 }}>💳 Pagamento via Pix</div>
                  <div style={{ fontSize:12, color:C.muted, marginBottom:4 }}>Chave Pix de {prof.nome}:</div>
                  <div style={{ fontSize:15, fontWeight:700, color:C.darkMid, wordBreak:'break-all' }}>{prof.pix_key}</div>
                </div>
              )}

              {/* WhatsApp CTA */}
              {prof?.telefone && (
                <button onClick={()=>{
                  const num = prof.telefone.replace(/\D/g,'')
                  const dataFmt = selDate ? `${selDate.getDate()}/${selDate.getMonth()+1}/${selDate.getFullYear()}` : ''
                  const msg = encodeURIComponent(`Olá ${prof.nome}! Acabei de marcar pelo Marei:\n\n✂️ Serviço: ${selSvc?.nome||selSvc}\n📅 Data: ${dataFmt}\n🕐 Horário: ${selTime}\n👤 Nome: ${nome}\n\nAguardo confirmação! 😊`)
                  window.open(`https://wa.me/55${num}?text=${msg}`, '_blank')
                }} style={{ width:'100%', padding:'14px', border:'none', borderRadius:14, fontSize:15, fontWeight:700, background:C.wa, color:C.white, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center', gap:8, marginBottom:10 }}>
                  <span style={{ fontSize:20 }}>💬</span> Confirmar pelo WhatsApp
                </button>
              )}

              <button onClick={()=>{ setStep(1); setSelSvc(null); setSelDate(null); setSelTime(''); setNome(''); setTel(''); setDone(false); setCancelToken('') }}
                style={{ width:'100%', padding:'12px', border:`1.5px solid ${C.border}`, borderRadius:14, fontSize:14, fontWeight:500, background:C.white, color:C.muted, cursor:'pointer', fontFamily:'inherit', marginBottom:cancelToken?10:0 }}>
                Fazer outro agendamento
              </button>

              {/* Cancel link */}
              {cancelToken && (
                <div style={{ textAlign:'center', paddingTop:4 }}>
                  <a href={`${window.location.origin}/cancelar/${cancelToken}`}
                    style={{ fontSize:12, color:C.muted, textDecoration:'underline', textUnderlineOffset:3 }}>
                    Precisa cancelar? Clique aqui
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  // ── Main booking page ─────────────────────────────────────────
  return (
    <div style={{ minHeight:'100vh', background:C.bg, fontFamily:'system-ui, -apple-system, sans-serif' }}>
      <style>{`
        * { box-sizing: border-box; }
        input:focus { border-color: #0d1f17 !important; box-shadow: 0 0 0 3px rgba(13,31,23,0.08); }
        .svc-card:hover { border-color: #0d1f17 !important; background: #f8faf8 !important; transform: translateY(-1px); box-shadow: 0 4px 16px rgba(0,0,0,0.08); }
        .time-slot:hover:not(.ocupado) { border-color: #0d1f17 !important; background: #f0fdf4 !important; }
        .day-btn:hover:not(.disabled) { background: #f0fdf4 !important; }
      `}</style>

      {/* ── Hero ── */}
      <div style={{ background:`linear-gradient(160deg, ${C.dark} 0%, #0d2a1a 100%)`, padding:'28px 24px 40px', position:'relative', overflow:'hidden' }}>
        {/* Background decoration */}
        <div style={{ position:'absolute', top:-60, right:-60, width:200, height:200, borderRadius:'50%', background:'rgba(52,211,153,0.05)' }} />
        <div style={{ position:'absolute', bottom:-40, left:-40, width:160, height:160, borderRadius:'50%', background:'rgba(52,211,153,0.04)' }} />

        {/* Logo */}
        <div style={{ fontSize:18, fontWeight:800, color:C.white, letterSpacing:-0.5, marginBottom:28, position:'relative' }}>
          ma<span style={{ color:C.accent }}>rei</span>
        </div>

        {/* Professional info */}
        <div style={{ display:'flex', alignItems:'center', gap:16, position:'relative' }}>
          <div style={{ width:72, height:72, borderRadius:'50%', background:`linear-gradient(135deg, ${C.accentD}, ${C.accent})`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:26, fontWeight:800, color:C.white, flexShrink:0, boxShadow:'0 4px 20px rgba(52,211,153,0.3)' }}>
            {initials(prof?.nome || '')}
          </div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:22, fontWeight:800, color:C.white, letterSpacing:-0.5, lineHeight:1.2 }}>{prof?.nome}</div>
            {totalAval > 0 && (
              <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:6 }}>
                <div style={{ display:'flex', gap:2 }}>
                  {[1,2,3,4,5].map(n => (
                    <span key={n} style={{ fontSize:13, color: n <= Math.round(mediaAval) ? '#fbbf24' : 'rgba(255,255,255,0.2)' }}>★</span>
                  ))}
                </div>
                <span style={{ fontSize:13, color:'rgba(255,255,255,0.7)', fontWeight:500 }}>{mediaAval} <span style={{ opacity:0.5 }}>({totalAval} avaliações)</span></span>
              </div>
            )}
            {!totalAval && prof?.descricao && (
              <div style={{ fontSize:13, color:'rgba(255,255,255,0.6)', marginTop:4, lineHeight:1.4 }}>{prof.descricao}</div>
            )}
          </div>
        </div>

        {totalAval > 0 && prof?.descricao && (
          <div style={{ fontSize:13, color:'rgba(255,255,255,0.55)', marginTop:14, lineHeight:1.5, position:'relative' }}>{prof.descricao}</div>
        )}

        {prof?.endereco && (
          <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:10, position:'relative' }}>
            <span style={{ fontSize:13 }}>📍</span>
            <span style={{ fontSize:12.5, color:'rgba(255,255,255,0.5)' }}>{prof.endereco}</span>
          </div>
        )}

        {/* Step progress */}
        <div style={{ display:'flex', alignItems:'center', gap:0, marginTop:24, position:'relative' }}>
          {['Serviço','Data','Horário','Dados'].map((label, i) => {
            const n = i + 1
            const active = step === n
            const done2 = step > n
            return (
              <div key={n} style={{ display:'flex', alignItems:'center', flex: i < 3 ? 1 : 'auto' as any }}>
                <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
                  <div style={{ width:30, height:30, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, flexShrink:0, transition:'all .2s',
                    background: done2 ? C.accent : active ? C.white : 'rgba(255,255,255,0.12)',
                    color: done2 ? C.dark : active ? C.dark : 'rgba(255,255,255,0.4)',
                    boxShadow: active ? '0 0 0 3px rgba(255,255,255,0.2)' : 'none' }}>
                    {done2 ? '✓' : n}
                  </div>
                  <span style={{ fontSize:10, fontWeight:500, color: active ? C.accent : done2 ? C.accent : 'rgba(255,255,255,0.3)', whiteSpace:'nowrap' }}>{label}</span>
                </div>
                {i < 3 && (
                  <div style={{ flex:1, height:2, margin:'0 6px', marginBottom:16, background: done2 ? C.accent : 'rgba(255,255,255,0.12)', transition:'background .3s' }} />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Booking card ── */}
      <div style={{ maxWidth:480, margin:'-16px auto 0', padding:'0 16px 40px', position:'relative', zIndex:1 }}>
        <div style={{ background:C.white, borderRadius:24, boxShadow:'0 8px 40px rgba(0,0,0,0.10)', overflow:'hidden' }}>

          {/* ── Step 1: Services ── */}
          {step === 1 && (
            <div style={{ padding:'24px 22px' }}>
              <div style={{ fontSize:18, fontWeight:800, color:C.text, letterSpacing:-0.3, marginBottom:4 }}>Escolha o serviço</div>
              <div style={{ fontSize:13, color:C.muted, marginBottom:20 }}>Selecione o que você deseja agendar</div>
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {svcList.map((s:any) => (
                  <div key={s.id||s.nome} className="svc-card" onClick={()=>{ setSelSvc(s); setStep(2) }}
                    style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 18px', border:`1.5px solid ${C.border}`, borderRadius:16, cursor:'pointer', transition:'all .15s', background:C.white }}>
                    <div style={{ display:'flex', alignItems:'center', gap:14 }}>
                      <div style={{ width:44, height:44, borderRadius:12, background:'#f0fdf4', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0 }}>
                        ✂️
                      </div>
                      <div>
                        <div style={{ fontSize:15, fontWeight:700, color:C.text }}>{s.nome}</div>
                        {s.duracao && <div style={{ fontSize:12, color:C.muted, marginTop:2 }}>⏱ {s.duracao}</div>}
                      </div>
                    </div>
                    <div style={{ textAlign:'right', flexShrink:0 }}>
                      {s.preco && <div style={{ fontSize:16, fontWeight:800, color:C.darkMid }}>{s.preco}</div>}
                      <div style={{ fontSize:18, color:C.muted, marginTop:2 }}>›</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Step 2: Calendar ── */}
          {step === 2 && (
            <div style={{ padding:'24px 22px' }}>
              <button onClick={()=>setStep(1)} style={{ display:'flex', alignItems:'center', gap:6, background:'none', border:'none', fontSize:13, color:C.muted, cursor:'pointer', padding:0, marginBottom:20, fontFamily:'inherit', fontWeight:500 }}>
                ← Voltar
              </button>

              {/* Selected service badge */}
              <div style={{ display:'flex', alignItems:'center', gap:10, background:'#f0fdf4', border:'1.5px solid #bbf7d0', borderRadius:12, padding:'10px 14px', marginBottom:20 }}>
                <span style={{ fontSize:18 }}>✂️</span>
                <div>
                  <div style={{ fontSize:14, fontWeight:700, color:C.darkMid }}>{selSvc?.nome}</div>
                  {selSvc?.preco && <div style={{ fontSize:12, color:C.accentD }}>{selSvc.preco}</div>}
                </div>
              </div>

              <div style={{ fontSize:18, fontWeight:800, color:C.text, letterSpacing:-0.3, marginBottom:4 }}>Escolha a data</div>
              <div style={{ fontSize:13, color:C.muted, marginBottom:20 }}>Dias úteis disponíveis</div>

              {/* Month navigation */}
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
                <button onClick={()=>setMes(new Date(mes.getFullYear(),mes.getMonth()-1,1))}
                  style={{ width:36, height:36, borderRadius:10, border:`1.5px solid ${C.border}`, background:C.white, cursor:'pointer', fontSize:16, display:'flex', alignItems:'center', justifyContent:'center' }}>‹</button>
                <span style={{ fontSize:15, fontWeight:700, color:C.text }}>{MESES[mes.getMonth()]} {mes.getFullYear()}</span>
                <button onClick={()=>setMes(new Date(mes.getFullYear(),mes.getMonth()+1,1))}
                  style={{ width:36, height:36, borderRadius:10, border:`1.5px solid ${C.border}`, background:C.white, cursor:'pointer', fontSize:16, display:'flex', alignItems:'center', justifyContent:'center' }}>›</button>
              </div>

              {/* Calendar grid */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:4 }}>
                {DIAS.map(d => <div key={d} style={{ textAlign:'center', fontSize:11, fontWeight:600, color:C.muted, padding:'4px 0', textTransform:'uppercase', letterSpacing:'0.04em' }}>{d}</div>)}
                {dias.map((d,i) => {
                  if (!d) return <div key={i} />
                  const isPast = d < hoje
                  const isWeekend = d.getDay()===0 || d.getDay()===6
                  const isToday = d.toDateString() === hoje.toDateString()
                  const isSel = selDate?.toDateString() === d.toDateString()
                  const isBloqueado = diasBloqueados.includes(d.toISOString().split('T')[0])
                  const disabled = isPast || isWeekend || isBloqueado
                  return (
                    <div key={i} className={disabled ? 'disabled' : 'day-btn'} onClick={()=>!disabled && selectDate(d)}
                      style={{ height:40, borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:2, fontSize:13, cursor:disabled?'not-allowed':'pointer', transition:'all .1s', position:'relative',
                        background: isSel ? C.darkMid : isBloqueado ? '#fef2f2' : 'transparent',
                        color: isSel ? C.white : disabled ? '#cbd5e1' : isToday ? C.accentD : C.text,
                        fontWeight: isSel ? 700 : isToday ? 700 : 500,
                        border: isSel ? 'none' : isToday && !disabled ? `1.5px solid ${C.accent}` : '1.5px solid transparent' }}>
                      {d.getDate()}
                      {!disabled && !isSel && (
                        <div style={{ width:4, height:4, borderRadius:'50%', background:C.accent, position:'absolute', bottom:4 }} />
                      )}
                      {isBloqueado && <span style={{ fontSize:8 }}>🚫</span>}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── Step 3: Time slots ── */}
          {step === 3 && (
            <div style={{ padding:'24px 22px' }}>
              <button onClick={()=>setStep(2)} style={{ display:'flex', alignItems:'center', gap:6, background:'none', border:'none', fontSize:13, color:C.muted, cursor:'pointer', padding:0, marginBottom:20, fontFamily:'inherit', fontWeight:500 }}>
                ← Voltar
              </button>

              {/* Date badge */}
              <div style={{ display:'flex', alignItems:'center', gap:10, background:'#f0fdf4', border:'1.5px solid #bbf7d0', borderRadius:12, padding:'10px 14px', marginBottom:20 }}>
                <span style={{ fontSize:18 }}>📅</span>
                <div style={{ fontSize:14, fontWeight:700, color:C.darkMid }}>{selDate && fmtDate(selDate)}</div>
              </div>

              <div style={{ fontSize:18, fontWeight:800, color:C.text, letterSpacing:-0.3, marginBottom:4 }}>Escolha o horário</div>
              <div style={{ fontSize:13, color:C.muted, marginBottom:20 }}>Horários disponíveis para este dia</div>

              {todosOcupados ? (
                <div style={{ textAlign:'center', padding:'32px 0' }}>
                  <div style={{ fontSize:44, marginBottom:12 }}>😕</div>
                  <div style={{ fontSize:16, fontWeight:700, color:C.text }}>Sem horários disponíveis</div>
                  <div style={{ fontSize:13, color:C.muted, marginTop:4, marginBottom:20 }}>Tente escolher outra data</div>
                  <button onClick={()=>setStep(2)}
                    style={{ padding:'12px 24px', border:`1.5px solid ${C.border}`, borderRadius:12, fontSize:14, fontWeight:600, background:C.white, color:C.text, cursor:'pointer', fontFamily:'inherit' }}>
                    ← Escolher outra data
                  </button>
                </div>
              ) : (
                <>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8 }}>
                    {HORAS.map(h => {
                      const ocupado = ocupados.includes(h) || horasBloqueadas.includes(h)
                      const sel = selTime === h
                      return (
                        <div key={h} className={ocupado ? 'ocupado' : 'time-slot'} onClick={()=>!ocupado && setSelTime(h)}
                          style={{ padding:'11px 4px', textAlign:'center', fontSize:13, fontWeight:600, borderRadius:12, cursor:ocupado?'not-allowed':'pointer', transition:'all .1s',
                            border:`1.5px solid ${sel ? C.darkMid : ocupado ? '#f1f5f9' : C.border}`,
                            background: sel ? C.darkMid : ocupado ? '#f8fafc' : C.white,
                            color: sel ? C.white : ocupado ? '#cbd5e1' : C.text,
                            position:'relative' }}>
                          {h}
                          {sel && <div style={{ position:'absolute', bottom:4, left:'50%', transform:'translateX(-50%)', width:4, height:4, borderRadius:'50%', background:C.accent }} />}
                        </div>
                      )
                    })}
                  </div>
                  {ocupados.length > 0 && (
                    <div style={{ marginTop:12, fontSize:12, color:C.muted }}>
                      {ocupados.length} horário{ocupados.length!==1?'s':''} já reservado{ocupados.length!==1?'s':''}
                    </div>
                  )}
                  {selTime && (
                    <button onClick={()=>setStep(4)}
                      style={{ width:'100%', marginTop:20, padding:'14px', border:'none', borderRadius:14, fontSize:15, fontWeight:700, background:C.darkMid, color:C.white, cursor:'pointer', fontFamily:'inherit' }}>
                      Continuar com {selTime} →
                    </button>
                  )}
                </>
              )}
            </div>
          )}

          {/* ── Step 4: Confirm ── */}
          {step === 4 && (
            <div style={{ padding:'24px 22px' }}>
              <button onClick={()=>setStep(3)} style={{ display:'flex', alignItems:'center', gap:6, background:'none', border:'none', fontSize:13, color:C.muted, cursor:'pointer', padding:0, marginBottom:20, fontFamily:'inherit', fontWeight:500 }}>
                ← Voltar
              </button>

              <div style={{ fontSize:18, fontWeight:800, color:C.text, letterSpacing:-0.3, marginBottom:20 }}>Confirme seu agendamento</div>

              {/* Summary */}
              <div style={{ background:C.bg, borderRadius:16, padding:'16px', marginBottom:24 }}>
                <div style={{ fontSize:11, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:12 }}>Resumo</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                  {[
                    { ic:'✂️', label:'Serviço',  val: selSvc?.nome },
                    { ic:'💰', label:'Valor',    val: selSvc?.preco||'A combinar' },
                    { ic:'📅', label:'Data',     val: selDate ? `${selDate.getDate()} ${MESES_SHORT[selDate.getMonth()]}` : '' },
                    { ic:'🕐', label:'Horário',  val: selTime },
                  ].map((r,i) => (
                    <div key={i} style={{ background:C.white, borderRadius:10, padding:'10px 12px' }}>
                      <div style={{ fontSize:11, color:C.muted }}>{r.label}</div>
                      <div style={{ fontSize:14, fontWeight:700, color:C.text, marginTop:2 }}>{r.val}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Form */}
              <div style={{ marginBottom:14 }}>
                <label style={{ fontSize:12.5, fontWeight:600, color:C.text, display:'block', marginBottom:6 }}>Nome completo</label>
                <input
                  type="text"
                  placeholder="Ex: Ana Santos"
                  value={nome}
                  onChange={e=>setNome(e.target.value)}
                  style={{ width:'100%', padding:'12px 14px', border:`1.5px solid ${C.border}`, borderRadius:12, fontSize:14, fontFamily:'inherit', outline:'none', color:C.text, transition:'border .15s' }}
                />
              </div>
              <div style={{ marginBottom:24 }}>
                <label style={{ fontSize:12.5, fontWeight:600, color:C.text, display:'block', marginBottom:6 }}>WhatsApp</label>
                <input
                  type="tel"
                  placeholder="(67) 99999-0000"
                  value={tel}
                  onChange={e=>setTel(e.target.value)}
                  style={{ width:'100%', padding:'12px 14px', border:`1.5px solid ${C.border}`, borderRadius:12, fontSize:14, fontFamily:'inherit', outline:'none', color:C.text, transition:'border .15s' }}
                />
              </div>

              <button onClick={confirmar} disabled={saving || !nome.trim() || !tel.trim()}
                style={{ width:'100%', padding:'15px', border:'none', borderRadius:14, fontSize:16, fontWeight:800, background: (nome.trim() && tel.trim()) ? C.darkMid : '#e2e8f0', color: (nome.trim() && tel.trim()) ? C.white : '#94a3b8', cursor: (nome.trim() && tel.trim()) ? 'pointer' : 'default', fontFamily:'inherit', letterSpacing:-0.3, transition:'all .2s' }}>
                {saving ? 'Confirmando...' : 'Confirmar agendamento ✓'}
              </button>
            </div>
          )}

        </div>

        {/* Footer */}
        <div style={{ textAlign:'center', marginTop:20 }}>
          <span style={{ fontSize:12, color:'#94a3b8' }}>Agendamento por </span>
          <span style={{ fontSize:12, fontWeight:700, color:C.darkMid }}>ma<span style={{ color:C.accentD }}>rei</span></span>
        </div>
      </div>
    </div>
  )
}
