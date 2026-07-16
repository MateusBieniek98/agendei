import { describe, expect, it } from "vitest";
import { isWebhookConfigurationError } from "@/lib/google-sheets-apontamentos";

describe("fila do Google Sheets", () => {
  it("não consome tentativas quando o deployment está mal configurado", () => {
    expect(
      isWebhookConfigurationError(
        "Falha ao atualizar Apontamentos App: HTTP 404. O Google retornou uma pagina HTML em vez de JSON."
      )
    ).toBe(true);
    expect(isWebhookConfigurationError("URL de webhook invalida: esperava /exec")).toBe(true);
  });

  it("mantém falhas transitórias na política normal de backoff", () => {
    expect(isWebhookConfigurationError("The operation was aborted due to timeout")).toBe(false);
    expect(isWebhookConfigurationError("Falha ao atualizar Apontamentos App: HTTP 503")).toBe(
      false
    );
  });
});
