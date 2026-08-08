import { z } from "zod";
import { sport_id_schema } from "../../domain/session";

const color_schema = z.string().regex(/^#[0-9a-fA-F]{6}$/);

export const team_profile_schema = z
  .object({
    id: z.string().min(1),
    display_name: z.string().min(1),
    abbreviation: z.string().min(1).max(16),
    light: color_schema,
    dark: color_schema,
    text: color_schema
  })
  .strict();

export const sport_appearance_schema = z
  .object({
    sport: sport_id_schema,
    home_profile_id: z.string().min(1),
    away_profile_id: z.string().min(1),
    token_overrides: z.record(z.string(), color_schema)
  })
  .strict();

export const appearance_payload_schema = z
  .object({
    schema_version: z.literal(1),
    sport: sport_id_schema,
    profiles: z.array(team_profile_schema).min(2),
    appearance: sport_appearance_schema
  })
  .strict()
  .refine((payload) => payload.appearance.sport === payload.sport, {
    message: "Appearance sport does not match payload sport"
  });
