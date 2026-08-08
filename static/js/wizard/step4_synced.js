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
import {
  map_connection_status,
  poll_score_revision,
  start_synced_polling,
  stop_synced_polling,
} from "./synced_polling.js";

let lastRevision = null;

export const initStep4Synced = async () => {
  stop_synced_polling();
  lastRevision = null;
  $(".wizard-step").hide();
  $("#wizard_step4_synced").show();
  StateHandler.setState("currentProgressBarStep", 4);
  const scoreboard_name = StateHandler.getState("selectedScoreboard");
  const ipAddress = StateHandler.getState("ipAddress");
  const port = StateHandler.getState("port");
  const deviceId = StateHandler.getState("deviceId");

  const svg = await getScoreboardSVG(scoreboard_name);
  const prefs = await getScoreboardPreferences(scoreboard_name);
  $("#wizard_step4_synced #svg-preview-score").html(svg);
  const svgElement = $("#wizard_step4_synced #svg-preview-score");
  const rootStyle = svgElement.find("svg")[0].style;
  for (const [key, value] of Object.entries(prefs)) {
    if (key === "home_team_name" || key === "away_team_name") {
      svgElement.find(`#${key}`).text(value);
    } else {
      rootStyle.setProperty(`--${key}`, value);
    }
  }

  try {
    await startService(scoreboard_name, "synced", ipAddress, port, deviceId);
  } catch (error) {
    $("#connection_error").text(error.message).removeAttr("hidden");
    return;
  }

  start_synced_polling(async () => {
    try {
      const status = await getServiceStatus();
      $("#status_text")
        .text(status.status)
        .attr("data-connection-state", map_connection_status(status.status));
      $("#transport_text").text(status.transport ?? "—");
      $("#source_age_text").text(
        status.source_age_ms == null ? "—" : `${status.source_age_ms} ms`
      );
      lastRevision = await poll_score_revision(status, lastRevision, getScore, (score) => {
        updateSVGScorePreviewBasic(score);
        if (scoreboard_name === "baseball") {
          updateSVGScorePreviewBaseball(score);
        } else if (scoreboard_name === "basketball") {
          updateSVGScorePreviewBaketball(score);
        } else if (scoreboard_name === "football") {
          updateSVGScorePreviewFootball(score);
        }
      });
      $("#connection_error").attr("hidden", "hidden").text("");
    } catch (error) {
      $("#connection_error").text(error.message).removeAttr("hidden");
    }
  });
};
