import { StateHandler } from "../state.js";
import { initStep1 } from "./step1.js";
import { initStep2 } from "./step2.js";
import { initStep2a } from "./step2a.js";
import { initStep3 } from "./step3.js";
import { initStep4Manual } from "./step4_manual.js";
import { initStep4Synced } from "./step4_synced.js";

export const updateSVGScorePreviewBasic = (score) => {
  const svgElement = $(".svg-score svg");

  for (const [key, value] of Object.entries(score)) {
    svgElement.find(`#${key}`).text(value);
  }
};

const steps = [
  { name: "step1", init: initStep1 },
  { name: "step2", init: initStep2 },
  { name: "step2a", init: initStep2a },
  { name: "step3", init: initStep3 },
  { name: "step4_manual", init: initStep4Manual },
  { name: "step4_synced", init: initStep4Synced },
];

StateHandler.onStateChange((key, value) => {
  StateHandler.printState();
  if (key === "currentStep") {
    steps[value].init();
  }
  if (key == "currentProgressBarStep") {
    $(".step").removeClass("active");
    $(`[data-step="${value}"]`).addClass("active");
  }
});

StateHandler.setState("activeScore", {});
StateHandler.setState("currentStep", 0);
