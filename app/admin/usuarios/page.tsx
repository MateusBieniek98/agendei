"use client";

import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import { Card } from "@/components/ui/Card";
import ListControls, { searchItems, visibleItems } from "@/components/ui/ListControls";
import Badge from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import type { Equipe, Profile, UserRole } from "@/lib/types";

type ProfileWithEquipe = Profile & { equipes: { nome: string } | null };

const ROLES: { value: UserRole; label: string }[] = [
  { value: "encarregado", label: "Encarregado" },
  { value: "admin", label: "Admin" },
  { value: "gestor", label: "Gestor" },
];

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
  const [criando, setCriando] = useState(false);
  const [novo, setNovo] = useState<NovoUsuario>(NOVO_VAZIO);
  const [enviando, setEnviando] = useState(false);
  const [resetando, setResetando] = useState<ProfileWithEquipe | null>(null);
  const [novaSenha, setNovaSenha] = useState("");
  const [busca, setBusca] = useState("");
  const [roleFiltro, setRoleFiltro] = useState("");
  const [statusFiltro, setStatusFiltro] = useState("");
  const [expandida, setExpandida] = useState(false);

  async function carregar() {
    try {
      const [u, e] = await Promise.all([
        fetch("/api/usuarios").then((r) => r.json()),
        fetch("/api/equipes").then((r) => r.json()),
      ]);
      setItems(Array.isArray(u.items) ? (u.items as ProfileWithEquipe[]) : []);
      setEquipes(Array.isArray(e.items) ? (e.items as Equipe[]) : []);
    } catch (err) {
      setItems([]);
      setEquipes([]);
      toast(`Erro ao carregar usuários: ${(err as Error).message}`, "error");
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
    if (!r.ok) toast("Erro ao atualizar.", "error");
    else {
      toast("Atualizado.", "success");
      carregar();
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

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Usuários</h1>
          <p className="text-sm font-semibold text-[var(--color-ink-600)]">
            Crie acessos personalizados (encarregado, admin, gestor),
            altere papéis, ative/desative ou redefina senhas.
          </p>
        </div>
        <Button className="w-full sm:w-auto" onClick={() => setCriando(true)}>
          + Novo usuário
        </Button>
      </div>

      <Card>
        <div className="border-b border-[var(--color-ink-100)] p-4">
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
              <label className="text-sm font-bold text-[var(--color-ink-900)]">
                Status
                <select
                  value={statusFiltro}
                  onChange={(e) => setStatusFiltro(e.target.value)}
                  className="mt-1 h-12 w-full rounded-xl border-2 border-[var(--color-ink-300)] bg-white px-3 text-base font-bold text-[var(--color-ink-900)] shadow-sm"
                >
                  <option value="">todos</option>
                  <option value="ativos">ativos</option>
                  <option value="inativos">inativos</option>
                </select>
              </label>
            </div>
          </ListControls>
        </div>
        <div className="divide-y divide-[var(--color-ink-100)] md:hidden">
          {visiveis.map((u) => (
            <div key={u.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="break-words text-base font-bold text-[var(--color-ink-900)]">
                    {u.nome}
                  </p>
                  <p className="mt-1 break-words text-sm font-semibold text-[var(--color-ink-700)]">
                    {u.email}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-[var(--color-ink-700)]">
                    Equipe: {u.equipes?.nome ?? "sem equipe"}
                  </p>
                </div>
                {u.ativo ? (
                  <Badge tone="success">ativo</Badge>
                ) : (
                  <Badge tone="danger">inativo</Badge>
                )}
              </div>

              <div className="mt-4 grid gap-3">
                <label className="text-xs font-bold uppercase text-[var(--color-ink-700)]">
                  Papel
                  <select
                    value={u.role}
                    onChange={(e) => patch(u.id, { role: e.target.value as UserRole })}
                    className="mt-1 h-12 w-full rounded-xl border-2 border-[var(--color-ink-300)] bg-white px-3 text-base font-bold normal-case text-[var(--color-ink-900)] shadow-sm"
                  >
                    {ROLES.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </label>
                <label className="text-xs font-bold uppercase text-[var(--color-ink-700)]">
                  Equipe
                  <select
                    value={u.equipe_id ?? ""}
                    onChange={(e) =>
                      patch(u.id, {
                        equipe_id: e.target.value ? e.target.value : null,
                      })
                    }
                    className="mt-1 h-12 w-full rounded-xl border-2 border-[var(--color-ink-300)] bg-white px-3 text-base font-bold normal-case text-[var(--color-ink-900)] shadow-sm"
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

              <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Button variant="secondary" onClick={() => setResetando(u)}>
                  Resetar senha
                </Button>
                <Button
                  variant={u.ativo ? "danger" : "primary"}
                  onClick={() => patch(u.id, { ativo: !u.ativo })}
                >
                  {u.ativo ? "Desativar" : "Ativar"}
                </Button>
              </div>
            </div>
          ))}
          {filtrados.length === 0 && (
            <div className="p-6 text-center text-sm font-semibold text-[var(--color-ink-600)]">
              Nenhum usuário encontrado neste filtro.
            </div>
          )}
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-sm">
            <thead className="bg-[var(--color-ink-50)] text-[var(--color-ink-500)] text-left">
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
              {visiveis.map((u) => (
                <tr key={u.id} className="border-t border-[var(--color-ink-100)]">
                  <td className="px-4 py-2">{u.nome}</td>
                  <td className="px-4 py-2 text-[var(--color-ink-700)]">{u.email}</td>
                  <td className="px-4 py-2">
                    <select
                      value={u.role}
                      onChange={(e) => patch(u.id, { role: e.target.value as UserRole })}
                      className="rounded-md border-2 border-[var(--color-ink-300)] bg-white px-2 py-1 text-sm font-semibold text-[var(--color-ink-900)] shadow-sm"
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
                      className="rounded-md border-2 border-[var(--color-ink-300)] bg-white px-2 py-1 text-sm font-semibold text-[var(--color-ink-900)] shadow-sm"
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
                      className="text-[var(--color-gn-700)] hover:underline mr-3 text-xs"
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
                  </td>
                </tr>
              ))}
              {filtrados.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-[var(--color-ink-500)]">
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
            className="bg-white rounded-2xl w-full max-w-md p-6 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <h3 className="text-lg font-bold">Novo usuário</h3>
              <p className="text-xs text-[var(--color-ink-500)] mt-1">
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
            className="bg-white rounded-2xl w-full max-w-md p-6 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold">Redefinir senha</h3>
            <p className="text-sm text-[var(--color-ink-700)]">
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
