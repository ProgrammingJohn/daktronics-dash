import { updateSVGScorePreviewBasic } from "./wizard/index.js";
import {
  getScore,
  getScoreboardSVG,
  getScoreboardPreferences,
  getScoreboardName,
} from "./api.js";
import { updateSVGScorePreviewBaseball } from "./manual_listeners/baseball.js";
import { updateSVGScorePreviewBaketball } from "./manual_listeners/basketball.js";
import { updateSVGScorePreviewFootball } from "./manual_listeners/football.js";

$(document).ready(async () => {
  const scoreboardName = await getScoreboardName();
  const activeScoreboard = await getScoreboardSVG(scoreboardName);
  const scoreboardPreferences = await getScoreboardPreferences(scoreboardName);

  $(".svg-score").html(activeScoreboard);
  const svgElement = $(".svg-score svg");
  const rootStyle = svgElement[0].style;
  for (const [key, value] of Object.entries(scoreboardPreferences)) {
    if (key === "home_team_name" || key === "away_team_name") {
      $(`#${key}`).text(value);
    } else {
      rootStyle.setProperty(`--${key}`, value);
    }
  }

  setInterval(async () => {
    const score = await getScore();
    updateSVGScorePreviewBasic(score);
    if (scoreboardName === "baseball") {
      updateSVGScorePreviewBaseball(score);
    } else if (scoreboardName == "basketball") {
      updateSVGScorePreviewBaketball(score);
    } else if (scoreboardName == "football") {
      updateSVGScorePreviewFootball(score);
    }
  }, 1000);
});
