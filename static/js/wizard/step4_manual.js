import { startService, updateScore } from "../api.js";
import { initBaseballControls } from "../manual_listeners/baseball.js";
import { initBasketballControls } from "../manual_listeners/basketball.js";
import { initFootballControls } from "../manual_listeners/football.js";
import { StateHandler } from "../state.js";

export const initStep4Manual = async () => {
  $(".wizard-step").hide();
  $("#wizard_step4_manual").show();
  StateHandler.setState("currentProgressBarStep", 4);
  const scoreboard_name = StateHandler.getState("selectedScoreboard");
  const method = StateHandler.getState("broadcastMethod");
  const scoreboard = StateHandler.getState("activeScoreboard");
  $(".svg-score").html(scoreboard);

  await startService(scoreboard_name, method);

  $(`#manual_${scoreboard_name}`).show();
  if (scoreboard_name === "baseball") {
    initBaseballControls();
  } else if (scoreboard_name === "basketball") {
    initBasketballControls();
  } else if (scoreboard_name === "football") {
    initFootballControls();
  }
  updateScore({ home_score: 99, away_score: 99 });
};
