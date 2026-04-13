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
    if (data) { setProfile(data); return }
    const nome = u.user_metadata?.nome || u.email?.split('@')[0] || 'Profissional'
    await supabase.from('profiles').insert({ id:u.id, nome, email:u.email })
    setProfile({ nome, email:u.email })
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
    if (!form.cliente || !form.data || !form.horario) return alert('Preencha nome, data e horário!')
    setSaving(true)
    await supabase.from('agendamentos').insert({
      profissional_id: user.id,
      cliente_nome: form.cliente,
      cliente_telefone: form.telefone,
      servico: form.servico,
      data: form.data,
      horario: form.horario,
      preco: form.preco,
      duracao: form.duracao,
      status: form.status,
    })
    await loadAgendamentos(user.id, filterDate)
    await loadAllAg(user.id)
    setModal(false); setSaving(false)
    setForm({ cliente:'', telefone:'', servico: services.length > 0 ? services[0].nome : DEFAULT_SERVICES[0], data:'', horario:'09:00', preco: services.length > 0 ? services[0].preco || '' : '', duracao: services.length > 0 ? services[0].duracao || '1h' : '1h', status:'confirmado' })
  }

  async function updateStatus(id: string, status: string) {
    await supabase.from('agendamentos').update({ status }).eq('id', id)
    await loadAgendamentos(user.id, filterDate)
    await loadAllAg(user.id)
  }

  async function deleteAg(id: string) {
    if (!confirm('Cancelar este agendamento?')) return
    await supabase.from('agendamentos').delete().eq('id', id)
    await loadAgendamentos(user.id, filterDate)
    await loadAllAg(user.id)
  }

  async function saveSvc() {
    if (!svcForm.nome) return alert('Preencha o nome do serviço!')
    await supabase.from('servicos').insert({ profissional_id:user.id, ...svcForm })
    await loadServices(user.id)
    setSvcForm({ nome:'', preco:'', duracao:'' })
  }

  async function deleteSvc(id: string) {
    await supabase.from('servicos').delete().eq('id', id)
    await loadServices(user.id)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  function changeDate(d: string) {
    setFD(d)
    loadAgendamentos(user.id, d)
  }

  function onServiceChange(nome: string) {
    const svc = services.find(s => s.nome === nome)
    setForm(f => ({ ...f, servico: nome, preco: svc?.preco || f.preco, duracao: svc?.duracao || f.duracao }))
  }

  const receita      = agendamentos.filter(a=>a.status!=='cancelado').reduce((s,a)=>s+(parseFloat(a.preco?.replace('R$','').replace(',','.').trim())||0),0)
  const receitaTotal = allAg.filter(a=>a.status!=='cancelado').reduce((s,a)=>s+(parseFloat(a.preco?.replace('R$','').replace(',','.').trim())||0),0)
  const clientes     = [...new Map(allAg.map(a=>[a.cliente_nome, a])).values()]
  const nome         = profile?.nome || user?.email?.split('@')[0] || 'Profissional'
  const svcOptions   = services.length > 0 ? services.map(s => s.nome) : DEFAULT_SERVICES

  const meses: Record<string,number> = {}
  allAg.filter(a=>a.status!=='cancelado').forEach(a => {
    const m = a.data?.slice(0,7)
    if (m) meses[m] = (meses[m]||0) + (parseFloat(a.preco?.replace('R$','').replace(',','.').trim())||0)
  })
  const mesesArr = Object.entries(meses).sort().slice(-6)
  const maxVal   = Math.max(...mesesArr.map(m=>m[1]), 1)

  if (loading) return (
    <div style={{ display:'flex', height:'100vh', alignItems:'center', justifyContent:'center', fontFamily:'system-ui', background:'#f2f1ec' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ fontSize:32, fontWeight:700, color:'#0d1f17' }}>agen<span style={{ color:'#34d399' }}>dei</span></div>
        <div style={{ color:'#6b7280', marginTop:8, fontSize:14 }}>Carregando...</div>
      </div>
    </div>
  )

  const Sidebar = (
    <div style={{ width:228, background:'#0d1f17', display:'flex', flexDirection:'column', padding:'24px 14px', flexShrink:0 }}>
      <div style={{ display:'flex', alignItems:'center', gap:9, padding:'0 8px', marginBottom:32 }}>
        <div style={{ width:30, height:30, background:'#34d399', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:16, color:'#0d1f17' }}>A</div>
        <span style={{ fontSize:19, fontWeight:600, color:'#fff', letterSpacing:-0.5 }}>agen<span style={{ color:'#34d399' }}>dei</span></span>
      </div>
      <nav style={{ flex:1, display:'flex', flexDirection:'column', gap:2 }}>
        {[['📅','Agenda'],['👥','Clientes'],['✂️','Serviços'],['💰','Financeiro'],['⚙️','Configurações']].map(([ic,lb])=>(
          <div key={lb} onClick={()=>setNav(lb)} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 12px', borderRadius:8, cursor:'pointer', fontSize:13.5, background:nav===lb?'rgba(52,211,153,0.14)':'transparent', color:nav===lb?'#34d399':'rgba(255,255,255,0.45)', fontWeight:nav===lb?500:400 }}>
            <span style={{ width:18, textAlign:'center' }}>{ic}</span>{lb}
          </div>
        ))}
      </nav>
      <div style={{ borderTop:'1px solid rgba(255,255,255,0.08)', paddingTop:14 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, paddingLeft:4, marginBottom:10 }}>
          <div style={{ width:33, height:33, borderRadius:'50%', background:'linear-gradient(135deg,#059669,#34d399)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, color:'#fff', flexShrink:0 }}>{initials(nome)}</div>
          <div>
            <div style={{ fontSize:13, fontWeight:500, color:'rgba(255,255,255,0.75)', maxWidth:120, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{nome}</div>
            <div style={{ fontSize:11, color:'rgba(255,255,255,0.3)' }}>Plano Pro</div>
          </div>
        </div>
        <button onClick={handleLogout} style={{ width:'100%', padding:'7px', borderRadius:8, border:'1px solid rgba(255,255,255,0.1)', background:'transparent', color:'rgba(255,255,255,0.4)', fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>Sair</button>
      </div>
    </div>
  )

  const AgendaView = (
    <div style={{ flex:1, overflowY:'auto', padding:'28px 32px', display:'flex', flexDirection:'column', gap:22 }}>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between' }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:600, letterSpacing:-0.5, margin:0 }}>Olá, {nome.split(' ')[0]}! ☀️</h1>
          <p style={{ fontSize:13, color:'#6b7280', marginTop:2, textTransform:'capitalize' }}>{today}</p>
        </div>
        <button onClick={()=>setModal(true)} style={{ background:'#0d1f17', color:'#fff', border:'none', padding:'9px 16px', borderRadius:9, fontSize:13, fontWeight:600, cursor:'pointer' }}>＋ Novo agendamento</button>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
        {[
          { label:'Hoje', value:agendamentos.length.toString(), sub:'agendamentos' },
          { label:'Receita do dia', value:fmt(receita), sub:'previsto' },
          { label:'Confirmados', value:agendamentos.filter(a=>a.status==='confirmado').length.toString(), sub:'agendamentos' },
          { label:'Concluídos', value:agendamentos.filter(a=>a.status==='concluido').length.toString(), sub:'hoje' },
        ].map(s=>(
          <div key={s.label} style={card}>
            <div style={{ fontSize:11, color:'#6b7280', fontWeight:500, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:6 }}>{s.label}</div>
            <div style={{ fontSize:22, fontWeight:700, letterSpacing:-0.5 }}>{s.value}</div>
            <div style={{ fontSize:11.5, color:'#6b7280', marginTop:4 }}>{s.sub}</div>
          </div>
        ))}
      </div>
      <div>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
          <span style={{ fontSize:15, fontWeight:600 }}>Agenda</span>
          <input type="date" value={filterDate} onChange={e=>changeDate(e.target.value)}
            style={{ padding:'6px 10px', border:'1.5px solid #e5e7eb', borderRadius:8, fontSize:13, fontFamily:'inherit', outline:'none' }} />
        </div>
        {agendamentos.length === 0 ? (
          <div style={{ ...card, padding:'40px', textAlign:'center' }}>
            <div style={{ fontSize:32, marginBottom:10 }}>📅</div>
            <div style={{ fontSize:15, fontWeight:500 }}>Nenhum agendamento nesta data</div>
            <div style={{ fontSize:13, color:'#6b7280', marginTop:4 }}>Clique em "+ Novo agendamento" para adicionar</div>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {agendamentos.map(ap=>(
              <div key={ap.id} style={{ ...card, display:'flex', alignItems:'center', gap:14 }}>
                <div style={{ fontSize:12.5, fontWeight:600, color:'#9ca3af', minWidth:44 }}>{ap.horario?.slice(0,5)}</div>
                <div style={{ width:3, height:40, borderRadius:99, background:color(ap.cliente_nome, BAR), flexShrink:0 }} />
                <div style={{ width:36, height:36, borderRadius:'50%', background:color(ap.cliente_nome, BG), color:color(ap.cliente_nome, TXT), display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, flexShrink:0 }}>{initials(ap.cliente_nome)}</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13.5, fontWeight:500 }}>{ap.cliente_nome}</div>
                  <div style={{ fontSize:12, color:'#6b7280', marginTop:1 }}>{ap.servico}</div>
                  {ap.duracao && <div style={{ fontSize:11, color:'#9ca3af', marginTop:1 }}>⏱ {ap.duracao}</div>}
                </div>
                <div style={{ textAlign:'right', display:'flex', flexDirection:'column', alignItems:'flex-end', gap:4 }}>
                  {ap.preco && <div style={{ fontSize:14, fontWeight:700 }}>{ap.preco}</div>}
                  <select value={ap.status} onChange={e=>updateStatus(ap.id, e.target.value)}
                    style={{ ...(STATUS_STYLE[ap.status]||STATUS_STYLE.confirmado), fontSize:10.5, padding:'3px 6px', borderRadius:99, fontWeight:600, border:'none', cursor:'pointer', fontFamily:'inherit' }}>
                    <option value="confirmado">Confirmado</option>
                    <option value="concluido">Concluído</option>
                    <option value="pendente">Aguardando</option>
                    <option value="cancelado">Cancelado</option>
                  </select>
                  <button onClick={()=>deleteAg(ap.id)} style={{ fontSize:11, color:'#dc2626', background:'none', border:'none', cursor:'pointer', padding:0 }}>remover</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )

  const ClientesView = (
    <div style={{ flex:1, overflowY:'auto', padding:'28px 32px', display:'flex', flexDirection:'column', gap:22 }}>
      <div>
        <h1 style={{ fontSize:22, fontWeight:600, letterSpacing:-0.5, margin:0 }}>Clientes</h1>
        <p style={{ fontSize:13, color:'#6b7280', marginTop:2 }}>{clientes.length} clientes na base</p>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12 }}>
        {[
          { label:'Total de clientes', value:clientes.length.toString(), sub:'cadastrados' },
          { label:'Atendimentos', value:allAg.length.toString(), sub:'histórico total' },
          { label:'Receita total', value:fmt(receitaTotal), sub:'desde o início' },
        ].map(s=>(
          <div key={s.label} style={card}>
            <div style={{ fontSize:11, color:'#6b7280', fontWeight:500, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:6 }}>{s.label}</div>
            <div style={{ fontSize:22, fontWeight:700, letterSpacing:-0.5 }}>{s.value}</div>
            <div style={{ fontSize:11.5, color:'#6b7280', marginTop:4 }}>{s.sub}</div>
          </div>
        ))}
      </div>
      {clientes.length === 0 ? (
        <div style={{ ...card, padding:'40px', textAlign:'center' }}>
          <div style={{ fontSize:32, marginBottom:10 }}>👥</div>
          <div style={{ fontSize:15, fontWeight:500 }}>Nenhum cliente ainda</div>
          <div style={{ fontSize:13, color:'#6b7280', marginTop:4 }}>Crie agendamentos para ver seus clientes aqui</div>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {clientes.map(c => {
            const ags = allAg.filter(a=>a.cliente_nome===c.cliente_nome).sort((a,b)=>a.data>b.data?1:-1)
            const total = ags.filter(a=>a.status!=='cancelado').reduce((s,a)=>s+(parseFloat(a.preco?.replace('R$','').replace(',','.').trim())||0),0)
            const isExpanded = expandedClient === c.cliente_nome
            return (
              <div key={c.cliente_nome} style={{ ...card, padding:0, overflow:'hidden' }}>
                {/* Header do cliente */}
                <div onClick={()=>setExpandedClient(isExpanded ? null : c.cliente_nome)}
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
                  <span style={{ fontSize:12, color:'#9ca3af', marginLeft:8 }}>{isExpanded ? '▲' : '▼'}</span>
                </div>

                {/* Histórico expandido */}
                {isExpanded && (
                  <div style={{ borderTop:'1px solid #f3f4f6', padding:'12px 18px', background:'#fafafa' }}>
                    <div style={{ fontSize:12, fontWeight:600, color:'#6b7280', marginBottom:10, textTransform:'uppercase', letterSpacing:'0.04em' }}>Histórico de agendamentos</div>
                    {ags.map(a => (
                      <div key={a.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid #f3f4f6' }}>
                        <div>
                          <div style={{ fontSize:13, fontWeight:500 }}>{a.servico}</div>
                          <div style={{ fontSize:12, color:'#6b7280', marginTop:2 }}>
                            📅 {fmtDate(a.data)} às {a.horario?.slice(0,5)}
                          </div>
                        </div>
                        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                          {a.preco && <div style={{ fontSize:13, fontWeight:700 }}>{a.preco}</div>}
                          <span style={{ ...(STATUS_STYLE[a.status]||STATUS_STYLE.confirmado), fontSize:10.5, padding:'2px 8px', borderRadius:99, fontWeight:600 }}>
                            {a.status}
                          </span>
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
    <div style={{ flex:1, overflowY:'auto', padding:'28px 32px', display:'flex', flexDirection:'column', gap:22 }}>
      <div>
        <h1 style={{ fontSize:22, fontWeight:600, letterSpacing:-0.5, margin:0 }}>Serviços</h1>
        <p style={{ fontSize:13, color:'#6b7280', marginTop:2 }}>Estes serviços aparecem para os clientes ao agendar</p>
      </div>
      <div style={card}>
        <div style={{ fontSize:14, fontWeight:600, marginBottom:14 }}>Adicionar serviço</div>
        <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr', gap:10, marginBottom:12 }}>
          <div>
            <label style={lbl}>Nome do serviço</label>
            <input style={inp} placeholder="Ex: Manicure" value={svcForm.nome} onChange={e=>setSvcForm({...svcForm, nome:e.target.value})} />
          </div>
          <div>
            <label style={lbl}>Preço</label>
            <input style={inp} placeholder="R$ 60" value={svcForm.preco} onChange={e=>setSvcForm({...svcForm, preco:e.target.value})} />
          </div>
          <div>
            <label style={lbl}>Duração</label>
            <input style={inp} placeholder="45 min" value={svcForm.duracao} onChange={e=>setSvcForm({...svcForm, duracao:e.target.value})} />
          </div>
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
    <div style={{ flex:1, overflowY:'auto', padding:'28px 32px', display:'flex', flexDirection:'column', gap:22 }}>
      <div>
        <h1 style={{ fontSize:22, fontWeight:600, letterSpacing:-0.5, margin:0 }}>Financeiro</h1>
        <p style={{ fontSize:13, color:'#6b7280', marginTop:2 }}>Visão geral das suas receitas</p>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12 }}>
        {[
          { label:'Receita total', value:fmt(receitaTotal), sub:'todos os períodos' },
          { label:'Atendimentos', value:allAg.filter(a=>a.status==='concluido').length.toString(), sub:'concluídos' },
          { label:'Ticket médio', value: allAg.filter(a=>a.status==='concluido').length ? fmt(receitaTotal/allAg.filter(a=>a.status==='concluido').length) : 'R$ 0,00', sub:'por atendimento' },
        ].map(s=>(
          <div key={s.label} style={card}>
            <div style={{ fontSize:11, color:'#6b7280', fontWeight:500, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:6 }}>{s.label}</div>
            <div style={{ fontSize:22, fontWeight:700, letterSpacing:-0.5 }}>{s.value}</div>
            <div style={{ fontSize:11.5, color:'#6b7280', marginTop:4 }}>{s.sub}</div>
          </div>
        ))}
      </div>
      <div style={card}>
        <div style={{ fontSize:14, fontWeight:600, marginBottom:16 }}>Receita por mês</div>
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
      <div style={card}>
        <div style={{ fontSize:14, fontWeight:600, marginBottom:14 }}>Últimos atendimentos</div>
        {allAg.slice(0,10).map(a=>(
          <div key={a.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 0', borderBottom:'1px solid #f3f4f6' }}>
            <div>
              <div style={{ fontSize:13.5, fontWeight:500 }}>{a.cliente_nome}</div>
              <div style={{ fontSize:12, color:'#6b7280' }}>{a.servico} · {fmtDate(a.data)}</div>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <span style={{ fontSize:14, fontWeight:700 }}>{a.preco || '—'}</span>
              <span style={{ ...(STATUS_STYLE[a.status]||STATUS_STYLE.confirmado), fontSize:10.5, padding:'2px 8px', borderRadius:99, fontWeight:600 }}>{a.status}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )

  const ConfigView = (
    <div style={{ flex:1, overflowY:'auto', padding:'28px 32px', display:'flex', flexDirection:'column', gap:22 }}>
      <div>
        <h1 style={{ fontSize:22, fontWeight:600, letterSpacing:-0.5, margin:0 }}>Configurações</h1>
        <p style={{ fontSize:13, color:'#6b7280', marginTop:2 }}>Gerencie seu perfil e conta</p>
      </div>
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
      <div style={card}>
        <div style={{ fontSize:14, fontWeight:600, marginBottom:4 }}>Link do seu agendamento</div>
        <div style={{ fontSize:13, color:'#6b7280', marginBottom:12 }}>Compartilhe com seus clientes</div>
        <div style={{ background:'#f9fafb', border:'1.5px solid #e5e7eb', borderRadius:8, padding:'10px 14px', fontSize:13, color:'#0d1f17', fontWeight:500, wordBreak:'break-all' }}>
          {typeof window !== 'undefined' ? window.location.origin : 'agendei-rho.vercel.app'}/agendar/{nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,'')}
        </div>
        <button onClick={() => {
          const link = `${window.location.origin}/agendar/${nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,'')}`
          navigator.clipboard.writeText(link)
          alert('Link copiado!')
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
    <div onClick={e=>e.target===e.currentTarget&&setModal(false)}
      style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:50 }}>
      <div style={{ background:'#fff', borderRadius:16, padding:26, width:420, maxWidth:'94vw', maxHeight:'90vh', overflowY:'auto' }}>
        <h2 style={{ fontSize:17, fontWeight:600, margin:'0 0 18px' }}>Novo agendamento</h2>
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

  return (
    <div style={{ display:'flex', height:'100vh', fontFamily:'system-ui, sans-serif', background:'#f2f1ec' }}>
      {Sidebar}
      {nav==='Agenda'        && AgendaView}
      {nav==='Clientes'      && ClientesView}
      {nav==='Serviços'      && ServicosView}
      {nav==='Financeiro'    && FinanceiroView}
      {nav==='Configurações' && ConfigView}
      {Modal}
    </div>
  )
}
