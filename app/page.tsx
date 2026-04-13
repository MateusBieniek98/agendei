'use client'

import { useState } from 'react'

// ── DATA ──────────────────────────────────────────────
const appointments = [
  { time: '09:00', name: 'Ana Santos',     service: 'Manicure + Pedicure', duration: '1h 30min', price: 'R$ 90',  status: 'done', color: '#fee2e2', text: '#dc2626', bar: '#f87171', initials: 'AS' },
  { time: '11:00', name: 'João Lima',      service: 'Corte + Barba',       duration: '1h',       price: 'R$ 80',  status: 'now',  color: '#dbeafe', text: '#1d4ed8', bar: '#60a5fa', initials: 'JL' },
  { time: '14:00', name: 'Patrícia Costa', service: 'Hidratação capilar',  duration: '2h',       price: 'R$ 150', status: 'conf', color: '#ede9fe', text: '#7c3aed', bar: '#a78bfa', initials: 'PC' },
  { time: '17:00', name: 'Rafael Moura',   service: 'Progressiva',         duration: '3h',       price: 'R$ 100', status: 'pend', color: '#fef3c7', text: '#d97706', bar: '#fbbf24', initials: 'RM' },
]

const clients = [
  { name: 'Ana Santos',     phone: '(67) 99101-2233', visits: 12, last: '09 Abr', total: 'R$ 780',   initials: 'AS', color: '#fee2e2', text: '#dc2626' },
  { name: 'João Lima',      phone: '(67) 98822-4411', visits: 8,  last: '11 Abr', total: 'R$ 520',   initials: 'JL', color: '#dbeafe', text: '#1d4ed8' },
  { name: 'Patrícia Costa', phone: '(67) 99933-5500', visits: 21, last: '07 Abr', total: 'R$ 1.890', initials: 'PC', color: '#ede9fe', text: '#7c3aed' },
  { name: 'Rafael Moura',   phone: '(67) 98811-7722', visits: 5,  last: '02 Abr', total: 'R$ 350',   initials: 'RM', color: '#fef3c7', text: '#d97706' },
  { name: 'Lucia Ferreira', phone: '(67) 99244-3310', visits: 15, last: '10 Abr', total: 'R$ 1.200', initials: 'LF', color: '#dcfce7', text: '#166534' },
  { name: 'Carlos Souza',   phone: '(67) 98700-9988', visits: 3,  last: '28 Mar', total: 'R$ 210',   initials: 'CS', color: '#f3f4f6', text: '#374151' },
]

const servicesList = [
  { name: 'Manicure',            duration: '45 min',  price: 'R$ 60',  category: 'Beleza'     },
  { name: 'Pedicure',            duration: '45 min',  price: 'R$ 60',  category: 'Beleza'     },
  { name: 'Manicure + Pedicure', duration: '1h 30min',price: 'R$ 90',  category: 'Beleza'     },
  { name: 'Corte',               duration: '45 min',  price: 'R$ 70',  category: 'Cabelo'     },
  { name: 'Barba',               duration: '30 min',  price: 'R$ 40',  category: 'Cabelo'     },
  { name: 'Corte + Barba',       duration: '1h',      price: 'R$ 90',  category: 'Cabelo'     },
  { name: 'Hidratação capilar',  duration: '2h',      price: 'R$ 150', category: 'Cabelo'     },
  { name: 'Progressiva',         duration: '3h',      price: 'R$ 200', category: 'Tratamento' },
]

const reviews = [
  { name: 'Ana Santos',     stars: 5, comment: 'Profissional incrível! Sempre caprichosa e pontual. Super recomendo!',          date: '09 Abr', service: 'Manicure + Pedicure', initials: 'AS', color: '#fee2e2', text: '#dc2626' },
  { name: 'Patrícia Costa', stars: 5, comment: 'Melhor hidratação que já fiz! Cabelo ficou lindo. Voltarei com certeza.',        date: '07 Abr', service: 'Hidratação capilar',  initials: 'PC', color: '#ede9fe', text: '#7c3aed' },
  { name: 'Lucia Ferreira', stars: 4, comment: 'Ótimo atendimento, ambiente agradável. Só o tempo foi um pouco mais longo.',     date: '10 Abr', service: 'Progressiva',         initials: 'LF', color: '#dcfce7', text: '#166534' },
  { name: 'João Lima',      stars: 5, comment: 'Corte impecável como sempre. Já sou cliente fiel há 2 anos!',                   date: '11 Abr', service: 'Corte + Barba',       initials: 'JL', color: '#dbeafe', text: '#1d4ed8' },
]

const statusLabel: Record<string, string> = { done: 'Concluído', now: 'Em andamento', conf: 'Confirmado', pend: 'Aguardando' }
const statusStyle: Record<string, React.CSSProperties> = {
  done: { background: '#f3f4f6', color: '#6b7280' },
  now:  { background: '#dbeafe', color: '#1e40af' },
  conf: { background: '#dcfce7', color: '#166534' },
  pend: { background: '#fef3c7', color: '#92400e' },
}

// ── SHARED STYLES ─────────────────────────────────────
const card: React.CSSProperties  = { background: '#fff', borderRadius: 12, padding: '16px 18px', border: '1px solid rgba(0,0,0,0.08)' }
const inp:  React.CSSProperties  = { width: '100%', padding: '9px 12px', border: '1.5px solid #e5e7eb', borderRadius: 8, fontSize: 14, fontFamily: 'inherit', outline: 'none' }

// ── SCREENS ───────────────────────────────────────────
function Agenda({ onNew }: { onNew: () => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: -0.5, margin: 0 }}>Olá, Maria! ☀️</h1>
          <p style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>Domingo, 12 de abril de 2026 · 4 agendamentos hoje</p>
        </div>
        <button onClick={onNew} style={{ background: '#0d1f17', color: '#fff', border: 'none', padding: '9px 16px', borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          ＋ Novo agendamento
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        {[
          { label: 'Hoje',            value: '4',       sub: 'agendamentos',  tag: '+2 vs ontem',      bg: '#dcfce7', tc: '#166534' },
          { label: 'Receita do dia',  value: 'R$ 420',  sub: 'previsto',      tag: '↑ 18%',            bg: '#dcfce7', tc: '#166534' },
          { label: 'Clientes ativos', value: '134',     sub: 'total na base', tag: '+12 no mês',       bg: '#dbeafe', tc: '#1e40af' },
          { label: 'Avaliação',       value: '4.9 ⭐',  sub: '47 avaliações', tag: 'Top profissional', bg: '#dcfce7', tc: '#166534' },
        ].map(s => (
          <div key={s.label} style={card}>
            <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>{s.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.5 }}>{s.value}</div>
            <div style={{ fontSize: 11.5, color: '#6b7280', marginTop: 4 }}>{s.sub}</div>
            <span style={{ display: 'inline-block', fontSize: 10.5, padding: '2px 7px', borderRadius: 99, fontWeight: 600, marginTop: 5, background: s.bg, color: s.tc }}>{s.tag}</span>
          </div>
        ))}
      </div>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={{ fontSize: 15, fontWeight: 600 }}>Agenda de hoje</span>
          <span style={{ fontSize: 12.5, color: '#6b7280', cursor: 'pointer' }}>Ver semana →</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {appointments.map(ap => (
            <div key={ap.time} style={{ ...card, display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer' }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: '#9ca3af', minWidth: 44 }}>{ap.time}</div>
              <div style={{ width: 3, height: 40, borderRadius: 99, background: ap.bar, flexShrink: 0 }} />
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: ap.color, color: ap.text, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{ap.initials}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13.5, fontWeight: 500 }}>{ap.name}</div>
                <div style={{ fontSize: 12, color: '#6b7280' }}>{ap.service}</div>
                <div style={{ fontSize: 11, color: '#9ca3af' }}>⏱ {ap.duration}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{ap.price}</div>
                <span style={{ display: 'inline-block', fontSize: 10.5, padding: '3px 9px', borderRadius: 99, fontWeight: 600, marginTop: 4, ...statusStyle[ap.status] }}>{statusLabel[ap.status]}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function Clientes() {
  const [search, setSearch] = useState('')
  const filtered = clients.filter(c => c.name.toLowerCase().includes(search.toLowerCase()))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600, margin: 0 }}>Clientes</h1>
          <p style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>{clients.length} clientes na base</p>
        </div>
        <button style={{ background: '#0d1f17', color: '#fff', border: 'none', padding: '9px 16px', borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>＋ Novo cliente</button>
      </div>
      <input placeholder="🔍  Buscar cliente..." value={search} onChange={e => setSearch(e.target.value)} style={{ ...inp, fontSize: 13 }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filtered.map(c => (
          <div key={c.name} style={{ ...card, display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 42, height: 42, borderRadius: '50%', background: c.color, color: c.text, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>{c.initials}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{c.name}</div>
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{c.phone}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{c.visits}x</div>
              <div style={{ fontSize: 11, color: '#9ca3af' }}>visitas</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{c.total}</div>
              <div style={{ fontSize: 11, color: '#9ca3af' }}>total gasto</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, color: '#9ca3af' }}>Última visita</div>
              <div style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>{c.last}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function Servicos() {
  const categories = [...new Set(servicesList.map(s => s.category))]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600, margin: 0 }}>Serviços</h1>
          <p style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>{servicesList.length} serviços cadastrados</p>
        </div>
        <button style={{ background: '#0d1f17', color: '#fff', border: 'none', padding: '9px 16px', borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>＋ Novo serviço</button>
      </div>
      {categories.map(cat => (
        <div key={cat}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>{cat}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {servicesList.filter(s => s.category === cat).map(s => (
              <div key={s.name} style={{ ...card, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{s.name}</div>
                  <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>⏱ {s.duration}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ fontSize: 16, fontWeight: 700 }}>{s.price}</div>
                  <button style={{ background: 'none', border: '1px solid #e5e7eb', borderRadius: 7, padding: '5px 10px', fontSize: 12, cursor: 'pointer', color: '#6b7280' }}>Editar</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function Financeiro() {
  const months = ['Out', 'Nov', 'Dez', 'Jan', 'Fev', 'Mar', 'Abr']
  const values = [2100, 2800, 3200, 2600, 3100, 3500, 1680]
  const max = Math.max(...values)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 600, margin: 0 }}>Financeiro</h1>
        <p style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>Visão geral dos últimos 7 meses</p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
        {[
          { label: 'Receita — Abril', value: 'R$ 1.680', tag: 'até hoje',   bg: '#dbeafe', tc: '#1e40af' },
          { label: 'Receita — Março', value: 'R$ 3.500', tag: '↑ 13%',      bg: '#dcfce7', tc: '#166534' },
          { label: 'Ticket médio',    value: 'R$ 96',    tag: 'por cliente', bg: '#ede9fe', tc: '#7c3aed' },
        ].map(s => (
          <div key={s.label} style={card}>
            <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>{s.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{s.value}</div>
            <span style={{ display: 'inline-block', fontSize: 10.5, padding: '2px 7px', borderRadius: 99, fontWeight: 600, marginTop: 6, background: s.bg, color: s.tc }}>{s.tag}</span>
          </div>
        ))}
      </div>
      <div style={card}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Receita mensal</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 130 }}>
          {values.map((v, i) => (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 500 }}>R${(v / 1000).toFixed(1)}k</div>
              <div style={{ width: '100%', background: i === 6 ? '#0d1f17' : '#dcfce7', borderRadius: '6px 6px 0 0', height: `${(v / max) * 90}px` }} />
              <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 500 }}>{months[i]}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={card}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>Serviços mais lucrativos</div>
        {[
          { name: 'Progressiva', pct: 88, value: 'R$ 800' },
          { name: 'Hidratação',  pct: 65, value: 'R$ 600' },
          { name: 'Manicure',    pct: 45, value: 'R$ 420' },
        ].map(s => (
          <div key={s.name} style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 5 }}>
              <span style={{ fontWeight: 500 }}>{s.name}</span>
              <span style={{ color: '#6b7280' }}>{s.value}</span>
            </div>
            <div style={{ height: 6, background: '#f3f4f6', borderRadius: 99, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${s.pct}%`, background: '#0d1f17', borderRadius: 99 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function Avaliacoes() {
  const avg = (reviews.reduce((a, r) => a + r.stars, 0) / reviews.length).toFixed(1)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 600, margin: 0 }}>Avaliações</h1>
        <p style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>{reviews.length} avaliações recebidas</p>
      </div>
      <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 24 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, fontWeight: 700, lineHeight: 1 }}>{avg}</div>
          <div style={{ fontSize: 20, marginTop: 4 }}>⭐⭐⭐⭐⭐</div>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>média geral</div>
        </div>
        <div style={{ flex: 1 }}>
          {[5, 4, 3, 2, 1].map(n => {
            const count = reviews.filter(r => r.stars === n).length
            return (
              <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: '#6b7280', width: 14 }}>{n}</span>
                <span style={{ fontSize: 12 }}>⭐</span>
                <div style={{ flex: 1, height: 6, background: '#f3f4f6', borderRadius: 99, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${(count / reviews.length) * 100}%`, background: '#fbbf24', borderRadius: 99 }} />
                </div>
                <span style={{ fontSize: 12, color: '#9ca3af', width: 14 }}>{count}</span>
              </div>
            )
          })}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {reviews.map(r => (
          <div key={r.name} style={card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: r.color, color: r.text, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{r.initials}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{r.name}</div>
                <div style={{ fontSize: 12, color: '#9ca3af' }}>{r.service} · {r.date}</div>
              </div>
              <div style={{ fontSize: 16 }}>{'⭐'.repeat(r.stars)}</div>
            </div>
            <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.55, fontStyle: 'italic' }}>"{r.comment}"</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function Configuracoes() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 600, margin: 0 }}>Configurações</h1>
        <p style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>Gerencie seu perfil e preferências</p>
      </div>
      <div style={card}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>Perfil profissional</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {[
            { label: 'Nome',          value: 'Maria Silva'       },
            { label: 'WhatsApp',      value: '(67) 99999-0000'   },
            { label: 'Especialidade', value: 'Beleza & Estética' },
            { label: 'Cidade',        value: 'Campo Grande, MS'  },
          ].map(f => (
            <div key={f.label}>
              <label style={{ fontSize: 12.5, fontWeight: 500, color: '#6b7280', display: 'block', marginBottom: 5 }}>{f.label}</label>
              <input defaultValue={f.value} style={inp} />
            </div>
          ))}
        </div>
        <button style={{ marginTop: 16, background: '#0d1f17', color: '#fff', border: 'none', padding: '9px 18px', borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          Salvar alterações
        </button>
      </div>
      <div style={card}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>Notificações automáticas</div>
        {[
          { label: 'Confirmação imediata', desc: 'Enviar WhatsApp ao agendar'     },
          { label: 'Lembrete 24h antes',   desc: 'Lembrar cliente no dia anterior' },
          { label: 'Lembrete 1h antes',    desc: 'Lembrar cliente 1h antes'        },
          { label: 'Pedido de avaliação',  desc: 'Enviar após o atendimento'       },
        ].map(n => (
          <div key={n.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f3f4f6' }}>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 500 }}>{n.label}</div>
              <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>{n.desc}</div>
            </div>
            <div style={{ width: 40, height: 22, borderRadius: 99, background: '#059669', position: 'relative', cursor: 'pointer', flexShrink: 0 }}>
              <div style={{ position: 'absolute', width: 16, height: 16, borderRadius: '50%', background: '#fff', top: 3, left: 21, boxShadow: '0 1px 3px rgba(0,0,0,.2)' }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── MAIN APP ──────────────────────────────────────────
const navItems = [
  { icon: '📅', label: 'Agenda'        },
  { icon: '👥', label: 'Clientes'      },
  { icon: '✂️', label: 'Serviços'      },
  { icon: '💰', label: 'Financeiro'    },
  { icon: '⭐', label: 'Avaliações'    },
  { icon: '⚙️', label: 'Configurações' },
]

export default function Home() {
  const [active, setActive] = useState('Agenda')
  const [modal, setModal]   = useState(false)
  const [saved, setSaved]   = useState(false)
  const [form, setForm]     = useState({ client: '', service: 'Manicure', date: '', time: '09:00', phone: '' })

  function handleSave() {
    if (!form.client || !form.date) return alert('Preencha o nome e a data!')
    setSaved(true)
    setTimeout(() => { setModal(false); setSaved(false) }, 2000)
  }

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'system-ui, sans-serif', background: '#f2f1ec' }}>

      {/* SIDEBAR */}
      <div style={{ width: 228, background: '#0d1f17', display: 'flex', flexDirection: 'column', padding: '24px 14px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '0 8px', marginBottom: 32 }}>
          <div style={{ width: 30, height: 30, background: '#34d399', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 16, color: '#0d1f17' }}>A</div>
          <span style={{ fontSize: 19, fontWeight: 600, color: '#fff', letterSpacing: -0.5 }}>
            agen<span style={{ color: '#34d399' }}>dei</span>
          </span>
        </div>

        <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {navItems.map(item => (
            <div key={item.label} onClick={() => setActive(item.label)} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '9px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 13.5,
              background: active === item.label ? 'rgba(52,211,153,0.14)' : 'transparent',
              color: active === item.label ? '#34d399' : 'rgba(255,255,255,0.45)',
              fontWeight: active === item.label ? 500 : 400,
              transition: 'all .15s',
            }}>
              <span style={{ width: 18, textAlign: 'center' }}>{item.icon}</span>
              {item.label}
            </div>
          ))}
        </nav>

        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 14, display: 'flex', alignItems: 'center', gap: 10, paddingLeft: 4 }}>
          <div style={{ width: 33, height: 33, borderRadius: '50%', background: 'linear-gradient(135deg,#059669,#34d399)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0 }}>MS</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.75)' }}>Maria Silva</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>Plano Pro</div>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '28px 32px' }}>
        {active === 'Agenda'        && <Agenda onNew={() => setModal(true)} />}
        {active === 'Clientes'      && <Clientes />}
        {active === 'Serviços'      && <Servicos />}
        {active === 'Financeiro'    && <Financeiro />}
        {active === 'Avaliações'    && <Avaliacoes />}
        {active === 'Configurações' && <Configuracoes />}
      </div>

      {/* MODAL NOVO AGENDAMENTO */}
      {modal && (
        <div onClick={e => e.target === e.currentTarget && setModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 26, width: 400, maxWidth: '94vw' }}>
            {saved ? (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div style={{ fontSize: 48 }}>✅</div>
                <div style={{ fontSize: 18, fontWeight: 600, marginTop: 12 }}>Agendamento salvo!</div>
                <div style={{ fontSize: 13, color: '#6b7280', marginTop: 6 }}>Notificação enviada via WhatsApp</div>
              </div>
            ) : (
              <>
                <h2 style={{ fontSize: 17, fontWeight: 600, marginBottom: 18 }}>Novo agendamento</h2>
                {[
                  { label: 'Cliente',  key: 'client', type: 'text', placeholder: 'Nome do cliente'  },
                  { label: 'WhatsApp', key: 'phone',  type: 'tel',  placeholder: '(67) 99999-0000'  },
                ].map(f => (
                  <div key={f.key} style={{ marginBottom: 13 }}>
                    <label style={{ fontSize: 12.5, fontWeight: 500, color: '#6b7280', display: 'block', marginBottom: 5 }}>{f.label}</label>
                    <input type={f.type} placeholder={f.placeholder} value={(form as any)[f.key]}
                      onChange={e => setForm({ ...form, [f.key]: e.target.value })} style={inp} />
                  </div>
                ))}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 13 }}>
                  <div>
                    <label style={{ fontSize: 12.5, fontWeight: 500, color: '#6b7280', display: 'block', marginBottom: 5 }}>Serviço</label>
                    <select value={form.service} onChange={e => setForm({ ...form, service: e.target.value })} style={inp}>
                      {servicesList.map(s => <option key={s.name}>{s.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 12.5, fontWeight: 500, color: '#6b7280', display: 'block', marginBottom: 5 }}>Horário</label>
                    <input type="time" value={form.time} onChange={e => setForm({ ...form, time: e.target.value })} style={inp} />
                  </div>
                </div>
                <div style={{ marginBottom: 13 }}>
                  <label style={{ fontSize: 12.5, fontWeight: 500, color: '#6b7280', display: 'block', marginBottom: 5 }}>Data</label>
                  <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} style={inp} />
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
                  <button onClick={() => setModal(false)} style={{ flex: 1, padding: 9, border: '1.5px solid #e5e7eb', borderRadius: 8, fontSize: 13.5, fontWeight: 500, background: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>Cancelar</button>
                  <button onClick={handleSave} style={{ flex: 2, padding: 9, border: 'none', borderRadius: 8, fontSize: 13.5, fontWeight: 700, background: '#0d1f17', color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>Confirmar</button>
                </div>
                <button onClick={() => alert('📲 Notificação enviada!')} style={{ width: '100%', padding: 10, border: 'none', borderRadius: 8, fontSize: 13.5, fontWeight: 700, background: '#22c55e', color: '#fff', cursor: 'pointer', fontFamily: 'inherit', marginTop: 8 }}>
                  📲 Notificar via WhatsApp
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
