import type { DelegateLink } from "@nyxor/shared";
import { apiFetch } from "./api-client";

export function listPendingInvitations(accessToken: string): Promise<DelegateLink[]> {
  return apiFetch("/api/v1/delegate/invitations", accessToken);
}

export function acceptInvitation(accessToken: string, linkId: string): Promise<DelegateLink> {
  return apiFetch(`/api/v1/delegate/invitations/${linkId}/accept`, accessToken, { method: "POST" });
}

export function declineInvitation(accessToken: string, linkId: string): Promise<DelegateLink> {
  return apiFetch(`/api/v1/delegate/invitations/${linkId}/decline`, accessToken, {
    method: "POST",
  });
}
