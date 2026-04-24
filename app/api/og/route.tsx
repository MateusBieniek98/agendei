import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'

export const runtime = 'edge'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const nome = searchParams.get('nome') || 'Profissional'
  const desc = searchParams.get('desc') || 'Agende seu horário de forma rápida e fácil.'
  const isHome = nome === 'Marei'

  const initials = nome
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px',
          height: '630px',
          display: 'flex',
          flexDirection: 'column',
          background: '#0d1f17',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Background gradients */}
        <div style={{
          position: 'absolute', top: -200, right: -200,
          width: 600, height: 600, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(52,211,153,0.15) 0%, transparent 70%)',
          display: 'flex',
        }} />
        <div style={{
          position: 'absolute', bottom: -150, left: -100,
          width: 400, height: 400, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(52,211,153,0.08) 0%, transparent 70%)',
          display: 'flex',
        }} />

        <div style={{
          display: 'flex', flexDirection: 'column',
          padding: '60px 80px', height: '100%', justifyContent: 'space-between',
        }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 48, height: 48, borderRadius: 12,
              background: '#34d399',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22, fontWeight: 800, color: '#0d1f17',
            }}>M</div>
            <span style={{ fontSize: 28, fontWeight: 700, color: '#ffffff', letterSpacing: -0.5 }}>
              ma<span style={{ color: '#34d399' }}>rei</span>
            </span>
          </div>

          {/* Middle */}
          {isHome ? (
            // Home page layout
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ fontSize: 18, color: '#34d399', fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase' }}>
                Para profissionais autônomos
              </div>
              <div style={{ fontSize: 64, fontWeight: 800, color: '#ffffff', letterSpacing: -2, lineHeight: 1.1 }}>
                Seus agendamentos,{'\n'}
                <span style={{ color: '#34d399' }}>do seu jeito.</span>
              </div>
              <div style={{ fontSize: 24, color: 'rgba(255,255,255,0.6)', lineHeight: 1.4, maxWidth: 700 }}>
                Página personalizada · WhatsApp automático · Avaliações · Gestão de clientes
              </div>
            </div>
          ) : (
            // Professional booking page layout
            <div style={{ display: 'flex', alignItems: 'center', gap: 40 }}>
              <div style={{
                width: 140, height: 140, borderRadius: '50%',
                background: 'linear-gradient(135deg, #34d399, #059669)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 52, fontWeight: 800, color: '#fff', flexShrink: 0,
                border: '4px solid rgba(52,211,153,0.3)',
              }}>
                {initials}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ fontSize: 18, color: '#34d399', fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase' }}>
                  Agendamento online
                </div>
                <div style={{ fontSize: 58, fontWeight: 800, color: '#ffffff', letterSpacing: -2, lineHeight: 1.1 }}>
                  {nome}
                </div>
                <div style={{ fontSize: 24, color: 'rgba(255,255,255,0.6)', lineHeight: 1.4, maxWidth: 580 }}>
                  {desc}
                </div>
              </div>
            </div>
          )}

          {/* Bottom CTA */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              background: '#34d399', borderRadius: 50, padding: '14px 32px',
            }}>
              <span style={{ fontSize: 22, fontWeight: 700, color: '#0d1f17' }}>
                {isHome ? '🚀 Comece grátis' : '📅 Agendar agora'}
              </span>
            </div>
            <div style={{ fontSize: 18, color: 'rgba(255,255,255,0.3)' }}>
              appdamarei.com
            </div>
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  )
}
