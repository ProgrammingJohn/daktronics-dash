import baseball_svg from "../../../../scoreboard_svgs/baseball.svg?raw";
import basketball_svg from "../../../../scoreboard_svgs/basketball.svg?raw";
import football_svg from "../../../../scoreboard_svgs/football.svg?raw";
import type { SportId } from "../domain/session";

export const sport_svgs: Record<SportId, string> = {
  baseball: baseball_svg,
  basketball: basketball_svg,
  football: football_svg
};
