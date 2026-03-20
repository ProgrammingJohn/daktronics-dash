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

const displayOrNA = (value) => {
  if (value === null || value === undefined || value === "") {
    return "N/A";
  }
  return String(value);
};

const formatConnectedSince = (timestampMs) => {
  if (timestampMs === null || timestampMs === undefined) {
    return "N/A";
  }
  return new Date(timestampMs).toLocaleString();
};

const formatLastPacketAge = (ageMs) => {
  if (ageMs === null || ageMs === undefined) {
    return "N/A";
  }
  return `${(ageMs / 1000).toFixed(1)}s`;
};

const formatPing = (rttMs) => {
  if (rttMs === null || rttMs === undefined) {
    return "N/A";
  }
  return `${rttMs} ms`;
};

const renderTelemetry = (statusData) => {
  const telemetry = statusData?.telemetry || {};
  const statusText = statusData?.status || telemetry?.status || "unknown";

  $("#status_text").text(statusText);
  $("#telemetry_ip").text(displayOrNA(telemetry.ip));
  $("#telemetry_port").text(displayOrNA(telemetry.port));
  $("#telemetry_ping").text(formatPing(telemetry.connect_rtt_ms));
  $("#telemetry_last_packet_age").text(
    formatLastPacketAge(telemetry.last_packet_age_ms)
  );
  $("#telemetry_freshness").text(telemetry.data_fresh ? "fresh" : "stale");
  $("#telemetry_packets_received").text(
    displayOrNA(telemetry.packets_received)
  );
  $("#telemetry_packets_dropped").text(
    displayOrNA(telemetry.packets_dropped)
  );
  $("#telemetry_parse_errors").text(displayOrNA(telemetry.parse_errors));
  $("#telemetry_reconnect_count").text(
    displayOrNA(telemetry.reconnect_count)
  );
  $("#telemetry_connected_since").text(
    formatConnectedSince(telemetry.connected_since_ms)
  );
  $("#telemetry_last_error").text(displayOrNA(telemetry.last_error));
};

export const initStep4Synced = async () => {
  $(".wizard-step").hide();
  $("#wizard_step4_synced").show();
  StateHandler.setState("currentProgressBarStep", 4);
  const scoreboard_name = StateHandler.getState("selectedScoreboard");
  const ipAddress = StateHandler.getState("ipAddress");
  const port = StateHandler.getState("port");
  let lastRenderedScore = null;

  const svg = await getScoreboardSVG(scoreboard_name);
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

  const renderScore = (score) => {
    updateSVGScorePreviewBasic(score);
    if (scoreboard_name === "baseball") {
      updateSVGScorePreviewBaseball(score);
    } else if (scoreboard_name === "basketball") {
      updateSVGScorePreviewBaketball(score);
    } else if (scoreboard_name === "football") {
      updateSVGScorePreviewFootball(score);
    }
  };

  setInterval(async () => {
    try {
      const status = await getServiceStatus();
      renderTelemetry(status);
      const score = await getScore();
      if (score && Object.keys(score).length > 0) {
        lastRenderedScore = score;
      }
    } catch (error) {
      console.error("Failed to poll synced score:", error);
    }

    if (lastRenderedScore) {
      renderScore(lastRenderedScore);
    }
  }, 1000);
};
