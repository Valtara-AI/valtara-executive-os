// Zod schema mirroring the JSON shape requested in
// prompts/personal-development/generate-recommendations.v1.hbs. Used by
// completeStructured() to validate LLM output before persisting.

import { z } from "zod";

export const MIN_PERSONAL_DEV_RECOMMENDATIONS = 3;
export const MAX_PERSONAL_DEV_RECOMMENDATIONS = 5;

export const PersonalDevRecommendationSchema = z.object({
  recommendations: z
    .array(
      z.object({
        type: z.enum(["book", "podcast", "publication"]),
        title: z.string(),
        creator: z.string().nullable(),
        rationale: z.string(),
      }),
    )
    .min(MIN_PERSONAL_DEV_RECOMMENDATIONS)
    .max(MAX_PERSONAL_DEV_RECOMMENDATIONS),
});
export type PersonalDevRecommendationResult = z.infer<typeof PersonalDevRecommendationSchema>;
