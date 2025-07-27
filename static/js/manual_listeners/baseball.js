import { updateSVGScorePreviewBasic } from "../wizard/index.js";
import { updateScore } from "../api.js";

let manual_baseball;

export const updateSVGScorePreviewBaseball = (score) => {
  for (const [key, value] of Object.entries(score)) {
    if (key.startsWith("base_")) {
      $(".svg-score svg")
        .find(`#${key}`)
        .attr("fill", value ? "#ffea00" : "#ffffff");
    }
  }
};

const updateScoreLogic = (id, value, score) => {
  if (id === "inning_half") {
    value = manual_baseball.find(`#${id}`).find("option:selected").val();
    score[id] = value;
  } else if (id.startsWith("base_")) {
    score[id] = !score[id];
    manual_baseball
      .find(`#${id}.scoreboard-input`)
      .toggleClass("button-active");
  } else {
    score[id] = parseInt(value);
  }

  if (score.strikes > 2) {
    score.strikes = 0;
    manual_baseball.find("#strikes.scoreboard-input").val(0);
    score.balls = 0;
    manual_baseball.find("#balls.scoreboard-input").val(0);
    score.outs += 1;
    manual_baseball.find("#outs.scoreboard-input").val(score.outs);
  }
  if (score.balls > 3) {
    score.balls = 0;
    manual_baseball.find("#balls.scoreboard-input").val(0);
    score.strikes = 0;
    manual_baseball.find("#strikes.scoreboard-input").val(0);
  }
  if (score.outs > 2) {
    score.outs = 0;
    manual_baseball.find("#outs.scoreboard-input").val(0);
    if (score.inning_half === "bot") {
      score.innings += 1;
      manual_baseball.find("#innings.scoreboard-input").val(score.innings);
    }
    score.inning_half = score.inning_half === "top" ? "bot" : "top";
    manual_baseball
      .find("#inning_half.scoreboard-input")
      .val(score.inning_half);
  }
  score.inning_text = score.inning_half + " " + score.innings;
  score.strikes_and_balls = score.balls + " - " + score.strikes;
  score.out_text = score.outs + " outs";

  return score;
};

export const initBaseballControls = async () => {
  manual_baseball = $("#manual_baseball");
  let score = {
    home_score: 0,
    away_score: 0,
    innings: 1,
    outs: 0,
    strikes: 0,
    balls: 0,
    inning_half: "top",
    base_one: false,
    base_two: false,
    base_three: false,
    out_text: "0 outs",
    inning_text: "top 1",
    strikes_and_balls: "0 - 0",
  };
  manual_baseball
    .find(".scoreboard-input")
    .on("input change click", function () {
      const id = $(this).attr("id");
      let value = $(this).val();

      const previousScore = { ...score };
      score = updateScoreLogic(id, value, score);

      if (JSON.stringify(previousScore) === JSON.stringify(score)) {
        return;
      }
      updateSVGScorePreviewBasic(score);
      updateSVGScorePreviewBaseball(score);
      updateScore(score);
    });
  $(document).on("keydown", function (event) {
    const key = event.key.toLowerCase();
    const previousScore = { ...score };

    switch (key) {
      case "h":
        score = updateScoreLogic("home_score", score.home_score + 1, score);
        manual_baseball
          .find("#home_score.scoreboard-input")
          .val(score.home_score);
        break;
      case "a":
        score = updateScoreLogic("away_score", score.away_score + 1, score);
        manual_baseball
          .find("#away_score.scoreboard-input")
          .val(score.away_score);
        break;
      case "i":
        score = updateScoreLogic("innings", score.innings + 1, score);
        manual_baseball.find("#innings.scoreboard-input").val(score.innings);
        break;
      case "o":
        score = updateScoreLogic("outs", score.outs + 1, score);
        manual_baseball.find("#outs.scoreboard-input").val(score.outs);
        break;
      case "s":
        score = updateScoreLogic("strikes", score.strikes + 1, score);
        manual_baseball.find("#strikes.scoreboard-input").val(score.strikes);
        break;
      case "b":
        score = updateScoreLogic("balls", score.balls + 1, score);
        manual_baseball.find("#balls.scoreboard-input").val(score.balls);
        break;
      case "t":
        score.inning_half = score.inning_half === "top" ? "bot" : "top";
        manual_baseball
          .find("#inning_half.scoreboard-input")
          .val(score.inning_half);
        score = updateScoreLogic("inning_half", score.inning_half, score);
        break;
      case "1":
        score = updateScoreLogic("base_one", score.base_one, score);
        break;
      case "2":
        score = updateScoreLogic("base_two", score.base_two, score);
        break;
      case "3":
        score = updateScoreLogic("base_three", score.base_three, score);
        break;
      default:
        return;
    }

    if (JSON.stringify(previousScore) === JSON.stringify(score)) {
      return;
    }

    updateSVGScorePreviewBasic(score);
    updateSVGScorePreviewBaseball(score);
    updateScore(score);
  });
};
