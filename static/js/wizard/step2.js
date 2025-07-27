import {
  getScoreboardSVG,
  getScoreboardPreferences,
  updateScoreboard,
} from "../api.js";
import { StateHandler } from "../state.js";

let stagingScoreboardPreferences = {
  home_team_light: "#ffffff",
  home_team_dark: "#000000",
  home_team_text: "#ffffff",
  away_team_light: "#ffffff",
  away_team_dark: "#000000",
  away_team_text: "#ffffff",
  home_team_name: "ABCD",
  away_team_name: "ABCD",
};

function updateSVGPreview() {
  const svgElement = $("#svg-preview svg");

  if (svgElement.length) {
    const rootStyle = svgElement[0].style;
    for (const [key, value] of Object.entries(stagingScoreboardPreferences)) {
      if (key === "home_team_name" || key === "away_team_name") {
        $(`#${key}`).text(value);
      } else {
        rootStyle.setProperty(`--${key}`, value);
      }
    }
  }
}

export const initStep2 = async () => {
  $(".wizard-step").hide();
  $("#wizard_step2").show();
  StateHandler.setState("currentProgressBarStep", 2);

  // load the scoreboard & scoreboard preference state

  const selectedScoreboard = await StateHandler.getState("selectedScoreboard");
  let activeScoreboard = await getScoreboardSVG(selectedScoreboard);

  $("#svg-preview").html(activeScoreboard);
  stagingScoreboardPreferences = await getScoreboardPreferences(
    selectedScoreboard
  );
  await updateSVGPreview();

  $(".scoreboard_preference_input").each(function () {
    const inputId = $(this).attr("id");
    $(this).val(stagingScoreboardPreferences[inputId]);
  });

  $(".scoreboard_preference_input").change(function () {
    const inputValue = $(this).val();
    const inputId = $(this).attr("id");
    stagingScoreboardPreferences[inputId] = inputValue;
    updateSVGPreview();
  });

  $("#save_scoreboard").click(function () {
    updateScoreboard(selectedScoreboard, stagingScoreboardPreferences);
    StateHandler.setState("activeScoreboard", $("#svg-preview").html());
    StateHandler.setState("currentStep", 2);
    $("#svg-preview").html(""); // clear the SVG preview so preview-score loads properly in step 4
  });
};
