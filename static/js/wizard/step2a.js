import { StateHandler } from "../state.js";

export const initStep2a = () => {
  $(".wizard-step").hide();
  $("#wizard_step2a").show();
  $("#broadcast_button").click(function () {
    StateHandler.setState("currentStep", 3);
  });
  $("#reset_button").click(function () {
    StateHandler.setState("currentStep", 0);
  });
};
