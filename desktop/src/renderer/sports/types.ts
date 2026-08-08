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

export type ControlDefinition<TScore> = Record<string, unknown> & {
  readonly __score?: TScore;
};

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
