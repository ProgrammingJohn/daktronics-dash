import { getScoreboardNamesAndModes } from "../api.js";
import { StateHandler } from "../state.js";

export const initStep1 = async () => {
  $(".wizard-step").hide();
  $("#wizard_step1").show();
  StateHandler.setState("currentProgressBarStep", 1);

  let scoreboardNames = await getScoreboardNamesAndModes();
  const scoreboardModes = scoreboardNames.modes;
  scoreboardNames = scoreboardNames.names;

  StateHandler.setState("scoreboardModes", scoreboardModes);

  $("#scoreboard_selector").empty();
  scoreboardNames.forEach((name) => {
    $("#scoreboard_selector").append(new Option(name, name));
  });

  $("#next_button").click(function () {
    const selectedScoreboard = $("#scoreboard_selector").val();
    if (selectedScoreboard === null || selectedScoreboard === "") {
      alert("Please select a scoreboard.");
      return;
    }
    StateHandler.setState("selectedScoreboard", selectedScoreboard);
    StateHandler.setState("currentStep", 1);
  });
};
