import type { ZodType } from "zod";
import type { SportId, TransmissionSource } from "../domain/session";

export type { SportId, TransmissionSource } from "../domain/session";

export type SvgBinding<TView> =
  | {
      operation: "text";
      selector: string;
      value: (view: TView) => string;
    }
  | {
      operation: "attribute";
      selector: string;
      attribute: string;
      value: (view: TView) => string;
    }
  | {
      operation: "visibility";
      selector: string;
      visible: (view: TView) => boolean;
    }
  | {
      operation: "style";
      selector: string;
      property: string;
      value: (view: TView) => string;
    };

export type ControlInput = number | string | boolean | { minutes: number; seconds: number };

export interface ControlDefinition<TScore> {
  id: string;
  label: string;
  kind: "counter" | "toggle" | "choice" | "clock" | "action";
  shortcut?: string;
  shortcut_delta?: number;
  min?: number;
  max?: number;
  options?: readonly { value: string; label: string }[];
  value(score: TScore): ControlInput;
  reduce(score: TScore, input: ControlInput): TScore;
}

export type AppearanceDefinition = Record<string, unknown>;

export interface SportModule<TScore, TView> {
  id: SportId;
  display_name: string;
  supported_sources: readonly TransmissionSource[];
  score_schema: ZodType<TScore>;
  initial_score: TScore;
  derive_view(score: TScore): TView;
  bindings: readonly SvgBinding<TView>[];
  controls: readonly ControlDefinition<TScore>[];
  appearance: AppearanceDefinition;
}
