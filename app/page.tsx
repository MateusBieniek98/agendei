'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const DEFAULT_SERVICES = ['Manicure','Pedicure','Manicure + Pedicure','Corte','Barba','Corte + Barba','Hidratação capilar','Progressiva','Massagem','Personal Training','Consulta','Outro']
const BAR  = ['#f87171','#60a5fa','#a78bfa','#fbbf24','#34d399','#fb923c','#e879f9','#38bdf8']
const BG   = ['#fee2e2','#dbeafe','#ede9fe','#fef3c7','#d1fae5','#ffedd5','#fae8ff','#e0f2fe']
const TXT  = ['#dc2626','#1d4ed8','#7c3aed','#d97706','#065f46','#9a3412','#86198f','#0369a1']
const STATUS_STYLE: Record<string,React.CSSProperties> = {
  confirmado: { background:'#dcfce7', color:'#166634' },
  concluido:  { background:'#f3f4f6', color:'#6b7280' },
  pendente:   { background:'#fef3c7', color:'#92400e' },
  cancelado:  { background:'#fee2e2', color:'#dc2626' },
}

function initials(n: string) { return n.split(' ').map(x=>x[0]).join('').toUpperCase().slice(0,2) }
function color(n: string, arr: string[]) { let h=0; for(let c of n) h=c.charCodeAt(0)+h; return arr[h%arr.length] }
function fmt(v: number) { return `R$ ${v.toFixed(2).replace('.',',')}` }
function fmtDate(d: string) {
  if (!d) return ''
  const [y,m,day] = d.split('-')
  return `${day}/${m}/${y}`
}

const inp: React.CSSProperties = { width:'100%', padding:'9px 12px', border:'1.5px solid #e5e7eb', borderRadius:8, fontSize:14, fontFamily:'inherit', outline:'none', boxSizing:'border-box' }
const lbl: React.CSSProperties = { fontSize:12.5, fontWeight:500, color:'#6b7280', display:'block', marginBottom:5 }
const card: React.CSSProperties = { background:'#fff', borderRadius:12, padding:'16px 18px', border:'1px solid rgba(0,0,0,0.08)' }

export default function Home() {
  const [user, setUser]         = useState<any>(null)
  const [profile, setProfile]   = useState<any>(null)
  const [agendamentos, setAg]   = useState<any[]>([])
  const [allAg, setAllAg]       = useState<any[]>([])
  const [services, setServices] = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [nav, setNav]           = useState('Agenda')
  const [modal, setModal]       = useState(false)
  const [saving, setSaving]     = useState(false)
  const [filterDate, setFD]     = useState(() => new Date().toISOString().split('T')[0])
  const [form, setForm]         = useState({ cliente:'', telefone:'', servico:'', data:'', horario:'09:00', preco:'', duracao:'1h', status:'confirmado' })
  const [svcForm, setSvcForm]   = useState({ nome:'', preco:'', duracao:'' })
  const [expandedClient, setExpandedClient] = useState<string|null>(null)
  const [deleteId, setDeleteId]       = useState<string|null>(null)
  const [formError, setFormError]     = useState('')
  const [toast, setToast]             = useState<string|null>(null)
  const [clientSearch, setSearch]     = useState('')
  const [isMobile, setIsMobile]       = useState(false)
  const [anual, setAnual]             = useState(true)
  const [loadingPlano, setLP]         = useState<string|null>(null)
  const [confirmDowngrade, setCD]     = useState(false)
  const [pixKey, setPixKey]           = useState('')
  const [savingPix, setSavingPix]     = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const today = new Date().toLocaleDateString('pt-BR',{ weekday:'long', day:'numeric', month:'long', year:'numeric' })

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { window.location.href='/login'; return }
      setUser(data.user)
      loadAll(data.user)
    })
  }, [])

  async function loadAll(u: any) {
    await loadProfile(u)
    await loadAgendamentos(u.id, new Date().toISOString().split('T')[0])
    await loadAllAg(u.id)
    await loadServices(u.id)
    setLoading(false)
  }

  async function loadProfile(u: any) {
    const { data } = await supabase.from('profiles').select('*').eq('id', u.id).single()
    if (data) { setProfile(data); setPixKey(data.pix_key || ''); return }
    const nome = u.user_metadata?.nome || u.email?.split('@')[0] || 'Profissional'
    await supabase.from('profiles').insert({ id:u.id, nome, email:u.email, plano:'starter' })
    setProfile({ nome, email:u.email, plano:'starter' })
  }

  async function savePixKey() {
    setSavingPix(true)
    await supabase.from('profiles').update({ pix_key: pixKey }).eq('id', user.id)
    setSavingPix(false)
    showToast('Chave Pix salva! ✓')
  }

  async function loadAgendamentos(uid: string, date: string) {
    const { data } = await supabase.from('agendamentos').select('*').eq('profissional_id', uid).eq('data', date).order('horario')
    setAg(data || [])
  }

  async function loadAllAg(uid: string) {
    const { data } = await supabase.from('agendamentos').select('*').eq('profissional_id', uid).order('data', { ascending:false })
    setAllAg(data || [])
  }

  async function loadServices(uid: string) {
    const { data } = await supabase.from('servicos').select('*').eq('profissional_id', uid).order('nome')
    setServices(data || [])
    if (data && data.length > 0) {
      setForm(f => ({ ...f, servico: data[0].nome, preco: data[0].preco || '', duracao: data[0].duracao || '1h' }))
    } else {
      setForm(f => ({ ...f, servico: DEFAULT_SERVICES[0] }))
    }
  }

  async function handleSave() {
    if (!form.cliente || !form.data || !form.horario) {
      setFormError('Preencha nome, data e horário!')
      return
    }
    // Limite Starter: 20 agendamentos por mês
    if (!isPro) {
      const mes = new Date().toISOString().slice(0,7)
      const countMes = allAg.filter(a => a.data?.startsWith(mes)).length
      if (countMes >= 20) {
        setFormError('Limite de 20 agendamentos/mês do plano Starter atingido. Faça upgrade para Pro!')
        return
      }
    }
    setFormError('')
    setSaving(true)
    await supabase.from('agendamentos').insert({
      profissional_id: user.id, cliente_nome: form.cliente, cliente_telefone: form.telefone,
      servico: form.servico, data: form.data, horario: form.horario,
      preco: form.preco, duracao: form.duracao, status: form.status,
    })
    await loadAgendamentos(user.id, filterDate)
    await loadAllAg(user.id)
    setModal(false); setSaving(false)
    setForm({ cliente:'', telefone:'', servico: services.length>0?services[0].nome:DEFAULT_SERVICES[0], data:'', horario:'09:00', preco: services.length>0?services[0].preco||'':'', duracao: services.length>0?services[0].duracao||'1h':'1h', status:'confirmado' })
    showToast('Agendamento criado com sucesso! ✓')
  }

  async function updateStatus(id: string, status: string) {
    await supabase.from('agendamentos').update({ status }).eq('id', id)
    await loadAgendamentos(user.id, filterDate)
    await loadAllAg(user.id)
  }

  async function deleteAg(id: string) {
    await supabase.from('agendamentos').delete().eq('id', id)
    setDeleteId(null)
    await loadAgendamentos(user.id, filterDate)
    await loadAllAg(user.id)
    showToast('Agendamento removido.')
  }

  async function saveSvc() {
    if (!svcForm.nome) { showToast('⚠️ Preencha o nome do serviço!'); return }
    await supabase.from('servicos').insert({ profissional_id:user.id, ...svcForm })
    await loadServices(user.id)
    setSvcForm({ nome:'', preco:'', duracao:'' })
    showToast('Serviço adicionado! ✓')
  }

  async function deleteSvc(id: string) {
    await supabase.from('servicos').delete().eq('id', id)
    await loadServices(user.id)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  async function assinarPlano(plano: string) {
    if (plano === 'starter') {
      setCD(false)
      setLP('starter')
      await supabase.from('profiles').update({ plano: 'starter', plano_expira: null }).eq('id', user.id)
      await loadProfile(user)
      setLP(null)
      showToast('Plano alterado para Starter.')
      return
    }
    setLP(plano)
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plano, email: user.email, userId: user.id }),
      })
      const data = await res.json()
      if (data.init_point) window.location.href = data.init_point
      else { showToast('Erro ao iniciar pagamento. Tente novamente.'); setLP(null) }
    } catch {
      showToast('Erro de conexão. Tente novamente.')
      setLP(null)
    }
  }

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  function changeDate(d: string) {
    setFD(d)
    loadAgendamentos(user.id, d)
  }

  function prevDay() {
    const dt = new Date(filterDate + 'T12:00:00')
    dt.setDate(dt.getDate() - 1)
    changeDate(dt.toISOString().split('T')[0])
  }

  function nextDay() {
    const dt = new Date(filterDate + 'T12:00:00')
    dt.setDate(dt.getDate() + 1)
    changeDate(dt.toISOString().split('T')[0])
  }

  function goToday() {
    changeDate(new Date().toISOString().split('T')[0])
  }

  function onServiceChange(nome: string) {
    const svc = services.find(s => s.nome === nome)
    setForm(f => ({ ...f, servico: nome, preco: svc?.preco || f.preco, duracao: svc?.duracao || f.duracao }))
  }

  const receita      = agendamentos.filter(a=>a.status!=='cancelado').reduce((s,a)=>s+(parseFloat(a.preco?.replace('R$','').replace(',','.').trim())||0),0)
  const receitaTotal = allAg.filter(a=>a.status!=='cancelado').reduce((s,a)=>s+(parseFloat(a.preco?.replace('R$','').replace(',','.').trim())||0),0)
  // Deduplica clientes por nome, ordenados pelo agendamento mais recente
  const clienteMap = new Map<string, any>()
  for (const a of allAg) {
    if (!clienteMap.has(a.cliente_nome) || a.data > clienteMap.get(a.cliente_nome).data) {
      clienteMap.set(a.cliente_nome, a)
    }
  }
  const clientes = [...clienteMap.values()].sort((a,b) => (b.data > a.data ? 1 : -1))
  const clientesFiltrados = clientSearch.trim()
    ? clientes.filter(c => c.cliente_nome?.toLowerCase().includes(clientSearch.toLowerCase()))
    : clientes
  const nome         = profile?.nome || user?.email?.split('@')[0] || 'Profissional'
  const svcOptions   = services.length > 0 ? services.map(s => s.nome) : DEFAULT_SERVICES
  const planoAtual   = profile?.plano || 'starter'
  const isPro        = planoAtual !== 'starter'
  const isAdmin      = user?.email === 'mateusonepiece98@gmail.com'

  const meses: Record<string,number> = {}
  allAg.filter(a=>a.status!=='cancelado').forEach(a => {
    const m = a.data?.slice(0,7)
    if (m) meses[m] = (meses[m]||0) + (parseFloat(a.preco?.replace('R$','').replace(',','.').trim())||0)
  })
  const mesesArr = Object.entries(meses).sort().slice(-6)
  const maxVal   = Math.max(...mesesArr.map(m=>m[1]), 1)

  // ── Dados Pro: receita por serviço ──
  const receitaPorSvc: Record<string,number> = {}
  allAg.filter(a=>a.status!=='cancelado').forEach(a => {
    const s = a.servico || 'Outros'
    receitaPorSvc[s] = (receitaPorSvc[s]||0) + (parseFloat(a.preco?.replace('R$','').replace(',','.').trim())||0)
  })
  const topServicos = Object.entries(receitaPorSvc).sort((a,b)=>b[1]-a[1]).slice(0,6)
  const maxSvc = Math.max(...topServicos.map(s=>s[1]), 1)

  // ── Dados Pro: top clientes ──
  const receitaPorCliente: Record<string,number> = {}
  allAg.filter(a=>a.status!=='cancelado').forEach(a => {
    const n = a.cliente_nome || 'Desconhecido'
    receitaPorCliente[n] = (receitaPorCliente[n]||0) + (parseFloat(a.preco?.replace('R$','').replace(',','.').trim())||0)
  })
  const topClientes = Object.entries(receitaPorCliente).sort((a,b)=>b[1]-a[1]).slice(0,5)

  // ── Dados Pro: comparativo mês atual vs anterior ──
  const now = new Date()
  const mesAtualStr   = now.toISOString().slice(0,7)
  const mesAnteriorStr = new Date(now.getFullYear(), now.getMonth()-1, 1).toISOString().slice(0,7)
  const recMesAtual   = allAg.filter(a=>a.status!=='cancelado'&&a.data?.startsWith(mesAtualStr)).reduce((s,a)=>s+(parseFloat(a.preco?.replace('R$','').replace(',','.').trim())||0),0)
  const recMesAnt     = allAg.filter(a=>a.status!=='cancelado'&&a.data?.startsWith(mesAnteriorStr)).reduce((s,a)=>s+(parseFloat(a.preco?.replace('R$','').replace(',','.').trim())||0),0)
  const variacaoMes   = recMesAnt > 0 ? ((recMesAtual - recMesAnt) / recMesAnt) * 100 : 0
  const agMesAtual    = allAg.filter(a=>a.data?.startsWith(mesAtualStr)).length
  const taxaCancelamento = allAg.length > 0 ? (allAg.filter(a=>a.status==='cancelado').length / allAg.length) * 100 : 0

  if (loading) return (
    <div style={{ display:'flex', height:'100vh', alignItems:'center', justifyContent:'center', fontFamily:'system-ui', background:'#f2f1ec' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ fontSize:32, fontWeight:700, color:'#0d1f17' }}>agen<span style={{ color:'#34d399' }}>dei</span></div>
        <div style={{ color:'#6b7280', marginTop:8, fontSize:14 }}>Carregando...</div>
      </div>
    </div>
  )

  const NAV_ITEMS: [string, string, string][] = [
    ['📅','Agenda','Agenda'],
    ['👥','Clientes','Clientes'],
    ['✂️','Serviços','Serviços'],
    ['💰','Financeiro','Financeiro'],
    ['⚙️','Config','Configurações'],
    ...(isAdmin ? [['🛠️','Admin','Admin'] as [string,string,string]] : []),
  ]

  const Sidebar = !isMobile ? (
    <div style={{ width:228, background:'#0d1f17', display:'flex', flexDirection:'column', padding:'24px 14px', flexShrink:0 }}>
      <div style={{ display:'flex', alignItems:'center', gap:9, padding:'0 8px', marginBottom:32 }}>
        <div style={{ width:30, height:30, background:'#34d399', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:16, color:'#0d1f17' }}>A</div>
        <span style={{ fontSize:19, fontWeight:600, color:'#fff', letterSpacing:-0.5 }}>agen<span style={{ color:'#34d399' }}>dei</span></span>
      </div>
      <nav style={{ flex:1, display:'flex', flexDirection:'column', gap:2 }}>
        {NAV_ITEMS.map(([ic,lb,val])=>(
          <div key={val} onClick={()=>setNav(val)} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 12px', borderRadius:8, cursor:'pointer', fontSize:13.5, background:nav===val?'rgba(52,211,153,0.14)':'transparent', color:nav===val?'#34d399':'rgba(255,255,255,0.65)', fontWeight:nav===val?600:400, transition:'color 0.15s' }}>
            <span style={{ width:18, textAlign:'center' }}>{ic}</span>{val}
          </div>
        ))}
      </nav>
      <div style={{ borderTop:'1px solid rgba(255,255,255,0.1)', paddingTop:14 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, paddingLeft:4, marginBottom:10 }}>
          <div style={{ width:33, height:33, borderRadius:'50%', background:'linear-gradient(135deg,#059669,#34d399)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, color:'#fff', flexShrink:0 }}>{initials(nome)}</div>
          <div>
            <div style={{ fontSize:13, fontWeight:600, color:'rgba(255,255,255,0.9)', maxWidth:120, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{nome}</div>
            <div style={{ fontSize:11, color: isPro ? '#34d399' : 'rgba(255,255,255,0.45)' }}>{isPro ? '⭐ Plano Pro' : 'Plano Starter'}</div>
          </div>
        </div>
        <button onClick={handleLogout} style={{ width:'100%', padding:'7px', borderRadius:8, border:'1px solid rgba(255,255,255,0.12)', background:'transparent', color:'rgba(255,255,255,0.55)', fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>Sair</button>
      </div>
    </div>
  ) : null

  const BottomNav = isMobile ? (
    <div style={{ position:'fixed', bottom:0, left:0, right:0, background:'#0d1f17', display:'flex', borderTop:'1px solid rgba(255,255,255,0.1)', zIndex:40, paddingBottom:'env(safe-area-inset-bottom,0px)' }}>
      {NAV_ITEMS.map(([ic,lb,val])=>{
        const active = nav === val
        return (
          <div key={val} onClick={()=>setNav(val)}
            style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'9px 0 10px', cursor:'pointer', gap:3,
              color: active ? '#34d399' : 'rgba(255,255,255,0.5)' }}>
            <span style={{ fontSize:20 }}>{ic}</span>
            <span style={{ fontSize:10, fontWeight: active ? 600 : 400 }}>{lb}</span>
          </div>
        )
      })}
    </div>
  ) : null

  const AgendaView = (
    <div style={{ flex:1, overflowY:'auto', padding: isMobile ? '20px 16px 84px' : '28px 32px', display:'flex', flexDirection:'column', gap:18 }}>
      <div style={{ display:'flex', alignItems: isMobile ? 'center' : 'flex-start', justifyContent:'space-between', gap:8 }}>
        <div>
          <h1 style={{ fontSize: isMobile ? 18 : 22, fontWeight:700, letterSpacing:-0.5, margin:0, color:'#0d1f17' }}>Olá, {nome.split(' ')[0]}! ☀️</h1>
          <p style={{ fontSize:12.5, color:'#4b5563', marginTop:2, textTransform:'capitalize' }}>{today}</p>
        </div>
        <button onClick={()=>setModal(true)} style={{ background:'#0d1f17', color:'#fff', border:'none', padding: isMobile ? '8px 12px' : '9px 16px', borderRadius:9, fontSize: isMobile ? 12 : 13, fontWeight:600, cursor:'pointer', flexShrink:0 }}>
          {isMobile ? '＋ Agendar' : '＋ Novo agendamento'}
        </button>
      </div>
      <div style={{ display:'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap:10 }}>
        {[
          { label:'Hoje', value:agendamentos.length.toString(), sub:'agendamentos' },
          { label:'Receita do dia', value:fmt(receita), sub:'previsto' },
          { label:'Confirmados', value:agendamentos.filter(a=>a.status==='confirmado').length.toString(), sub:'agendamentos' },
          { label:'Concluídos', value:agendamentos.filter(a=>a.status==='concluido').length.toString(), sub:'hoje' },
        ].map(s=>(
          <div key={s.label} style={card}>
            <div style={{ fontSize:10.5, color:'#4b5563', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:5 }}>{s.label}</div>
            <div style={{ fontSize: isMobile ? 20 : 22, fontWeight:700, letterSpacing:-0.5, color:'#0d1f17' }}>{s.value}</div>
            <div style={{ fontSize:11, color:'#6b7280', marginTop:3 }}>{s.sub}</div>
          </div>
        ))}
      </div>
      <div>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12, flexWrap:'wrap', gap:8 }}>
          <span style={{ fontSize:15, fontWeight:700, color:'#0d1f17' }}>Agenda do dia</span>
          <div style={{ display:'flex', alignItems:'center', gap:5 }}>
            {filterDate !== new Date().toISOString().split('T')[0] && (
              <button onClick={goToday} style={{ padding:'5px 9px', border:'1.5px solid #e5e7eb', borderRadius:7, fontSize:11.5, fontWeight:600, fontFamily:'inherit', background:'#f0fdf4', color:'#059669', cursor:'pointer' }}>Hoje</button>
            )}
            <button onClick={prevDay} style={{ width:30, height:30, border:'1.5px solid #e5e7eb', borderRadius:8, background:'#fff', cursor:'pointer', fontSize:15, display:'flex', alignItems:'center', justifyContent:'center', color:'#374151' }}>‹</button>
            <input type="date" value={filterDate} onChange={e=>changeDate(e.target.value)}
              style={{ padding:'5px 8px', border:'1.5px solid #e5e7eb', borderRadius:8, fontSize:12.5, fontFamily:'inherit', outline:'none', color:'#111827' }} />
            <button onClick={nextDay} style={{ width:30, height:30, border:'1.5px solid #e5e7eb', borderRadius:8, background:'#fff', cursor:'pointer', fontSize:15, display:'flex', alignItems:'center', justifyContent:'center', color:'#374151' }}>›</button>
          </div>
        </div>
        {agendamentos.length === 0 ? (
          <div style={{ ...card, padding:'40px 24px', textAlign:'center' }}>
            <div style={{ fontSize:36, marginBottom:10 }}>📅</div>
            <div style={{ fontSize:15, fontWeight:600, color:'#111827' }}>Nenhum agendamento nesta data</div>
            <div style={{ fontSize:13, color:'#4b5563', marginTop:4 }}>Toque em "+ Agendar" para adicionar</div>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {agendamentos.map(ap=>(
              <div key={ap.id} style={{ ...card, display:'flex', alignItems:'center', gap: isMobile ? 10 : 14 }}>
                <div style={{ fontSize:12, fontWeight:700, color:'#374151', minWidth:40 }}>{ap.horario?.slice(0,5)}</div>
                <div style={{ width:3, height:40, borderRadius:99, background:color(ap.cliente_nome, BAR), flexShrink:0 }} />
                <div style={{ width:36, height:36, borderRadius:'50%', background:color(ap.cliente_nome, BG), color:color(ap.cliente_nome, TXT), display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, flexShrink:0 }}>{initials(ap.cliente_nome)}</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13.5, fontWeight:600, color:'#111827', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{ap.cliente_nome}</div>
                  <div style={{ fontSize:12, color:'#4b5563', marginTop:1 }}>{ap.servico}</div>
                  {ap.duracao && <div style={{ fontSize:11, color:'#6b7280', marginTop:1 }}>⏱ {ap.duracao}</div>}
                  {ap.cliente_telefone && (
                    <a href={`https://wa.me/55${ap.cliente_telefone.replace(/\D/g,'')}?text=${encodeURIComponent(`Olá ${ap.cliente_nome}! Lembrando seu agendamento:\n\n✂️ *${ap.servico}*\n📅 ${fmtDate(ap.data)}\n🕐 ${ap.horario?.slice(0,5)}\n\nQualquer dúvida é só chamar! 😊`)}`}
                      target="_blank" rel="noreferrer"
                      style={{ display:'inline-flex', alignItems:'center', gap:4, marginTop:4, fontSize:11, fontWeight:600, color:'#059669', textDecoration:'none', background:'#f0fdf4', padding:'2px 8px', borderRadius:99 }}>
                      📲 Enviar lembrete
                    </a>
                  )}
                </div>
                <div style={{ textAlign:'right', display:'flex', flexDirection:'column', alignItems:'flex-end', gap:4, flexShrink:0 }}>
                  {ap.preco && <div style={{ fontSize:14, fontWeight:700, color:'#0d1f17' }}>{ap.preco}</div>}
                  <select value={ap.status} onChange={e=>updateStatus(ap.id, e.target.value)}
                    style={{ ...(STATUS_STYLE[ap.status]||STATUS_STYLE.confirmado), fontSize:10.5, padding:'3px 6px', borderRadius:99, fontWeight:600, border:'none', cursor:'pointer', fontFamily:'inherit' }}>
                    <option value="confirmado">Confirmado</option>
                    <option value="concluido">Concluído</option>
                    <option value="pendente">Aguardando</option>
                    <option value="cancelado">Cancelado</option>
                  </select>
                  {deleteId === ap.id ? (
                    <div style={{ display:'flex', gap:5 }}>
                      <button onClick={()=>deleteAg(ap.id)} style={{ fontSize:11, color:'#fff', background:'#dc2626', border:'none', cursor:'pointer', padding:'3px 8px', borderRadius:6 }}>Confirmar</button>
                      <button onClick={()=>setDeleteId(null)} style={{ fontSize:11, color:'#6b7280', background:'#f3f4f6', border:'none', cursor:'pointer', padding:'3px 8px', borderRadius:6 }}>Cancelar</button>
                    </div>
                  ) : (
                    <button onClick={()=>setDeleteId(ap.id)} style={{ fontSize:11, color:'#dc2626', background:'none', border:'none', cursor:'pointer', padding:0 }}>remover</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )

  const ClientesView = (
    <div style={{ flex:1, overflowY:'auto', padding: isMobile ? '20px 16px 84px' : '28px 32px', display:'flex', flexDirection:'column', gap:18 }}>
      <div style={{ display:'flex', alignItems: isMobile ? 'center' : 'flex-start', justifyContent:'space-between', gap:8, flexWrap:'wrap' }}>
        <div>
          <h1 style={{ fontSize: isMobile ? 18 : 22, fontWeight:700, letterSpacing:-0.5, margin:0, color:'#0d1f17' }}>Clientes</h1>
          <p style={{ fontSize:12.5, color:'#4b5563', marginTop:2 }}>{clientes.length} clientes na base</p>
        </div>
        <input
          type="text"
          placeholder="🔍 Buscar..."
          value={clientSearch}
          onChange={e=>setSearch(e.target.value)}
          style={{ padding:'8px 12px', border:'1.5px solid #e5e7eb', borderRadius:9, fontSize:13, fontFamily:'inherit', outline:'none', width: isMobile ? '100%' : 200 }}
        />
      </div>
      <div style={{ display:'grid', gridTemplateColumns: isMobile ? 'repeat(1,1fr)' : 'repeat(3,1fr)', gap:10 }}>
        {[
          { label:'Total de clientes', value:clientes.length.toString(), sub:'cadastrados' },
          { label:'Atendimentos', value:allAg.length.toString(), sub:'histórico total' },
          { label:'Receita total', value:fmt(receitaTotal), sub:'desde o início' },
        ].map(s=>(
          <div key={s.label} style={{ ...card, display: isMobile ? 'flex' : 'block', alignItems:'center', justifyContent:'space-between', gap:10 }}>
            <div style={{ fontSize:10.5, color:'#4b5563', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom: isMobile ? 0 : 5 }}>{s.label}</div>
            <div>
              <div style={{ fontSize:20, fontWeight:700, letterSpacing:-0.5, color:'#0d1f17' }}>{s.value}</div>
              <div style={{ fontSize:11, color:'#6b7280', marginTop:2 }}>{s.sub}</div>
            </div>
          </div>
        ))}
      </div>
      {clientes.length === 0 ? (
        <div style={{ ...card, padding:'40px', textAlign:'center' }}>
          <div style={{ fontSize:32, marginBottom:10 }}>👥</div>
          <div style={{ fontSize:15, fontWeight:500 }}>Nenhum cliente ainda</div>
          <div style={{ fontSize:13, color:'#6b7280', marginTop:4 }}>Crie agendamentos para ver seus clientes aqui</div>
        </div>
      ) : clientesFiltrados.length === 0 ? (
        <div style={{ ...card, padding:'32px', textAlign:'center' }}>
          <div style={{ fontSize:24, marginBottom:8 }}>🔍</div>
          <div style={{ fontSize:14, fontWeight:500 }}>Nenhum cliente encontrado para "{clientSearch}"</div>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {clientesFiltrados.map(c => {
            const ags = allAg.filter(a=>a.cliente_nome===c.cliente_nome).sort((a,b)=>a.data>b.data?1:-1)
            const total = ags.filter(a=>a.status!=='cancelado').reduce((s,a)=>s+(parseFloat(a.preco?.replace('R$','').replace(',','.').trim())||0),0)
            const isExpanded = expandedClient === c.cliente_nome
            return (
              <div key={c.cliente_nome} style={{ ...card, padding:0, overflow:'hidden' }}>
                <div onClick={()=>setExpandedClient(isExpanded?null:c.cliente_nome)}
                  style={{ display:'flex', alignItems:'center', gap:14, padding:'14px 18px', cursor:'pointer' }}>
                  <div style={{ width:40, height:40, borderRadius:'50%', background:color(c.cliente_nome, BG), color:color(c.cliente_nome, TXT), display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:700, flexShrink:0 }}>{initials(c.cliente_nome)}</div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:14, fontWeight:600 }}>{c.cliente_nome}</div>
                    {c.cliente_telefone && <div style={{ fontSize:12, color:'#6b7280', marginTop:1 }}>📱 {c.cliente_telefone}</div>}
                    <div style={{ fontSize:12, color:'#6b7280', marginTop:1 }}>{ags.length} agendamento{ags.length!==1?'s':''}</div>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontSize:14, fontWeight:700 }}>{fmt(total)}</div>
                    <div style={{ fontSize:11, color:'#6b7280', marginTop:2 }}>gasto total</div>
                  </div>
                  <span style={{ fontSize:12, color:'#9ca3af', marginLeft:8 }}>{isExpanded?'▲':'▼'}</span>
                </div>
                {isExpanded && (
                  <div style={{ borderTop:'1px solid #f3f4f6', padding:'12px 18px', background:'#fafafa' }}>
                    <div style={{ fontSize:12, fontWeight:600, color:'#6b7280', marginBottom:10, textTransform:'uppercase', letterSpacing:'0.04em' }}>Histórico</div>
                    {ags.map(a=>(
                      <div key={a.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid #f3f4f6' }}>
                        <div>
                          <div style={{ fontSize:13, fontWeight:500 }}>{a.servico}</div>
                          <div style={{ fontSize:12, color:'#6b7280', marginTop:2 }}>📅 {fmtDate(a.data)} às {a.horario?.slice(0,5)}</div>
                        </div>
                        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                          {a.preco && <div style={{ fontSize:13, fontWeight:700 }}>{a.preco}</div>}
                          <select value={a.status} onChange={e=>{ e.stopPropagation(); updateStatus(a.id, e.target.value) }}
                            style={{ ...(STATUS_STYLE[a.status]||STATUS_STYLE.confirmado), fontSize:10.5, padding:'3px 6px', borderRadius:99, fontWeight:600, border:'none', cursor:'pointer', fontFamily:'inherit' }}>
                            <option value="confirmado">Confirmado</option>
                            <option value="concluido">Concluído</option>
                            <option value="pendente">Aguardando</option>
                            <option value="cancelado">Cancelado</option>
                          </select>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )

  const ServicosView = (
    <div style={{ flex:1, overflowY:'auto', padding: isMobile ? '20px 16px 84px' : '28px 32px', display:'flex', flexDirection:'column', gap:18 }}>
      <div>
        <h1 style={{ fontSize: isMobile ? 18 : 22, fontWeight:700, letterSpacing:-0.5, margin:0, color:'#0d1f17' }}>Serviços</h1>
        <p style={{ fontSize:12.5, color:'#4b5563', marginTop:2 }}>Estes serviços aparecem para os clientes ao agendar</p>
      </div>
      <div style={card}>
        <div style={{ fontSize:14, fontWeight:700, color:'#111827', marginBottom:14 }}>Adicionar serviço</div>
        <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : '2fr 1fr 1fr', gap:10, marginBottom:12 }}>
          <div><label style={lbl}>Nome</label><input style={inp} placeholder="Ex: Manicure" value={svcForm.nome} onChange={e=>setSvcForm({...svcForm, nome:e.target.value})} /></div>
          <div><label style={lbl}>Preço</label><input style={inp} placeholder="R$ 60" value={svcForm.preco} onChange={e=>setSvcForm({...svcForm, preco:e.target.value})} /></div>
          <div><label style={lbl}>Duração</label><input style={inp} placeholder="45 min" value={svcForm.duracao} onChange={e=>setSvcForm({...svcForm, duracao:e.target.value})} /></div>
        </div>
        <button onClick={saveSvc} style={{ background:'#0d1f17', color:'#fff', border:'none', padding:'9px 18px', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>＋ Adicionar</button>
      </div>
      {services.length === 0 ? (
        <div style={{ ...card, padding:'40px', textAlign:'center' }}>
          <div style={{ fontSize:32, marginBottom:10 }}>✂️</div>
          <div style={{ fontSize:15, fontWeight:500 }}>Nenhum serviço cadastrado</div>
          <div style={{ fontSize:13, color:'#6b7280', marginTop:4 }}>Adicione seus serviços acima</div>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {services.map((s:any)=>(
            <div key={s.id} style={{ ...card, display:'flex', alignItems:'center', gap:14 }}>
              <div style={{ width:36, height:36, borderRadius:10, background:'#f0fdf4', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>✂️</div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:14, fontWeight:600 }}>{s.nome}</div>
                {s.duracao && <div style={{ fontSize:12, color:'#6b7280', marginTop:1 }}>⏱ {s.duracao}</div>}
              </div>
              <div style={{ fontSize:16, fontWeight:700, color:'#0d1f17' }}>{s.preco}</div>
              <button onClick={()=>deleteSvc(s.id)} style={{ fontSize:11, color:'#dc2626', background:'none', border:'none', cursor:'pointer', padding:'4px 8px' }}>remover</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  const FinanceiroView = (
    <div style={{ flex:1, overflowY:'auto', padding: isMobile ? '20px 16px 84px' : '28px 32px', display:'flex', flexDirection:'column', gap:18 }}>
      <div>
        <h1 style={{ fontSize: isMobile ? 18 : 22, fontWeight:700, letterSpacing:-0.5, margin:0, color:'#0d1f17' }}>Financeiro</h1>
        <p style={{ fontSize:12.5, color:'#4b5563', marginTop:2 }}>Visão geral das suas receitas</p>
      </div>
      <div style={{ display:'grid', gridTemplateColumns: isMobile ? 'repeat(1,1fr)' : 'repeat(3,1fr)', gap:10 }}>
        {[
          { label:'Receita total', value:fmt(receitaTotal), sub:'todos os períodos' },
          { label:'Concluídos', value:allAg.filter(a=>a.status==='concluido').length.toString(), sub:'atendimentos' },
          { label:'Ticket médio', value: allAg.filter(a=>a.status==='concluido').length ? fmt(receitaTotal/allAg.filter(a=>a.status==='concluido').length) : 'R$ 0,00', sub:'por atendimento' },
        ].map(s=>(
          <div key={s.label} style={{ ...card, display: isMobile ? 'flex' : 'block', alignItems:'center', justifyContent:'space-between' }}>
            <div style={{ fontSize:10.5, color:'#4b5563', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom: isMobile ? 0 : 5 }}>{s.label}</div>
            <div>
              <div style={{ fontSize:20, fontWeight:700, letterSpacing:-0.5, color:'#0d1f17' }}>{s.value}</div>
              <div style={{ fontSize:11, color:'#6b7280', marginTop:2 }}>{s.sub}</div>
            </div>
          </div>
        ))}
      </div>
      <div style={card}>
        <div style={{ fontSize:14, fontWeight:700, color:'#111827', marginBottom:16 }}>Receita por mês</div>
        {mesesArr.length === 0 ? (
          <div style={{ textAlign:'center', padding:'20px', color:'#9ca3af', fontSize:13 }}>Sem dados ainda</div>
        ) : (
          <div style={{ display:'flex', alignItems:'flex-end', gap:12, height:140 }}>
            {mesesArr.map(([m,v])=>(
              <div key={m} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:6 }}>
                <div style={{ fontSize:11, fontWeight:600, color:'#0d1f17' }}>{fmt(v).replace('R$ ','R$')}</div>
                <div style={{ width:'100%', background:'#0d1f17', borderRadius:'4px 4px 0 0', height:`${Math.max((v/maxVal)*100,4)}%`, minHeight:4 }} />
                <div style={{ fontSize:10, color:'#9ca3af' }}>{m.slice(5)}/{m.slice(2,4)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
      {/* ── RELATÓRIOS PRO ── */}
      {isPro ? (
        <>
          {/* Comparativo mensal */}
          <div style={card}>
            <div style={{ fontSize:14, fontWeight:700, color:'#111827', marginBottom:14 }}>Este mês vs mês anterior</div>
            <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(4,1fr)', gap:12 }}>
              {[
                { label:'Receita este mês', value:fmt(recMesAtual), delta: variacaoMes !== 0, pct: variacaoMes, up: variacaoMes >= 0 },
                { label:'Receita mês anterior', value:fmt(recMesAnt), delta:false, pct:0, up:false },
                { label:'Agendamentos este mês', value:agMesAtual.toString(), delta:false, pct:0, up:false },
                { label:'Taxa de cancelamento', value:`${taxaCancelamento.toFixed(1)}%`, delta:false, pct:0, up:false },
              ].map((s,i)=>(
                <div key={i} style={{ background:'#f9fafb', borderRadius:10, padding:'12px 14px' }}>
                  <div style={{ fontSize:10.5, color:'#4b5563', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:4 }}>{s.label}</div>
                  <div style={{ fontSize:20, fontWeight:700, color:'#0d1f17' }}>{s.value}</div>
                  {s.delta && (
                    <div style={{ fontSize:11.5, fontWeight:600, color: s.up ? '#059669' : '#dc2626', marginTop:3 }}>
                      {s.up ? '▲' : '▼'} {Math.abs(s.pct).toFixed(1)}% vs mês anterior
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Receita por serviço */}
          {topServicos.length > 0 && (
            <div style={card}>
              <div style={{ fontSize:14, fontWeight:700, color:'#111827', marginBottom:14 }}>Receita por serviço</div>
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {topServicos.map(([svc,val])=>(
                  <div key={svc}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                      <span style={{ fontSize:13, fontWeight:500, color:'#111827' }}>{svc}</span>
                      <span style={{ fontSize:13, fontWeight:700, color:'#0d1f17' }}>{fmt(val)}</span>
                    </div>
                    <div style={{ height:6, borderRadius:99, background:'#f3f4f6', overflow:'hidden' }}>
                      <div style={{ height:'100%', borderRadius:99, background:'#34d399', width:`${(val/maxSvc)*100}%`, transition:'width 0.3s' }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top clientes */}
          {topClientes.length > 0 && (
            <div style={card}>
              <div style={{ fontSize:14, fontWeight:700, color:'#111827', marginBottom:14 }}>Top clientes por receita</div>
              <div style={{ display:'flex', flexDirection:'column', gap:0 }}>
                {topClientes.map(([nome,val],i)=>(
                  <div key={nome} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 0', borderBottom: i < topClientes.length-1 ? '1px solid #f3f4f6' : 'none' }}>
                    <div style={{ width:26, height:26, borderRadius:'50%', background:'#0d1f17', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, flexShrink:0 }}>{i+1}</div>
                    <div style={{ width:34, height:34, borderRadius:'50%', background:color(nome, BG), color:color(nome, TXT), display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, flexShrink:0 }}>{initials(nome)}</div>
                    <div style={{ flex:1, fontSize:13.5, fontWeight:600, color:'#111827' }}>{nome}</div>
                    <div style={{ fontSize:14, fontWeight:700, color:'#0d1f17' }}>{fmt(val)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div style={{ ...card, textAlign:'center', padding:'28px 24px', border:'1.5px dashed #e5e7eb' }}>
          <div style={{ fontSize:28, marginBottom:8 }}>📊</div>
          <div style={{ fontSize:15, fontWeight:700, color:'#111827', marginBottom:4 }}>Relatórios avançados</div>
          <div style={{ fontSize:13, color:'#4b5563', marginBottom:16, lineHeight:1.6 }}>
            Veja receita por serviço, top clientes, comparativo mensal e taxa de cancelamento.
          </div>
          <button onClick={()=>setNav('Configurações')} style={{ padding:'10px 22px', border:'none', borderRadius:9, fontSize:13.5, fontWeight:700, background:'#0d1f17', color:'#fff', cursor:'pointer', fontFamily:'inherit' }}>
            ⭐ Fazer upgrade para Pro
          </button>
        </div>
      )}

      <div style={card}>
        <div style={{ fontSize:14, fontWeight:700, color:'#111827', marginBottom:14 }}>Últimos atendimentos</div>
        {allAg.slice(0,10).map(a=>(
          <div key={a.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 0', borderBottom:'1px solid #f3f4f6' }}>
            <div>
              <div style={{ fontSize:13.5, fontWeight:600, color:'#111827' }}>{a.cliente_nome}</div>
              <div style={{ fontSize:12, color:'#4b5563' }}>{a.servico} · {fmtDate(a.data)}</div>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <span style={{ fontSize:14, fontWeight:700 }}>{a.preco||'—'}</span>
              <span style={{ ...(STATUS_STYLE[a.status]||STATUS_STYLE.confirmado), fontSize:10.5, padding:'2px 8px', borderRadius:99, fontWeight:600 }}>{a.status}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )

  const ConfigView = (
    <div style={{ flex:1, overflowY:'auto', padding: isMobile ? '20px 16px 84px' : '28px 32px', display:'flex', flexDirection:'column', gap:18 }}>
      <div>
        <h1 style={{ fontSize: isMobile ? 18 : 22, fontWeight:700, letterSpacing:-0.5, margin:0, color:'#0d1f17' }}>Configurações</h1>
        <p style={{ fontSize:12.5, color:'#4b5563', marginTop:2 }}>Gerencie seu perfil e plano</p>
      </div>

      {/* Perfil */}
      <div style={card}>
        <div style={{ fontSize:14, fontWeight:600, marginBottom:16 }}>Seu perfil</div>
        <div style={{ display:'flex', alignItems:'center', gap:16, marginBottom:20 }}>
          <div style={{ width:56, height:56, borderRadius:'50%', background:'linear-gradient(135deg,#059669,#34d399)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, fontWeight:700, color:'#fff' }}>{initials(nome)}</div>
          <div>
            <div style={{ fontSize:16, fontWeight:600 }}>{nome}</div>
            <div style={{ fontSize:13, color:'#6b7280' }}>{profile?.email || user?.email}</div>
          </div>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, padding:'16px 0', borderTop:'1px solid #f3f4f6' }}>
          {[
            { label:'Total de agendamentos', value:allAg.length },
            { label:'Clientes únicos', value:clientes.length },
            { label:'Serviços cadastrados', value:services.length },
            { label:'Receita total', value:fmt(receitaTotal) },
          ].map(s=>(
            <div key={s.label}>
              <div style={{ fontSize:12, color:'#6b7280' }}>{s.label}</div>
              <div style={{ fontSize:18, fontWeight:700, marginTop:2 }}>{s.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Gerenciamento de plano */}
      <div style={card}>
        <div style={{ fontSize:14, fontWeight:700, color:'#111827', marginBottom:4 }}>Plano atual</div>
        <div style={{ fontSize:13, color:'#4b5563', marginBottom:18 }}>
          Você está no <strong>{isPro ? 'Plano Pro' : 'Plano Starter'}</strong>
          {isPro && profile?.plano_expira ? ` — válido até ${fmtDate(profile.plano_expira)}` : ''}
        </div>

        {/* Toggle mensal/anual */}
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:20 }}>
          <span style={{ fontSize:13, color: anual?'#9ca3af':'#111827', fontWeight: anual?400:600 }}>Mensal</span>
          <div onClick={()=>setAnual(!anual)}
            style={{ width:44, height:24, borderRadius:99, background: anual?'#0d1f17':'#e5e7eb', cursor:'pointer', position:'relative', transition:'background .2s', flexShrink:0 }}>
            <div style={{ position:'absolute', width:18, height:18, borderRadius:'50%', background:'#fff', top:3, left: anual?23:3, transition:'left .2s', boxShadow:'0 1px 3px rgba(0,0,0,.2)' }} />
          </div>
          <span style={{ fontSize:13, color: anual?'#111827':'#9ca3af', fontWeight: anual?600:400 }}>
            Anual <span style={{ fontSize:10.5, background:'#dcfce7', color:'#166534', padding:'2px 7px', borderRadius:99, fontWeight:600, marginLeft:3 }}>−25%</span>
          </span>
        </div>

        {/* Cards dos planos */}
        <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap:12 }}>

          {/* Starter */}
          <div style={{ borderRadius:14, border: !isPro ? '2px solid #0d1f17' : '1.5px solid #e5e7eb', padding:'18px 16px', position:'relative', background: !isPro ? '#f9fafb' : '#fff' }}>
            {!isPro && <div style={{ position:'absolute', top:-1, left:16, background:'#0d1f17', color:'#fff', fontSize:10, fontWeight:700, padding:'2px 10px', borderRadius:'0 0 8px 8px' }}>PLANO ATUAL</div>}
            <div style={{ fontSize:12, fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:8, marginTop: !isPro ? 8 : 0 }}>Starter</div>
            <div style={{ fontSize:28, fontWeight:700, color:'#111827', marginBottom:2 }}>Grátis</div>
            <div style={{ fontSize:12, color:'#9ca3af', marginBottom:14 }}>para sempre</div>
            <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:16 }}>
              {[
                { ok:true,  txt:'Até 20 agendamentos/mês' },
                { ok:true,  txt:'Página de agendamento' },
                { ok:true,  txt:'Histórico de clientes' },
                { ok:false, txt:'WhatsApp automático' },
                { ok:false, txt:'Relatórios avançados' },
              ].map((f,i)=>(
                <div key={i} style={{ fontSize:12.5, color: f.ok?'#374151':'#9ca3af', display:'flex', gap:6 }}>
                  <span>{f.ok?'✓':'✕'}</span>{f.txt}
                </div>
              ))}
            </div>
            {isPro ? (
              confirmDowngrade ? (
                <div>
                  <div style={{ fontSize:12, color:'#dc2626', marginBottom:8, fontWeight:500 }}>⚠️ Você perderá os recursos Pro. Confirmar?</div>
                  <div style={{ display:'flex', gap:8 }}>
                    <button onClick={()=>assinarPlano('starter')} disabled={!!loadingPlano}
                      style={{ flex:1, padding:'8px', border:'none', borderRadius:8, fontSize:12.5, fontWeight:600, background:'#dc2626', color:'#fff', cursor:'pointer', fontFamily:'inherit', opacity:loadingPlano?0.6:1 }}>
                      {loadingPlano==='starter'?'Alterando...':'Confirmar downgrade'}
                    </button>
                    <button onClick={()=>setCD(false)}
                      style={{ flex:1, padding:'8px', border:'1.5px solid #e5e7eb', borderRadius:8, fontSize:12.5, fontWeight:500, background:'#fff', cursor:'pointer', fontFamily:'inherit', color:'#6b7280' }}>
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <button onClick={()=>setCD(true)}
                  style={{ width:'100%', padding:'9px', border:'1.5px solid #e5e7eb', borderRadius:9, fontSize:13, fontWeight:500, background:'#fff', cursor:'pointer', fontFamily:'inherit', color:'#6b7280' }}>
                  Mudar para Starter
                </button>
              )
            ) : (
              <div style={{ padding:'9px', borderRadius:9, background:'#f3f4f6', fontSize:13, fontWeight:600, color:'#6b7280', textAlign:'center' }}>
                Plano atual
              </div>
            )}
          </div>

          {/* Pro */}
          <div style={{ borderRadius:14, border: isPro ? '2px solid #0d1f17' : '1.5px solid #e5e7eb', padding:'18px 16px', background: isPro ? '#0d1f17' : '#fff', position:'relative' }}>
            {isPro && <div style={{ position:'absolute', top:-1, left:16, background:'#34d399', color:'#0d1f17', fontSize:10, fontWeight:700, padding:'2px 10px', borderRadius:'0 0 8px 8px' }}>PLANO ATUAL</div>}
            <div style={{ fontSize:12, fontWeight:700, color: isPro?'#34d399':'#6b7280', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:8, marginTop: isPro ? 8 : 0 }}>Pro</div>
            <div style={{ display:'flex', alignItems:'baseline', gap:3, marginBottom:2 }}>
              <span style={{ fontSize:14, fontWeight:500, color: isPro?'rgba(255,255,255,0.5)':'#9ca3af' }}>R$</span>
              <span style={{ fontSize:28, fontWeight:700, color: isPro?'#fff':'#111827' }}>{anual?29:39}</span>
              <span style={{ fontSize:12, color: isPro?'rgba(255,255,255,0.4)':'#9ca3af' }}>/mês</span>
            </div>
            <div style={{ fontSize:12, color: isPro?'rgba(255,255,255,0.4)':'#9ca3af', marginBottom:14 }}>
              {anual ? `R$ 348/ano · 2 meses grátis` : 'Cobrado mensalmente'}
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:16 }}>
              {['Agendamentos ilimitados','WhatsApp automático','Relatórios financeiros','Pix integrado','Suporte prioritário'].map((f,i)=>(
                <div key={i} style={{ fontSize:12.5, color: isPro?'rgba(255,255,255,0.8)':'#374151', display:'flex', gap:6 }}>
                  <span style={{ color: isPro?'#34d399':'#059669' }}>✓</span>{f}
                </div>
              ))}
            </div>
            {isPro ? (
              <div style={{ padding:'9px', borderRadius:9, background:'rgba(52,211,153,0.15)', fontSize:13, fontWeight:600, color:'#34d399', textAlign:'center' }}>
                ✓ Plano ativo
              </div>
            ) : (
              <button onClick={()=>assinarPlano(anual?'anual':'mensal')} disabled={!!loadingPlano}
                style={{ width:'100%', padding:'11px', border:'none', borderRadius:9, fontSize:13.5, fontWeight:700, background:'#0d1f17', color:'#fff', cursor: loadingPlano?'default':'pointer', fontFamily:'inherit', opacity: loadingPlano?0.7:1 }}>
                {loadingPlano?'Aguarde...':'⭐ Assinar Pro → 7 dias grátis'}
              </button>
            )}
          </div>

        </div>
      </div>

      {/* Pix */}
      <div style={card}>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
          <div style={{ fontSize:14, fontWeight:700, color:'#111827' }}>Chave Pix</div>
          {!isPro && <span style={{ fontSize:10.5, background:'#fef3c7', color:'#92400e', padding:'2px 8px', borderRadius:99, fontWeight:600 }}>PRO</span>}
        </div>
        <div style={{ fontSize:13, color:'#4b5563', marginBottom:12 }}>
          {isPro ? 'Sua chave Pix aparece na confirmação de agendamento dos clientes.' : 'Upgrade para Pro para mostrar sua chave Pix na confirmação de agendamento.'}
        </div>
        {isPro ? (
          <div style={{ display:'flex', gap:8 }}>
            <input
              type="text"
              placeholder="CPF, e-mail, telefone ou chave aleatória"
              value={pixKey}
              onChange={e=>setPixKey(e.target.value)}
              style={{ ...inp, flex:1 }}
            />
            <button onClick={savePixKey} disabled={savingPix}
              style={{ padding:'9px 16px', border:'none', borderRadius:8, fontSize:13, fontWeight:600, background:'#0d1f17', color:'#fff', cursor:'pointer', fontFamily:'inherit', opacity:savingPix?0.7:1, flexShrink:0 }}>
              {savingPix ? '...' : 'Salvar'}
            </button>
          </div>
        ) : (
          <button onClick={()=>{ setNav('Configurações') }} style={{ padding:'9px 18px', border:'none', borderRadius:9, fontSize:13, fontWeight:700, background:'#0d1f17', color:'#fff', cursor:'pointer', fontFamily:'inherit' }}>
            ⭐ Upgrade para Pro
          </button>
        )}
      </div>

      {/* Link */}
      <div style={card}>
        <div style={{ fontSize:14, fontWeight:600, marginBottom:4 }}>Link do seu agendamento</div>
        <div style={{ fontSize:13, color:'#6b7280', marginBottom:12 }}>Compartilhe com seus clientes</div>
        <div style={{ background:'#f9fafb', border:'1.5px solid #e5e7eb', borderRadius:8, padding:'10px 14px', fontSize:13, color:'#0d1f17', fontWeight:500, wordBreak:'break-all' }}>
          {typeof window!=='undefined'?window.location.origin:'agendei-rho.vercel.app'}/agendar/{nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,'')}
        </div>
        <button onClick={()=>{
          const link = `${window.location.origin}/agendar/${nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,'')}`
          navigator.clipboard.writeText(link)
          showToast('🔗 Link copiado!')
        }} style={{ marginTop:10, padding:'8px 16px', border:'1.5px solid #e5e7eb', borderRadius:8, fontSize:13, fontWeight:500, background:'#fff', cursor:'pointer', fontFamily:'inherit' }}>
          Copiar link
        </button>
      </div>

      <button onClick={handleLogout} style={{ padding:'12px', borderRadius:10, border:'1.5px solid #fee2e2', background:'#fee2e2', color:'#dc2626', fontSize:14, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
        Sair da conta
      </button>
    </div>
  )

  const Modal = modal && (
    <div onClick={e=>{ if(e.target===e.currentTarget){ setModal(false); setFormError('') } }}
      style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:50 }}>
      <div style={{ background:'#fff', borderRadius:16, padding:26, width:420, maxWidth:'94vw', maxHeight:'90vh', overflowY:'auto' }}>
        <h2 style={{ fontSize:17, fontWeight:600, margin:'0 0 18px' }}>Novo agendamento</h2>
        {formError && (
          <div style={{ background:'#fee2e2', color:'#dc2626', padding:'9px 13px', borderRadius:9, fontSize:13, marginBottom:14 }}>
            ⚠️ {formError}
          </div>
        )}
        {[
          { label:'Nome do cliente', key:'cliente', type:'text', ph:'Ex: Ana Santos' },
          { label:'WhatsApp', key:'telefone', type:'tel', ph:'(67) 99999-0000' },
        ].map(f=>(
          <div key={f.key} style={{ marginBottom:13 }}>
            <label style={lbl}>{f.label}</label>
            <input type={f.type} placeholder={f.ph} value={(form as any)[f.key]} onChange={e=>setForm({...form,[f.key]:e.target.value})} style={inp} />
          </div>
        ))}
        <div style={{ marginBottom:13 }}>
          <label style={lbl}>Serviço</label>
          <select value={form.servico} onChange={e=>onServiceChange(e.target.value)} style={{ ...inp }}>
            {svcOptions.map(s=><option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:13 }}>
          <div><label style={lbl}>Data</label><input type="date" value={form.data} onChange={e=>setForm({...form,data:e.target.value})} style={inp} /></div>
          <div><label style={lbl}>Horário</label><input type="time" value={form.horario} onChange={e=>setForm({...form,horario:e.target.value})} style={inp} /></div>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:18 }}>
          <div><label style={lbl}>Preço</label><input type="text" placeholder="R$ 80" value={form.preco} onChange={e=>setForm({...form,preco:e.target.value})} style={inp} /></div>
          <div><label style={lbl}>Duração</label><input type="text" placeholder="1h 30min" value={form.duracao} onChange={e=>setForm({...form,duracao:e.target.value})} style={inp} /></div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={()=>setModal(false)} style={{ flex:1, padding:10, border:'1.5px solid #e5e7eb', borderRadius:8, fontSize:13.5, fontWeight:500, background:'#fff', cursor:'pointer', fontFamily:'inherit' }}>Cancelar</button>
          <button onClick={handleSave} disabled={saving} style={{ flex:2, padding:10, border:'none', borderRadius:8, fontSize:13.5, fontWeight:700, background:'#0d1f17', color:'#fff', cursor:'pointer', fontFamily:'inherit', opacity:saving?0.7:1 }}>
            {saving?'Salvando...':'Confirmar agendamento'}
          </button>
        </div>
      </div>
    </div>
  )

  async function chamarAdminAPI(plano: string, meses: number | 'permanente') {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { showToast('❌ Sessão expirada. Faça login novamente.'); return false }

    const res = await fetch('/api/admin/plano', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ userId: user.id, plano, meses }),
    })
    const data = await res.json()
    if (!res.ok) { showToast('❌ Erro: ' + (data.error || res.statusText)); return false }
    return true
  }

  async function ativarPro(meses: number | 'permanente') {
    const ok = await chamarAdminAPI('pro', meses)
    if (!ok) return
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    if (data) { setProfile(data); setPixKey(data.pix_key || '') }
    showToast(`✅ Plano Pro ativado${meses !== 'permanente' ? ` por ${meses} mês(es)` : ' permanentemente'}!`)
  }

  async function voltarStarter() {
    const ok = await chamarAdminAPI('starter', 'permanente')
    if (!ok) return
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    if (data) { setProfile(data); setPixKey(data.pix_key || '') }
    showToast('↩ Voltou para Starter.')
  }

  const AdminView = isAdmin ? (
    <div style={{ flex:1, overflowY:'auto', padding: isMobile ? '20px 16px 84px' : '28px 32px', display:'flex', flexDirection:'column', gap:20 }}>
      <div>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:4 }}>
          <h1 style={{ fontSize: isMobile ? 18 : 22, fontWeight:700, letterSpacing:-0.5, margin:0, color:'#0d1f17' }}>Painel Admin</h1>
          <span style={{ fontSize:11, background:'#fef3c7', color:'#92400e', padding:'3px 10px', borderRadius:99, fontWeight:700 }}>SOMENTE VOCÊ VÊ ISSO</span>
        </div>
        <p style={{ fontSize:12.5, color:'#4b5563', marginTop:2 }}>Ferramentas internas para testar o app sem pagar.</p>
      </div>

      {/* Status atual */}
      <div style={{ ...card, background: isPro ? '#0d1f17' : '#f9fafb', color: isPro ? '#fff' : '#111827' }}>
        <div style={{ fontSize:13, fontWeight:600, color: isPro ? '#34d399' : '#4b5563', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:8 }}>Status atual da conta</div>
        <div style={{ display:'flex', alignItems:'center', gap:14 }}>
          <div style={{ fontSize:36 }}>{isPro ? '🚀' : '🌱'}</div>
          <div>
            <div style={{ fontSize:20, fontWeight:700 }}>{isPro ? 'Plano Pro ativo' : 'Plano Starter'}</div>
            <div style={{ fontSize:13, color: isPro ? 'rgba(255,255,255,0.55)' : '#6b7280', marginTop:2 }}>
              {isPro
                ? (profile?.plano_expira ? `Expira em: ${fmtDate(profile.plano_expira)}` : 'Sem data de expiração')
                : '20 agendamentos/mês · recursos limitados'}
            </div>
          </div>
        </div>
      </div>

      {/* Ativar Pro */}
      <div style={card}>
        <div style={{ fontSize:14, fontWeight:700, color:'#111827', marginBottom:4 }}>Ativar Plano Pro gratuitamente</div>
        <div style={{ fontSize:13, color:'#4b5563', marginBottom:16 }}>Escolha por quanto tempo quer testar. Nenhum pagamento é cobrado.</div>
        <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4,1fr)', gap:10, marginBottom:14 }}>
          {([
            { label:'7 dias',      meses: 7/30 as any },
            { label:'1 mês',       meses: 1 },
            { label:'3 meses',     meses: 3 },
            { label:'Permanente',  meses: 'permanente' as const },
          ]).map(op => (
            <button key={op.label} onClick={()=>ativarPro(op.meses)}
              style={{ padding:'12px 8px', border:'1.5px solid #e5e7eb', borderRadius:10, fontSize:13, fontWeight:600, background: op.meses==='permanente' ? '#0d1f17' : '#fff', color: op.meses==='permanente' ? '#34d399' : '#111827', cursor:'pointer', fontFamily:'inherit', textAlign:'center' }}>
              {op.meses==='permanente' ? '♾️ ' : '⭐ '}{op.label}
            </button>
          ))}
        </div>
        {isPro && (
          <button onClick={voltarStarter}
            style={{ padding:'9px 18px', border:'1.5px solid #e5e7eb', borderRadius:9, fontSize:13, fontWeight:500, background:'#fff', color:'#6b7280', cursor:'pointer', fontFamily:'inherit' }}>
            ↩ Voltar para Starter (testar limitações)
          </button>
        )}
      </div>

      {/* Info da conta */}
      <div style={card}>
        <div style={{ fontSize:14, fontWeight:700, color:'#111827', marginBottom:14 }}>Dados da sessão</div>
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {[
            { label:'E-mail',       val: user?.email },
            { label:'User ID',      val: user?.id },
            { label:'Plano no DB',  val: profile?.plano || 'starter' },
            { label:'Expira em',    val: profile?.plano_expira || '—' },
            { label:'Plano expira',  val: profile?.plano_expira || 'Nunca' },
            { label:'Chave Pix',    val: profile?.pix_key || '—' },
          ].map(r => (
            <div key={r.label} style={{ display:'flex', gap:12, fontSize:13, padding:'7px 0', borderBottom:'1px solid #f3f4f6' }}>
              <span style={{ color:'#6b7280', fontWeight:500, minWidth:110, flexShrink:0 }}>{r.label}</span>
              <span style={{ color:'#111827', fontWeight:600, wordBreak:'break-all' }}>{r.val}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Simular limite Starter */}
      <div style={{ ...card, border:'1.5px solid #fde68a', background:'#fffbeb' }}>
        <div style={{ fontSize:14, fontWeight:700, color:'#92400e', marginBottom:6 }}>⚠️ Testando o limite do Starter</div>
        <div style={{ fontSize:13, color:'#78350f', lineHeight:1.6 }}>
          Com o plano Starter, o app bloqueia a criação do 21º agendamento no mês. Para testar isso:
          <br/>1. Clique em <strong>"↩ Voltar para Starter"</strong> acima
          <br/>2. Tente criar mais de 20 agendamentos neste mês
          <br/>3. No 21º, o modal mostrará a mensagem de limite e pedirá upgrade
        </div>
      </div>
    </div>
  ) : null

  return (
    <div style={{ display:'flex', height:'100vh', fontFamily:'system-ui, sans-serif', background:'#f2f1ec' }}>
      {Sidebar}
      {nav==='Agenda'        && AgendaView}
      {nav==='Clientes'      && ClientesView}
      {nav==='Serviços'      && ServicosView}
      {nav==='Financeiro'    && FinanceiroView}
      {nav==='Configurações' && ConfigView}
      {nav==='Admin'         && AdminView}
      {Modal}
      {BottomNav}

      {/* Toast de notificação */}
      {toast && (
        <div style={{ position:'fixed', bottom: isMobile ? 72 : 28, left:'50%', transform:'translateX(-50%)', background:'#0d1f17', color:'#fff', padding:'12px 22px', borderRadius:12, fontSize:13.5, fontWeight:500, boxShadow:'0 4px 20px rgba(0,0,0,0.25)', zIndex:100, whiteSpace:'nowrap' }}>
          {toast}
        </div>
      )}
    </div>
  )
}
