import type { SportId } from "../domain/session";
import type { SportModule } from "./types";
import { baseball_module } from "./baseball/module";
import { basketball_module } from "./basketball/module";
import { football_module } from "./football/module";

export type AnySportModule = SportModule<any, any>;

const sport_registry = new Map<SportId, AnySportModule>();
const sport_order: readonly SportId[] = ["baseball", "basketball", "football"];

export function register_sport(sport: AnySportModule): void {
  if (sport_registry.has(sport.id)) {
    throw new Error(`Sport already registered: ${sport.id}`);
  }

  sport_registry.set(sport.id, sport);
}

export function get_sport(id: SportId): AnySportModule {
  const sport = sport_registry.get(id);

  if (sport === undefined) {
    throw new Error(`Unknown sport: ${id}`);
  }

  return sport;
}

export function list_sports(): readonly AnySportModule[] {
  return Object.freeze(
    sport_order.flatMap((id) => {
      const sport = sport_registry.get(id);
      return sport === undefined ? [] : [sport];
    })
  );
}

for (const sport of [baseball_module, basketball_module, football_module]) {
  register_sport(sport);
}
