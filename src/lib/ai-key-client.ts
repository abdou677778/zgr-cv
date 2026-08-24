import { authenticatedFetch } from "@/lib/auth-client";
import type { AiModelOption, AiProviderId } from "@/lib/ai-types";

export type ManagedAiKey = {
  id: string;
  label: string;
  last4: string;
  createdAt: string;
  priority: number;
};

export type AiKeyStatus = Record<
  AiProviderId,
  { environmentCount: number; managed: ManagedAiKey[] }
>;

async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await authenticatedFetch(path, init);
  const body = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(body.error || `Opération refusée (${response.status}).`);
  return body;
}

export async function getAiKeyStatus() {
  return (await apiJson<{ providers: AiKeyStatus }>("/api/admin/ai-keys")).providers;
}

export async function saveAiKey(input: {
  provider: AiProviderId;
  key: string;
  label: string;
  mode: "add" | "replace";
  model?: string;
}) {
  return apiJson<{
    ok: boolean;
    id: string;
    last4: string;
    model: string;
    models: AiModelOption[];
    generationVerified: boolean;
    tokens: number;
  }>("/api/admin/ai-keys", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function removeAiKey(id: string) {
  return apiJson<{ ok: boolean }>(`/api/admin/ai-keys/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}
