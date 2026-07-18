"use client";

import { useEffect, useMemo, useState } from "react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import { Card } from "@/components/ui/Card";
import ListControls, { searchItems, visibleItems } from "@/components/ui/ListControls";
import Badge from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import PageHeader from "@/components/ui/PageHeader";
import type { Equipe, Profile, UserRole } from "@/lib/types";

type ProfileWithEquipe = Profile & {
  equipes: { nome: string } | null;
  profile_missing?: boolean;
  auth_missing?: boolean;
  last_sign_in_at?: string | null;
  email_confirmed_at?: string | null;
};

const ROLES: { value: UserRole; label: string }[] = [
  { value: "encarregado", label: "Encarregado" },
  { value: "admin", label: "Admin" },
  { value: "gestor", label: "Gestor" },
  { value: "manutencao", label: "Manutenção" },
];

function roleLabel(role: UserRole) {
  return ROLES.find((item) => item.value === role)?.label ?? role;
}

function roleTone(role: UserRole) {
  if (role === "admin") return "danger" as const;
  if (role === "gestor") return "info" as const;
  if (role === "manutencao") return "warning" as const;
  return "success" as const;
}

type NovoUsuario = {
  email: string;
  senha: string;
  nome: string;
  role: UserRole;
  equipe_id: string;
};

const NOVO_VAZIO: NovoUsuario = {
  email: "",
  senha: "",
  nome: "",
  role: "encarregado",
  equipe_id: "",
};

export default function UsuariosPage() {
  const { toast } = useToast();
  const [items, setItems] = useState<ProfileWithEquipe[]>([]);
  const [equipes, setEquipes] = useState<Equipe[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erroCarregamento, setErroCarregamento] = useState("");
  const [avisoCarregamento, setAvisoCarregamento] = useState("");
  const [criando, setCriando] = useState(false);
  const [novo, setNovo] = useState<NovoUsuario>(NOVO_VAZIO);
  const [enviando, setEnviando] = useState(false);
  const [resetando, setResetando] = useState<ProfileWithEquipe | null>(null);
  const [novaSenha, setNovaSenha] = useState("");
  const [busca, setBusca] = useState("");
  const [roleFiltro, setRoleFiltro] = useState("");
  const [statusFiltro, setStatusFiltro] = useState("ativos");
  const [expandida, setExpandida] = useState(false);

  async function carregar() {
    setCarregando(true);
    setErroCarregamento("");
    setAvisoCarregamento("");
    try {
      const [usuariosResponse, equipesResponse] = await Promise.all([
        fetch("/api/usuarios", { cache: "no-store" }),
        fetch("/api/equipes", { cache: "no-store" }),
      ]);

      const [u, e] = await Promise.all([
        usuariosResponse.json().catch(() => ({})),
        equipesResponse.json().catch(() => ({})),
      ]);

      if (!usuariosResponse.ok) {
        throw new Error(u.error ?? `Falha ao carregar usuários (${usuariosResponse.status})`);
      }
      if (!equipesResponse.ok) {
        throw new Error(e.error ?? `Falha ao carregar equipes (${equipesResponse.status})`);
      }

      setItems(Array.isArray(u.items) ? (u.items as ProfileWithEquipe[]) : []);
      setEquipes(Array.isArray(e.items) ? (e.items as Equipe[]) : []);
      if (typeof u.warning === "string" && u.warning) {
        setAvisoCarregamento(u.warning);
      }
    } catch (err) {
      setItems([]);
      setEquipes([]);
      const message = (err as Error).message;
      setErroCarregamento(message);
      toast(`Erro ao carregar usuários: ${message}`, "error");
    } finally {
      setCarregando(false);
    }
  }
  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function patch(id: string, body: Partial<Profile>) {
    const r = await fetch("/api/usuarios", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, ...body }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) toast(`Erro ao atualizar: ${j.error ?? r.statusText}`, "error");
    else {
      toast("Atualizado.", "success");
      carregar();
    }
  }

  async function excluirUsuario(usuario: ProfileWithEquipe) {
    const ok = window.confirm(
      `Excluir ${usuario.nome}?\n\nUsuários sem histórico serão removidos. Se existir apontamento, manutenção ou auditoria, o acesso será desativado e sairá da lista principal para preservar os dados.`
    );
    if (!ok) return;

    setEnviando(true);
    try {
      const r = await fetch("/api/usuarios", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: usuario.id }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        toast(`Erro ao excluir: ${j.error ?? r.statusText}`, "error");
        return;
      }
      toast(j.message ?? "Usuário excluído.", "success");
      if (j.mode === "deactivated") setStatusFiltro("ativos");
      await carregar();
    } finally {
      setEnviando(false);
    }
  }

  async function criar() {
    if (!novo.email || !novo.senha || !novo.nome) {
      toast("Preencha nome, e-mail e senha.", "error");
      return;
    }
    if (novo.senha.length < 6) {
      toast("Senha precisa ter ao menos 6 caracteres.", "error");
      return;
    }
    setEnviando(true);
    try {
      const r = await fetch("/api/usuarios/criar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: novo.email,
          senha: novo.senha,
          nome: novo.nome,
          role: novo.role,
          equipe_id: novo.equipe_id || null,
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        toast(`Erro: ${j.error ?? r.statusText}`, "error");
        return;
      }
      toast("Usuário criado!", "success");
      setCriando(false);
      setNovo(NOVO_VAZIO);
      carregar();
    } finally {
      setEnviando(false);
    }
  }

  async function resetSenha() {
    if (!resetando) return;
    if (novaSenha.length < 6) {
      toast("Senha precisa ter ao menos 6 caracteres.", "error");
      return;
    }
    setEnviando(true);
    try {
      const r = await fetch(`/api/usuarios/${resetando.id}/senha`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ senha: novaSenha }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        toast(`Erro: ${j.error ?? r.statusText}`, "error");
        return;
      }
      toast(`Senha de ${resetando.nome} atualizada.`, "success");
      setResetando(null);
      setNovaSenha("");
    } finally {
      setEnviando(false);
    }
  }

  const filtrados = searchItems(
    items.filter((u) => {
      if (roleFiltro && u.role !== roleFiltro) return false;
      if (statusFiltro === "ativos" && !u.ativo) return false;
      if (statusFiltro === "inativos" && u.ativo) return false;
      return true;
    }),
    busca,
    [(u) => u.nome, (u) => u.email, (u) => u.role, (u) => u.equipes?.nome]
  );
  const visiveis = visibleItems(filtrados, expandida, 20);
  const contadores = useMemo(
    () => ({
      total: items.length,
      admin: items.filter((u) => u.role === "admin").length,
      gestor: items.filter((u) => u.role === "gestor").length,
      encarregado: items.filter((u) => u.role === "encarregado").length,
      manutencao: items.filter((u) => u.role === "manutencao").length,
    }),
    [items]
  );

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Acessos"
        title="Usuários"
        subtitle="Crie acessos personalizados, altere papéis, ative/desative ou redefina senhas."
        right={
          <Button className="w-full sm:w-auto" onClick={() => setCriando(true)}>
            + Novo usuário
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Card className="p-4">
          <p className="text-xs font-bold uppercase text-[var(--text-muted)]">
            Total
          </p>
          <p className="mt-1 text-2xl font-bold tabular">{contadores.total}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-bold uppercase text-[var(--text-muted)]">
            Admin
          </p>
          <p className="mt-1 text-2xl font-bold tabular">{contadores.admin}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-bold uppercase text-[var(--text-muted)]">
            Gestor
          </p>
          <p className="mt-1 text-2xl font-bold tabular">{contadores.gestor}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-bold uppercase text-[var(--text-muted)]">
            Encarregado
          </p>
          <p className="mt-1 text-2xl font-bold tabular">{contadores.encarregado}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-bold uppercase text-[var(--text-muted)]">
            Manutenção
          </p>
          <p className="mt-1 text-2xl font-bold tabular">{contadores.manutencao}</p>
        </Card>
      </div>

      <Card>
        <div className="border-b border-[var(--border)] p-4">
          {erroCarregamento && (
            <div className="mb-4 rounded-lg border border-[var(--danger)] bg-[var(--danger-bg)] p-3 text-sm font-bold text-[var(--danger)]">
              Falha ao carregar usuários: {erroCarregamento}
            </div>
          )}
          {avisoCarregamento && (
            <div className="mb-4 rounded-lg border border-[var(--warn)] bg-[var(--warn-bg)] p-3 text-sm font-bold text-[var(--warn)]">
              {avisoCarregamento}
            </div>
          )}
          <ListControls
            search={busca}
            onSearchChange={setBusca}
            expanded={expandida}
            onExpandedChange={setExpandida}
            total={filtrados.length}
            visible={visiveis.length}
            label="Pesquisar usuários"
            placeholder="Nome, e-mail, papel ou equipe"
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Select
                label="Papel"
                value={roleFiltro}
                onChange={(e) => setRoleFiltro(e.target.value)}
                options={ROLES}
                placeholder="todos"
              />
              <label className="text-sm font-bold text-[var(--text-primary)]">
                Status
                <select
                  value={statusFiltro}
                  onChange={(e) => setStatusFiltro(e.target.value)}
                  className="mt-1 h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-input)] px-3 text-sm font-bold text-[var(--text-primary)] shadow-sm"
                >
                  <option value="ativos">ativos</option>
                  <option value="inativos">inativos</option>
                  <option value="">todos</option>
                </select>
              </label>
            </div>
          </ListControls>
        </div>
        <div className="divide-y divide-[var(--border)] lg:hidden">
          {carregando && (
            <div className="p-6 text-center text-sm font-semibold text-[var(--text-muted)]">
              Carregando usuários...
            </div>
          )}
          {visiveis.map((u) => (
            <div key={u.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="break-words text-base font-bold text-[var(--text-primary)]">
                    {u.nome}
                  </p>
                  <p className="mt-1 break-words text-sm font-semibold text-[var(--text-secondary)]">
                    {u.email}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-[var(--text-secondary)]">
                    Equipe: {u.equipes?.nome ?? "sem equipe"}
                  </p>
                  <div className="mt-2">
                    <Badge tone={roleTone(u.role)}>{roleLabel(u.role)}</Badge>
                    {u.profile_missing && (
                      <span className="ml-2">
                        <Badge tone="warning">perfil pendente</Badge>
                      </span>
                    )}
                    {u.auth_missing && (
                      <span className="ml-2">
                        <Badge tone="danger">auth ausente</Badge>
                      </span>
                    )}
                  </div>
                </div>
                {u.ativo ? (
                  <Badge tone="success">ativo</Badge>
                ) : (
                  <Badge tone="danger">inativo</Badge>
                )}
              </div>

              <div className="mt-4 grid gap-3">
                <label className="text-xs font-bold uppercase text-[var(--text-secondary)]">
                  Papel
                  <select
                    value={u.role}
                    onChange={(e) => patch(u.id, { role: e.target.value as UserRole })}
                    className="mt-1 h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-input)] px-3 text-sm font-bold normal-case text-[var(--text-primary)] shadow-sm"
                  >
                    {ROLES.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </label>
                <label className="text-xs font-bold uppercase text-[var(--text-secondary)]">
                  Equipe
                  <select
                    value={u.equipe_id ?? ""}
                    onChange={(e) =>
                      patch(u.id, {
                        equipe_id: e.target.value ? e.target.value : null,
                      })
                    }
                    className="mt-1 h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-input)] px-3 text-sm font-bold normal-case text-[var(--text-primary)] shadow-sm"
                  >
                    <option value="">Sem equipe</option>
                    {equipes.map((eq) => (
                      <option key={eq.id} value={eq.id}>
                        {eq.nome}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
                <Button variant="secondary" onClick={() => setResetando(u)}>
                  Resetar senha
                </Button>
                <Button
                  variant={u.ativo ? "danger" : "primary"}
                  onClick={() => patch(u.id, { ativo: !u.ativo })}
                >
                  {u.ativo ? "Desativar" : "Ativar"}
                </Button>
                <Button
                  variant="danger"
                  onClick={() => excluirUsuario(u)}
                  disabled={enviando}
                >
                  Excluir
                </Button>
              </div>
            </div>
          ))}
          {!carregando && filtrados.length === 0 && (
            <div className="p-6 text-center text-sm font-semibold text-[var(--text-muted)]">
              Nenhum usuário encontrado neste filtro.
            </div>
          )}
        </div>

        <div className="hidden overflow-x-auto lg:block">
          <table className="w-full text-sm">
            <thead className="bg-[var(--bg-card-alt)] text-left text-[var(--text-muted)]">
              <tr>
                <th className="px-4 py-2 font-medium">Nome</th>
                <th className="px-4 py-2 font-medium">E-mail</th>
                <th className="px-4 py-2 font-medium">Papel</th>
                <th className="px-4 py-2 font-medium">Equipe</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {carregando && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-[var(--text-muted)]">
                    Carregando usuários...
                  </td>
                </tr>
              )}
              {visiveis.map((u) => (
                <tr key={u.id} className="border-t border-[var(--border)]">
                  <td className="px-4 py-2">
                    <div className="font-semibold text-[var(--text-primary)]">
                      {u.nome}
                    </div>
                    {(u.profile_missing || u.auth_missing) && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {u.profile_missing && (
                          <Badge tone="warning">perfil pendente</Badge>
                        )}
                        {u.auth_missing && <Badge tone="danger">auth ausente</Badge>}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2 text-[var(--text-secondary)]">{u.email}</td>
                  <td className="px-4 py-2">
                    <select
                      value={u.role}
                      onChange={(e) => patch(u.id, { role: e.target.value as UserRole })}
                      className="rounded-md border border-[var(--border)] bg-[var(--bg-input)] px-2 py-1 text-sm font-semibold text-[var(--text-primary)] shadow-sm"
                    >
                      {ROLES.map((r) => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-2">
                    <select
                      value={u.equipe_id ?? ""}
                      onChange={(e) =>
                        patch(u.id, {
                          equipe_id: e.target.value ? e.target.value : null,
                        })
                      }
                      className="rounded-md border border-[var(--border)] bg-[var(--bg-input)] px-2 py-1 text-sm font-semibold text-[var(--text-primary)] shadow-sm"
                    >
                      <option value="">—</option>
                      {equipes.map((eq) => (
                        <option key={eq.id} value={eq.id}>
                          {eq.nome}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-2">
                    {u.ativo ? (
                      <Badge tone="success">ativo</Badge>
                    ) : (
                      <Badge tone="danger">inativo</Badge>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right whitespace-nowrap">
                    <button
                      onClick={() => setResetando(u)}
                      className="mr-3 text-xs text-[var(--accent)] hover:underline"
                    >
                      resetar senha
                    </button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => patch(u.id, { ativo: !u.ativo })}
                    >
                      {u.ativo ? "desativar" : "ativar"}
                    </Button>
                    <Button
                      className="ml-2"
                      variant="danger"
                      size="sm"
                      onClick={() => excluirUsuario(u)}
                      disabled={enviando}
                    >
                      excluir
                    </Button>
                  </td>
                </tr>
              ))}
              {!carregando && filtrados.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-[var(--text-muted)]">
                    Nenhum usuário encontrado neste filtro.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal: novo usuário */}
      {criando && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50"
          onClick={() => setCriando(false)}
        >
          <div
            className="w-full max-w-md space-y-3 rounded-lg bg-[var(--bg-card)] p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <h3 className="text-lg font-bold">Novo usuário</h3>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                Cria conta com e-mail/senha já confirmados — o usuário pode
                logar imediatamente.
              </p>
            </div>
            <Input
              label="Nome completo"
              value={novo.nome}
              onChange={(e) => setNovo({ ...novo, nome: e.target.value })}
              placeholder="Ex.: João Silva"
            />
            <Input
              label="E-mail"
              type="email"
              value={novo.email}
              onChange={(e) => setNovo({ ...novo, email: e.target.value })}
              placeholder="usuario@gn.com.br"
              autoComplete="off"
            />
            <Input
              label="Senha inicial"
              type="text"
              value={novo.senha}
              onChange={(e) => setNovo({ ...novo, senha: e.target.value })}
              placeholder="mín. 6 caracteres"
              hint="Mostra texto pra você poder repassar pro usuário."
              autoComplete="new-password"
            />
            <Select
              label="Papel"
              value={novo.role}
              onChange={(e) =>
                setNovo({ ...novo, role: e.target.value as UserRole })
              }
              options={ROLES}
            />
            <Select
              label="Equipe (opcional)"
              value={novo.equipe_id}
              onChange={(e) => setNovo({ ...novo, equipe_id: e.target.value })}
              options={equipes.map((eq) => ({ value: eq.id, label: eq.nome }))}
              placeholder="Sem equipe"
            />
            <div className="grid grid-cols-2 gap-2 pt-2">
              <Button variant="ghost" onClick={() => setCriando(false)}>
                Cancelar
              </Button>
              <Button onClick={criar} loading={enviando}>
                Criar usuário
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: reset de senha */}
      {resetando && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50"
          onClick={() => {
            setResetando(null);
            setNovaSenha("");
          }}
        >
          <div
            className="w-full max-w-md space-y-3 rounded-lg bg-[var(--bg-card)] p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold">Redefinir senha</h3>
            <p className="text-sm text-[var(--text-secondary)]">
              Defina uma nova senha para <strong>{resetando.nome}</strong>{" "}
              ({resetando.email}).
            </p>
            <Input
              label="Nova senha"
              type="text"
              value={novaSenha}
              onChange={(e) => setNovaSenha(e.target.value)}
              placeholder="mín. 6 caracteres"
              autoComplete="new-password"
            />
            <div className="grid grid-cols-2 gap-2 pt-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setResetando(null);
                  setNovaSenha("");
                }}
              >
                Cancelar
              </Button>
              <Button onClick={resetSenha} loading={enviando}>
                Atualizar senha
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
