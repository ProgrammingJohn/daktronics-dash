import { updateSVGScorePreviewBasic } from "../wizard/index.js";
import { updateScore } from "../api.js";

let score = {
  home_score: 0,
  away_score: 0,
  clock: { minutes: 0, seconds: 0 },
  period: 1,
  home_fouls: 0,
  away_fouls: 0,
  home_bonus: false,
  away_bonus: false,
  home_timeouts: 5,
  away_timeouts: 5,
  yards_to_go: 0,
  down: 1,
};
let clockInterval;
let manual_football;

export const updateSVGScorePreviewFootball = (score) => {
  for (const [key, value] of Object.entries(score)) {
    if (key.endsWith("_timeouts")) {
      for (let index = 5; index > 0; index--) {
        $(".svg-score svg")
          .find(`#${key}_t` + index)
          .attr("fill", "white");
      }
      for (let index = 5; index > score[key]; index--) {
        $(".svg-score svg")
          .find(`#${key}_t` + index)
          .attr("fill", "gray");
      }
    } else if (key === "clock") {
      let clockText =
        String(score.clock.minutes).padStart(1, "0") +
        ":" +
        String(score.clock.seconds).padStart(2, "0");
      $(".svg-score svg").find(`#${key}`).text(clockText);
    } else if (key === "period") {
      let periodText = "";
      switch (score[key]) {
        case 0:
          periodText = "pre";
          break;
        case 1:
          periodText = "1st";
          break;
        case 2:
          periodText = "2nd";
          break;
        case 3:
          periodText = "3rd";
          break;
        case 4:
          periodText = "4th";
          break;
        default:
          periodText = `ot${score[key] - 4}`;
          break;
      }
      $(".svg-score svg").find(`#${key}`).text(periodText);
    } else if (key === "down" || key === "yards_to_go") {
      let downText = "";
      switch (score["down"]) {
        case 1:
          downText = "1st";
          break;
        case 2:
          downText = "2nd";
          break;
        case 3:
          downText = "3rd";
          break;
        case 4:
          downText = "4th";
          break;
        default:
          downText = "";
          break;
      }
      $(".svg-score svg")
        .find("#down_text")
        .text(`${downText} & ${score["yards_to_go"]}`);
    }
  }
};

const updateScoreLogic = (id, value, score) => {
  console.log(id, value, score);
  if (id === "game_minutes") {
    score.clock.minutes = Math.min(Math.max(value, 0), 99);
  } else if (id === "game_seconds") {
    score.clock.seconds = Math.min(Math.max(value, 0), 59);
  } else if (id === "down") {
    score.down = Math.min(Math.max(parseInt(value), 1), 4);
  } else if (id === "yards_to_go") {
    score.yards_to_go = Math.max(parseInt(value), 0);
  } else {
    score[id] = Math.max(parseInt(value), 0);
  }
  updateClockDisplay();

  return score;
};
const updateClockDisplay = () => {
  manual_football.find("#game_minutes").val(score.clock.minutes);
  manual_football.find("#game_seconds").val(score.clock.seconds);
  updateSVGScorePreviewFootball(score);
};

const startClock = () => {
  if (clockInterval) return;
  clockInterval = setInterval(() => {
    if (score.clock.seconds === 0) {
      if (score.clock.minutes === 0) {
        stopClock();
        return;
      }
      score.clock.minutes -= 1;
      score.clock.seconds = 59;
    } else {
      score.clock.seconds -= 1;
    }
    updateClockDisplay();
    updateScore(score);
  }, 1000);
};

const stopClock = () => {
  clearInterval(clockInterval);
  clockInterval = null;
};

export const initFootballControls = async () => {
  manual_football = $("#manual_football");
  manual_football.find("#start_clock").on("click", () => {
    startClock();
  });

  manual_football.find("#stop_clock").on("click", () => {
    stopClock();
  });

  manual_football
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
      updateSVGScorePreviewFootball(score);
      updateScore(score);
    });
  $(document).on("keydown", function (event) {
    const key = event.key.toLowerCase();
    const previousScore = { ...score };

    switch (key) {
      case "h":
        score = updateScoreLogic("home_score", score.home_score + 1, score);
        manual_football
          .find("#home_score.scoreboard-input")
          .val(score.home_score);
        break;
      case "a":
        score = updateScoreLogic("away_score", score.away_score + 1, score);
        manual_football
          .find("#away_score.scoreboard-input")
          .val(score.away_score);
        break;
      case "t":
        score = updateScoreLogic(
          "home_timeouts",
          score.home_timeouts - 1,
          score
        );
        manual_football
          .find("#home_timeouts.scoreboard-input")
          .val(score.home_timeouts);
        break;
      case "y":
        score = updateScoreLogic(
          "away_timeouts",
          score.away_timeouts - 1,
          score
        );
        manual_football
          .find("#away_timeouts.scoreboard-input")
          .val(score.away_timeouts);
        break;
      default:
        return;
    }

    if (JSON.stringify(previousScore) === JSON.stringify(score)) {
      return;
    }

    updateSVGScorePreviewBasic(score);
    updateSVGScorePreviewFootball(score);
    updateScore(score);
  });
};
