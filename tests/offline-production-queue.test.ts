import { indexedDB } from "fake-indexeddb";
import { beforeAll, describe, expect, it, vi } from "vitest";

class MemoryStorage implements Storage {
  private values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  clear() {
    this.values.clear();
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  setItem(key: string, value: string) {
    this.values.set(key, String(value));
  }
}

const localStorage = new MemoryStorage();
const events = new EventTarget();
const cacheDelete = vi.fn(async () => true);
const serviceWorkerMessage = vi.fn();

beforeAll(() => {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      indexedDB,
      localStorage,
      caches: {
        keys: vi.fn(async () => ["old-private-cache", "public-cache"]),
        delete: cacheDelete,
      },
      addEventListener: events.addEventListener.bind(events),
      removeEventListener: events.removeEventListener.bind(events),
      dispatchEvent: events.dispatchEvent.bind(events),
    },
  });
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      onLine: true,
      serviceWorker: { controller: { postMessage: serviceWorkerMessage } },
    },
  });
});

describe("offline production queue ownership", () => {
  it("blocks legacy items, isolates users and syncs only the owner", async () => {
    const session = await import("@/lib/offline-session");
    session.setActiveOfflineUserId("user-a");
    localStorage.setItem(
      "gn:pendentes",
      JSON.stringify([
        {
          client_id: "legacy-item-001",
          ts: Date.UTC(2026, 8, 1),
          equipe_id: "equipe-1",
          atividade_id: "atividade-1",
          projeto_id: "projeto-1",
          talhao: "T-01",
          quantidade: 10,
        },
      ]),
    );

    const queue = await import("@/lib/offline-production-queue");
    const legacySnapshot = await queue.getOfflineProductionSnapshot();
    expect(legacySnapshot.total).toBe(0);
    expect(legacySnapshot.unassigned).toBe(1);
    expect(localStorage.getItem("gn:pendentes")).toBeNull();

    await expect(queue.claimUnassignedOfflineProductions()).resolves.toBe(1);
    const claimed = await queue.listOfflineProductions();
    expect(claimed).toHaveLength(1);
    expect(claimed[0]).toMatchObject({
      clientId: "legacy-item-001",
      ownerUserId: "user-a",
      status: "pending",
      lastError: null,
    });

    session.setActiveOfflineUserId("user-b");
    expect(await queue.listOfflineProductions()).toEqual([]);
    await queue.enqueueOfflineProduction({
      client_id: "user-b-item-001",
      equipe_id: "equipe-2",
      atividade_id: "atividade-2",
      projeto_id: "projeto-2",
      talhao: "T-02",
      quantidade: 5,
    });
    expect((await queue.getOfflineProductionSnapshot()).total).toBe(1);

    const sentPayloads: Array<Record<string, unknown>> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        sentPayloads.push(JSON.parse(String(init?.body)));
        return Response.json({ item: { id: "saved" } }, { status: 201 });
      }),
    );

    session.setActiveOfflineUserId("user-a");
    const result = await queue.flushOfflineProductions();
    expect(result).toMatchObject({ attempted: 1, sent: 1, failed: 0, remaining: 0 });
    expect(sentPayloads[0]).toMatchObject({
      client_id: "legacy-item-001",
      client_user_id: "user-a",
    });

    session.setActiveOfflineUserId("user-b");
    const userBItems = await queue.listOfflineProductions();
    expect(userBItems).toHaveLength(1);
    expect(userBItems[0].ownerUserId).toBe("user-b");

    (navigator as { onLine: boolean }).onLine = false;
    await expect(queue.flushOfflineProductions()).resolves.toMatchObject({
      attempted: 0,
      failed: 1,
      remaining: 1,
      lastError: "Sem conexão com a internet.",
    });

    (navigator as { onLine: boolean }).onLine = true;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({ error: "Saldo insuficiente." }, { status: 400 }),
      ),
    );
    await expect(queue.flushOfflineProductions()).resolves.toMatchObject({
      attempted: 1,
      sent: 0,
      failed: 1,
      remaining: 1,
      lastError: "Saldo insuficiente.",
    });
    expect((await queue.listOfflineProductions())[0]).toMatchObject({
      status: "failed",
      lastError: "Saldo insuficiente.",
    });

    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("offline"))));
    await expect(queue.flushOfflineProductions()).resolves.toMatchObject({
      failed: 1,
      remaining: 1,
      lastError: "Sem conexão estável para enviar este lançamento.",
    });

    const listener = vi.fn();
    const unsubscribe = queue.subscribeOfflineProductions(listener);
    window.dispatchEvent(new CustomEvent("gn:offline-production-queue-changed"));
    expect(listener).toHaveBeenCalled();
    unsubscribe();

    await expect(queue.claimUnassignedOfflineProductions()).resolves.toBe(0);
  });

  it("clears session caches without deleting IndexedDB queue data", async () => {
    const session = await import("@/lib/offline-session");
    const { clearAuthenticatedClientState } = await import("@/lib/logout-client");
    session.setActiveOfflineUserId("user-b");

    await clearAuthenticatedClientState();

    expect(session.getActiveOfflineUserId()).toBeNull();
    expect(cacheDelete).toHaveBeenCalledTimes(2);
    expect(serviceWorkerMessage).toHaveBeenCalledWith({ type: "CLEAR_USER_DATA" });

    const queue = await import("@/lib/offline-production-queue");
    await expect(queue.enqueueOfflineProduction({ quantidade: 1 })).rejects.toThrow(
      "Usuário ativo não identificado.",
    );
    await expect(queue.flushOfflineProductions()).resolves.toMatchObject({
      attempted: 0,
      lastError: "Usuário ativo não identificado.",
    });
  });
});
