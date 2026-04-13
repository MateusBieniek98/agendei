'use client'

import { useState } from 'react'

const appointments = [
  { time: '09:00', name: 'Ana Santos',     service: 'Manicure + Pedicure', duration: '1h 30min', price: 'R$ 90',  status: 'done',  color: '#fee2e2', text: '#dc2626', bar: '#f87171', initials: 'AS' },
  { time: '11:00', name: 'João Lima',      service: 'Corte + Barba',       duration: '1h',       price: 'R$ 80',  status: 'now',   color: '#dbeafe', text: '#1d4ed8', bar: '#60a5fa', initials: 'JL' },
  { time: '14:00', name: 'Patrícia Costa', service: 'Hidratação capilar',  duration: '2h',       price: 'R$ 150', status: 'conf',  color: '#ede9fe', text: '#7c3aed', bar: '#a78bfa', initials: 'PC' },
  { time: '17:00', name: 'Rafael Moura',   service: 'Progressiva',         duration: '3h',       price: 'R$ 100', status: 'pend',  color: '#fef3c7', text: '#d97706', bar: '#fbbf24', initials: 'RM' },
]

const statusLabel: Record<string, string> = {
  done: 'Concluído', now: 'Em andamento', conf: 'Confirmado', pend: 'Aguardando'
}
const statusStyle: Record<string, React.CSSProperties> = {
  done: { background: '#f3f4f6', color: '#6b7280' },
  now:  { background: '#dbeafe', color: '#1e40af' },
  conf: { background: '#dcfce7', color: '#166534' },
  pend: { background: '#fef3c7', color: '#92400e' },
}

const services = ['Manicure', 'Pedicure', 'Corte', 'Barba', 'Hidratação capilar', 'Progressiva']

export default function Home() {
  const [modal, setModal] = useState(false)
  const [saved, setSaved] = useState(false)
  const [form, setForm] = useState({ client: '', service: 'Manicure', date: '', time: '09:00', phone: '' })

  function handleSave() {
    if (!form.client || !form.date) return alert('Preencha o nome e a data!')
    setSaved(true)
    setTimeout(() => { setModal(false); setSaved(false) }, 2000)
  }

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'system-ui, sans-serif', background: '#f2f1ec' }}>

      {/* SIDEBAR */}
      <div style={{ width: 228, background: '#0d1f17', display: 'flex', flexDirection: 'column', padding: '24px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '0 8px', marginBottom: 32 }}>
          <div style={{ width: 30, height: 30, background: '#34d399', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 16, color: '#0d1f17' }}>A</div>
          <span style={{ fontSize: 19, fontWeight: 600, color: '#fff', letterSpacing: -0.5 }}>agen<span style={{ color: '#34d399' }}>dei</span></span>
        </div>

        <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {[
            { icon: '📅', label: 'Agenda',        active: true  },
            { icon: '👥', label: 'Clientes',       active: false },
            { icon: '✂️', label: 'Serviços',       active: false },
            { icon: '💰', label: 'Financeiro',     active: false },
            { icon: '⭐', label: 'Avaliações',     active: false },
            { icon: '⚙️', label: 'Configurações',  active: false },
          ].map(item => (
            <div key={item.label} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '9px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 13.5,
              background: item.active ? 'rgba(52,211,153,0.14)' : 'transparent',
              color: item.active ? '#34d399' : 'rgba(255,255,255,0.45)',
              fontWeight: item.active ? 500 : 400,
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

      {/* MAIN */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 22 }}>

        {/* TOP BAR */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: -0.5, margin: 0 }}>Olá, Maria! ☀️</h1>
            <p style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>Domingo, 12 de abril de 2026 · 4 agendamentos hoje</p>
          </div>
          <button onClick={() => setModal(true)} style={{
            background: '#0d1f17', color: '#fff', border: 'none',
            padding: '9px 16px', borderRadius: 9, fontSize: 13, fontWeight: 600,
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6
          }}>＋ Novo agendamento</button>
        </div>

        {/* STATS */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
          {[
            { label: 'Hoje',           value: '4',      sub: 'agendamentos',   tag: '+2 vs ontem', tagColor: '#dcfce7', tagText: '#166534' },
            { label: 'Receita do dia', value: 'R$ 420', sub: 'previsto',       tag: '↑ 18%',       tagColor: '#dcfce7', tagText: '#166534' },
            { label: 'Clientes ativos',value: '134',    sub: 'total na base',  tag: '+12 no mês',  tagColor: '#dbeafe', tagText: '#1e40af' },
            { label: 'Avaliação',      value: '4.9 ⭐', sub: '47 avaliações',  tag: 'Top profissional', tagColor: '#dcfce7', tagText: '#166534' },
          ].map(s => (
            <div key={s.label} style={{ background: '#fff', borderRadius: 12, padding: '16px 18px', border: '1px solid rgba(0,0,0,0.08)' }}>
              <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>{s.label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.5 }}>{s.value}</div>
              <div style={{ fontSize: 11.5, color: '#6b7280', marginTop: 4 }}>{s.sub}</div>
              <span style={{ display: 'inline-block', fontSize: 10.5, padding: '2px 7px', borderRadius: 99, fontWeight: 600, marginTop: 5, background: s.tagColor, color: s.tagText }}>{s.tag}</span>
            </div>
          ))}
        </div>

        {/* AGENDA */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 15, fontWeight: 600 }}>Agenda de hoje</span>
            <span style={{ fontSize: 12.5, color: '#6b7280', cursor: 'pointer' }}>Ver semana →</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {appointments.map(ap => (
              <div key={ap.time} style={{
                background: '#fff', borderRadius: 12, padding: '14px 18px',
                border: '1px solid rgba(0,0,0,0.08)', display: 'flex',
                alignItems: 'center', gap: 14, cursor: 'pointer'
              }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: '#9ca3af', minWidth: 44 }}>{ap.time}</div>
                <div style={{ width: 3, height: 40, borderRadius: 99, background: ap.bar, flexShrink: 0 }} />
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: ap.color, color: ap.text, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{ap.initials}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 500 }}>{ap.name}</div>
                  <div style={{ fontSize: 12, color: '#6b7280', marginTop: 1 }}>{ap.service}</div>
                  <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>⏱ {ap.duration}</div>
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

      {/* MODAL */}
      {modal && (
        <div onClick={e => e.target === e.currentTarget && setModal(false)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50
        }}>
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
                  { label: 'Cliente', key: 'client', type: 'text', placeholder: 'Nome do cliente' },
                  { label: 'WhatsApp', key: 'phone', type: 'tel', placeholder: '(67) 99999-0000' },
                ].map(f => (
                  <div key={f.key} style={{ marginBottom: 13 }}>
                    <label style={{ fontSize: 12.5, fontWeight: 500, color: '#6b7280', display: 'block', marginBottom: 5 }}>{f.label}</label>
                    <input type={f.type} placeholder={f.placeholder} value={(form as any)[f.key]}
                      onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                      style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #e5e7eb', borderRadius: 8, fontSize: 14, fontFamily: 'inherit', outline: 'none' }} />
                  </div>
                ))}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 13 }}>
                  <div>
                    <label style={{ fontSize: 12.5, fontWeight: 500, color: '#6b7280', display: 'block', marginBottom: 5 }}>Serviço</label>
                    <select value={form.service} onChange={e => setForm({ ...form, service: e.target.value })}
                      style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #e5e7eb', borderRadius: 8, fontSize: 14, fontFamily: 'inherit', outline: 'none' }}>
                      {services.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 12.5, fontWeight: 500, color: '#6b7280', display: 'block', marginBottom: 5 }}>Horário</label>
                    <input type="time" value={form.time} onChange={e => setForm({ ...form, time: e.target.value })}
                      style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #e5e7eb', borderRadius: 8, fontSize: 14, fontFamily: 'inherit', outline: 'none' }} />
                  </div>
                </div>
                <div style={{ marginBottom: 13 }}>
                  <label style={{ fontSize: 12.5, fontWeight: 500, color: '#6b7280', display: 'block', marginBottom: 5 }}>Data</label>
                  <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #e5e7eb', borderRadius: 8, fontSize: 14, fontFamily: 'inherit', outline: 'none' }} />
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
                  <button onClick={() => setModal(false)} style={{ flex: 1, padding: 9, border: '1.5px solid #e5e7eb', borderRadius: 8, fontSize: 13.5, fontWeight: 500, background: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>Cancelar</button>
                  <button onClick={handleSave} style={{ flex: 2, padding: 9, border: 'none', borderRadius: 8, fontSize: 13.5, fontWeight: 700, background: '#0d1f17', color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>Confirmar agendamento</button>
                </div>
                <button onClick={() => alert('📲 Notificação WhatsApp enviada!')} style={{ width: '100%', padding: 10, border: 'none', borderRadius: 8, fontSize: 13.5, fontWeight: 700, background: '#22c55e', color: '#fff', cursor: 'pointer', fontFamily: 'inherit', marginTop: 8 }}>📲 Notificar via WhatsApp</button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
