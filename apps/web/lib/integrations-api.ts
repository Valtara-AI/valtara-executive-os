import { apiFetch } from "./api-client";

export interface IntegrationStatus {
  provider: string;
  connected: boolean;
}

export function listIntegrations(accessToken: string): Promise<IntegrationStatus[]> {
  return apiFetch("/api/v1/integrations", accessToken);
}

export function getAuthorizationUrl(
  accessToken: string,
  provider: string,
): Promise<{ url: string }> {
  return apiFetch(`/api/v1/integrations/${provider}/authorize`, accessToken);
}

export function disconnectIntegration(
  accessToken: string,
  provider: string,
): Promise<IntegrationStatus> {
  return apiFetch(`/api/v1/integrations/${provider}`, accessToken, { method: "DELETE" });
}
