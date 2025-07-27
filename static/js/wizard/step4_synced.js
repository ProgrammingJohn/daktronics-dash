import { startService } from "../api.js";
import { StateHandler } from "../state.js";

export const initStep4Synced = async () => {
  $(".wizard-step").hide();
  $("#wizard_step4_synced").show();
  StateHandler.setState("currentProgressBarStep", 4);
  const scoreboard_name = StateHandler.getState("selectedScoreboard");
  const method = StateHandler.getState("broadcastMethod");
  const scoreboard = StateHandler.getState("activeScoreboard");
  const ipAddress = StateHandler.getState("ipAddress");
  const port = StateHandler.getState("port");

  await startService(scoreboard_name, method, ipAddress, port);
};
