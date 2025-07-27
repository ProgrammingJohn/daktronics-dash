import { StateHandler } from "../state.js";

export const initStep3 = () => {
  $(".wizard-step").hide();
  $("#wizard_step3").show();
  StateHandler.setState("currentProgressBarStep", 3);
  const scoreboardModes = StateHandler.getState("scoreboardModes");
  const selectedScoreboard = StateHandler.getState("selectedScoreboard");

  scoreboardModes[selectedScoreboard].synced
    ? $("#synced_settings").show()
    : $("#synced_settings").hide();
  scoreboardModes[selectedScoreboard].manual
    ? $("#manual_settings").show()
    : $("#manual_settings").hide();

  $("#start_server_button").click(function () {
    const selectedMethod = $('input[name="method_selector"]:checked').val();
    if (selectedMethod) {
      if (selectedMethod === "manual") {
        StateHandler.setState("broadcastMethod", "manual");
        StateHandler.setState("currentStep", 4);
      } else {
        StateHandler.setState("broadcastMethod", "synced");
        StateHandler.setState("ipAddress", $("#ip_address").val());
        StateHandler.setState("port", $("#port").val());
        StateHandler.setState("currentStep", 5);
      }
    } else {
      alert("Please select a communication method.");
    }
  });
  $("#manual").click(function () {
    $("#port").attr("disabled", "disabled");
    $("#ip_address").attr("disabled", "disabled");
  });
  $("#synced").click(function () {
    $("#port").removeAttr("disabled");
    $("#ip_address").removeAttr("disabled");
  });
};
