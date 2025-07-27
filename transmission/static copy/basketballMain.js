// import data from "/Names.json";

function numberToOrdinal(num) {
  let ordinal = "";
  switch (num) {
    case "0":
      ordinal = "";
      break;
    case "1":
      ordinal = "1ST";
      break;
    case "2":
      ordinal = "2ND";
      break;
    case "3":
      ordinal = "3RD";
      break;
    case "4":
      ordinal = "4TH";
      break;
  }
  return ordinal;
}

$(document).ready(function () {
  var prevData = {};

  fetch("/static/names.json")
    .then((resp) => resp.json())
    .then((json) => {
      $("#HomeName").text(json["HomeName"]);
      $("#AwayName").text(json["AwayName"]);
    });

  setInterval(function () {
    $.ajax({
      url: "/",
      type: "GET",
      success: function (data) {
        // console.log(data);
        Object.keys(data).forEach((point) => {
          switch (point) {
            // Quarter
            case "period":
              if (prevData[point] != data[point]) {
                $("#Quarter").fadeOut(250, function () {
                  $("#Quarter").text(numberToOrdinal(data[point]));
                  $("#Quarter").fadeIn(250);
                });
              }
              break;

            // Clock
            case "main_clock":
              $("#Clock").text(data[point].split(".")[0]);
              $("#TOD").text(data[point].split(".")[0]);
              break;

            // case "Time Out Time":
            //   $("#TOD").text(data[point].split(".")[0]);
            //   break;
            // Home timeouts
            case "home_time_outs":
              var timeouts = parseInt(data[point]);
              // console.log("Home: " +timeouts);
              $("#HomeTimeouts ellipse").attr("fill", "var(--homeText)");
              for (let index = 5; index > timeouts; index--) {
                $("#HomeT" + index).attr("fill", "gray");
              }
              break;

            // Guest timeouts
            case "away_time_outs":
              var timeouts = parseInt(data[point]);
              // console.log("Away: " +timeouts);
              $("#AwayTimeouts ellipse").attr("fill", "var(--awayText)");
              for (let index = 5; index > timeouts; index--) {
                $("#AwayT" + index).attr("fill", "gray");
              }
              break;

            // Home Score
            case "home_score":
              if (prevData[point] != data[point]) {
                $("#HomeScore").fadeOut(250, function () {
                  $("#HomeScore").text(data[point]);
                  $("#HomeScore").fadeIn(250);
                });
              }
              break;

            // Guest Score
            case "away_score":
              if (prevData[point] != data[point]) {
                $("#AwayScore").fadeOut(250, function () {
                  $("#AwayScore").text(data[point]);
                  $("#AwayScore").fadeIn(250);
                });
              }
              break;

            case "home_fouls":
              if (prevData[point] != data[point]) {
                $("#HomeFouls").fadeOut(250, function () {
                  $("#HomeFouls").text(data[point] + " FOULS");
                  $("#HomeFouls").fadeIn(250);
                });
                if (data[point] >= 5) {
                  $("#AwayBonus").fadeIn(250);
                  break;
                }
                $("#AwayBonus").fadeOut(250);
              }
              break;

            case "away_fouls":
              if (prevData[point] != data[point]) {
                $("#AwayFouls").fadeOut(250, function () {
                  $("#AwayFouls").text(data[point] + " FOULS");
                  $("#AwayFouls").fadeIn(250);
                });
                if (data[point] >= 5) {
                  $("#HomeBonus").fadeIn(250);
                  break;
                }
                $("#HomeBonus").fadeOut(250);
              }
              break;
          }
        });
        prevData = data;
      },
    });
  }, 500);
});
