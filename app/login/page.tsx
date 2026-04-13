'use client'
import { useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function Login() {
  const [modo, setModo] = useState<'login' | 'cadastro'>('login')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [nome, setNome] = useState('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [erro, setErro] = useState('')

  async function handleLogin() {
    setLoading(true); setErro(''); setMsg('')
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha })
    if (error) { setErro('E-mail ou senha incorretos.'); setLoading(false); return }
    const { data: profile } = await supabase
      .from('profiles')
      .select('onboarded')
      .eq('id', data.user.id)
      .maybeSingle()
    if (!profile || !profile.onboarded) {
      window.location.href = '/planos'
    } else {
      window.location.href = '/dashboard'
    }
  }

  async function handleCadastro() {
    if (!nome || !email || !senha) { setErro('Preencha todos os campos.'); return }
    if (senha.length < 6) { setErro('A senha precisa ter pelo menos 6 caracteres.'); return }
    setLoading(true); setErro(''); setMsg('')
    const { data, error } = await supabase.auth.signUp({
      email, password: senha,
      options: { data: { nome } }
    })
    if (error) { setErro('Erro ao criar conta. Tente outro e-mail.'); setLoading(false); return }
    if (data.user) {
      await supabase.from('profiles').upsert({
        id: data.user.id,
        email: data.user.email,
        name: nome,
        full_name: nome,
        plan: 'free',
        onboarded: false,
      })
    }
    if (data.session) {
      window.location.href = '/planos'
      return
    }
    setMsg('Conta criada! Verifique seu e-mail para confirmar.')
    setLoading(false)
  }

  const s: Record<string, React.CSSProperties> = {
    page: { minHeight: '100vh', background: '#f2f1ec', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif', padding: 16 },
    wrap: { width: '100%', maxWidth: 400 },
    logo: { textAlign: 'center', marginBottom: 28 },
    logoText: { fontSize: 28, fontWeight: 700, color: '#0d1f17', letterSpacing: -1 },
    logoSpan: { color: '#34d399' },
    tagline: { fontSize: 13.5, color: '#6b7280', marginTop: 4 },
    card: { background: '#fff', borderRadius: 20, padding: '28px 28px 24px', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' },
    tabs: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 24 },
    tab: { padding: '9px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', background: '#fff', color: '#6b7280' },
    tabAct: { padding: '9px', borderRadius: 10, border: '1.5px solid #0d1f17', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', background: '#0d1f17', color: '#fff' },
    label: { fontSize: 12.5, fontWeight: 500, color: '#6b7280', display: 'block', marginBottom: 5 },
    input: { width: '100%', padding: '10px 13px', border: '1.5px solid #e5e7eb', borderRadius: 10, fontSize: 14, fontFamily: 'inherit', outline: 'none', color: '#111827', marginBottom: 13, boxSizing: 'border-box' as const },
    btn: { width: '100%', padding: 13, border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 700, background: '#0d1f17', color: '#fff', cursor: 'pointer', fontFamily: 'inherit', marginTop: 4 },
    erro: { background: '#fee2e2', color: '#dc2626', padding: '10px 13px', borderRadius: 10, fontSize: 13, marginBottom: 14, textAlign: 'center' as const },
    msg: { background: '#dcfce7', color: '#166534', padding: '10px 13px', borderRadius: 10, fontSize: 13, marginBottom: 14, textAlign: 'center' as const },
    divider: { textAlign: 'center' as const, color: '#9ca3af', fontSize: 12, margin: '16px 0' },
    btnGoogle: { width: '100%', padding: 11, border: '1.5px solid #e5e7eb', borderRadius: 12, fontSize: 14, fontWeight: 500, background: '#fff', color: '#111827', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 },
  }

  return (
    <div style={s.page}>
      <div style={s.wrap}>
        <div style={s.logo}>
          <div style={s.logoText}>agen<span style={s.logoSpan}>dei</span></div>
          <div style={s.tagline}>Gerencie seus agendamentos com facilidade</div>
        </div>
        <div style={s.card}>
          <div style={s.tabs}>
            <button style={modo === 'login' ? s.tabAct : s.tab} onClick={() => { setModo('login'); setErro(''); setMsg('') }}>Entrar</button>
            <button style={modo === 'cadastro' ? s.tabAct : s.tab} onClick={() => { setModo('cadastro'); setErro(''); setMsg('') }}>Criar conta</button>
          </div>
          {erro && <div style={s.erro}>{erro}</div>}
          {msg && <div style={s.msg}>{msg}</div>}
          {modo === 'cadastro' && (
            <div>
              <label style={s.label}>Seu nome</label>
              <input style={s.input} type="text" placeholder="Ex: Maria Silva" value={nome} onChange={e => setNome(e.target.value)} />
            </div>
          )}
          <label style={s.label}>E-mail</label>
          <input style={s.input} type="email" placeholder="seu@email.com" value={email} onChange={e => setEmail(e.target.value)} />
          <label style={s.label}>Senha</label>
          <input
            style={s.input}
            type="password"
            placeholder={modo === 'cadastro' ? 'Minimo 6 caracteres' : '••••••••'}
            value={senha}
            onChange={e => setSenha(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && (modo === 'login' ? handleLogin() : handleCadastro())}
          />
          <button style={s.btn} onClick={modo === 'login' ? handleLogin : handleCadastro} disabled={loading}>
            {loading ? 'Aguarde...' : modo === 'login' ? 'Entrar na conta' : 'Criar conta gratis'}
          </button>
          <div style={s.divider}>ou</div>
          <button
            style={s.btnGoogle}
            onClick={async () => {
              await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: { redirectTo: window.location.origin + '/auth/callback' },
              })
            }}
          >
            <svg width="18" height="18" viewBox="0 0 48 48">
              <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.2l6.7-6.7C35.8 2.5 30.2 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.8 6C12.4 13 17.8 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h12.4c-.5 2.8-2.1 5.2-4.5 6.8l7 5.4c4.1-3.8 6.5-9.4 6.5-16.2z"/>
              <path fill="#FBBC05" d="M10.5 28.6A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.7-4.6l-7.8-6A23.9 23.9 0 0 0 0 24c0 3.9.9 7.5 2.7 10.7l7.8-6.1z"/>
              <path fill="#34A853" d="M24 48c6.2 0 11.4-2 15.2-5.5l-7-5.4c-2 1.4-4.6 2.2-8.2 2.2-6.2 0-11.5-4.2-13.4-9.8l-7.8 6C6.6 42.6 14.6 48 24 48z"/>
            </svg>
            Continuar com Google
          </button>
          {modo === 'login' && (
            <p style={{ textAlign: 'center', fontSize: 12.5, color: '#9ca3af', marginTop: 16, marginBottom: 0 }}>
              Nao tem conta?{' '}
              <span style={{ color: '#059669', fontWeight: 600, cursor: 'pointer' }} onClick={() => setModo('cadastro')}>
                Criar agora
              </span>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
