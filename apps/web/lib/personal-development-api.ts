import type {
  PersonalDevelopmentRecommendation,
  PersonalDevRecommendationStatus,
} from "@nyxor/shared";
import { apiFetch } from "./api-client";

export function listRecommendations(
  accessToken: string,
): Promise<PersonalDevelopmentRecommendation[]> {
  return apiFetch("/api/v1/personal-development", accessToken);
}

export function updateRecommendationStatus(
  accessToken: string,
  id: string,
  status: Exclude<PersonalDevRecommendationStatus, "suggested">,
): Promise<PersonalDevelopmentRecommendation> {
  return apiFetch(`/api/v1/personal-development/${id}`, accessToken, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}
