import type { Metadata } from 'next'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function getProfissional(slug: string) {
  // Tenta pelo slug personalizado
  const { data: bySlug } = await supabaseAdmin
    .from('profiles')
    .select('nome, descricao, avaliacao_media')
    .eq('slug', slug)
    .single()
  if (bySlug) return bySlug

  // Tenta pelo ID
  const { data: byId } = await supabaseAdmin
    .from('profiles')
    .select('nome, descricao, avaliacao_media')
    .eq('id', slug)
    .single()
  return byId
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params
  const prof = await getProfissional(slug)

  const nome = prof?.nome || 'Profissional'
  const descricao = prof?.descricao || 'Agende seu horário de forma rápida e fácil.'
  const avaliacao = prof?.avaliacao_media ? `⭐ ${Number(prof.avaliacao_media).toFixed(1)} · ` : ''
  const baseUrl = 'https://www.appdamarei.com'
  const ogImage = `${baseUrl}/api/og?nome=${encodeURIComponent(nome)}&desc=${encodeURIComponent(descricao.slice(0, 80))}`

  return {
    title: `Agendar com ${nome} · Marei`,
    description: `${avaliacao}${descricao}`,
    openGraph: {
      title: `Agendar com ${nome}`,
      description: `${avaliacao}${descricao}`,
      url: `${baseUrl}/agendar/${slug}`,
      siteName: 'Marei',
      images: [{ url: ogImage, width: 1200, height: 630, alt: `Agendar com ${nome}` }],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: `Agendar com ${nome}`,
      description: descricao,
      images: [ogImage],
    },
  }
}

export default function AgendarLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
