-- GN App · configurações editáveis do app
-- Rode no SQL Editor do Supabase para habilitar a edição do texto da tela de entrada.

create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;

drop policy if exists app_settings_read on public.app_settings;
create policy app_settings_read on public.app_settings
  for select using (true);

drop policy if exists app_settings_admin_write on public.app_settings;
create policy app_settings_admin_write on public.app_settings
  for all using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

grant select on public.app_settings to anon, authenticated;
grant insert, update, delete on public.app_settings to authenticated;

insert into public.app_settings (key, value)
values (
  'login_content',
  jsonb_build_object(
    'eyebrow', 'GN Silvicultura',
    'title', 'Gestão de produção no campo, sem fricção.',
    'subtitle', 'Lançamentos diários, controle de máquinas e dashboards em tempo real para a operação de silvicultura da GN.',
    'footer', '© GN — todos os direitos reservados.',
    'buttonLabel', 'Entrar'
  )
)
on conflict (key) do nothing;
