import {
  startService,
  getScore,
  getScoreboardSVG,
  getScoreboardPreferences,
  getServiceStatus,
} from "../api.js";
import { StateHandler } from "../state.js";
import { updateSVGScorePreviewBasic } from "./index.js";
import { updateSVGScorePreviewBaseball } from "../manual_listeners/baseball.js";
import { updateSVGScorePreviewBaketball } from "../manual_listeners/basketball.js";
import { updateSVGScorePreviewFootball } from "../manual_listeners/football.js";

export const initStep4Synced = async () => {
  $(".wizard-step").hide();
  $("#wizard_step4_synced").show();
  console.log("step 4 synced running")
  StateHandler.setState("currentProgressBarStep", 4);
  const scoreboard_name = StateHandler.getState("selectedScoreboard");
  const ipAddress = StateHandler.getState("ipAddress");
  const port = StateHandler.getState("port");

  const svg = await getScoreboardSVG(scoreboard_name);
  console.log(svg)
  const prefs = await getScoreboardPreferences(scoreboard_name);
  $("#wizard_step4_synced #svg-preview-score").html(svg);
  const svgElement = $("#wizard_step4_synced #svg-preview-score");
  const rootStyle = svgElement[0].style;
  for (const [key, value] of Object.entries(prefs)) {
    if (key === "home_team_name" || key === "away_team_name") {
      svgElement.find(`#${key}`).text(value);
    } else {
      rootStyle.setProperty(`--${key}`, value);
    }
  }

  await startService(scoreboard_name, "synced", ipAddress, port);

  setInterval(async () => {
    const status = await getServiceStatus();
    $("#status_text").text(status.status);
    if (status.status === "connected") {
      const score = await getScore();
      updateSVGScorePreviewBasic(score);
      if (scoreboard_name === "baseball") {
        updateSVGScorePreviewBaseball(score);
      } else if (scoreboard_name === "basketball") {
        updateSVGScorePreviewBaketball(score);
      } else if (scoreboard_name === "football") {
        updateSVGScorePreviewFootball(score);
      }
    }
  }, 1000);
};
