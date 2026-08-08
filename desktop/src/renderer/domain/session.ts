import { z } from "zod";

export const sport_id_schema = z.enum(["baseball", "basketball", "football"]);
export const transmission_source_schema = z.enum(["manual", "synced"]);
export const connection_status_schema = z.enum(["live", "stale", "disconnected"]);

export const session_snapshot_schema = z.object({
  session: z.object({
    session_id: z.string().min(1),
    sport: sport_id_schema,
    source: transmission_source_schema,
    control_authority: z.enum(["daktronics", "manual"])
  }),
  connection: z.object({
    status: connection_status_schema,
    backend_status: z.string(),
    last_update_at: z.string().nullable(),
    source_age_ms: z.number().nonnegative().nullable(),
    message: z.string().nullable()
  }),
  scoreboard: z.object({
    revision: z.number().int().nonnegative(),
    fields: z.record(z.string(), z.unknown())
  })
});

export type SportId = z.infer<typeof sport_id_schema>;
export type TransmissionSource = z.infer<typeof transmission_source_schema>;
export type ConnectionStatus = z.infer<typeof connection_status_schema>;
export type SessionSnapshot = z.infer<typeof session_snapshot_schema>;
