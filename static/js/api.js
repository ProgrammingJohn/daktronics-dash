export async function getScoreboardSVG(scoreboard) {
  return new Promise((resolve, reject) => {
    $.ajax({
      url: "/api/scoreboard-svg",
      method: "GET",
      dataType: "json",
      data: {
        Scoreboard: scoreboard,
      },
      success: function (data) {
        resolve(data.data);
      },
      error: function (jqXHR, textStatus, errorThrown) {
        console.error(
          "Failed to fetch scoreboard SVG:",
          textStatus,
          errorThrown
        );
        reject(new Error(`Error fetching scoreboard SVG: ${textStatus}`));
      },
    });
  });
}

export async function getScoreboardNamesAndModes() {
  return new Promise((resolve, reject) => {
    $.ajax({
      url: "/api/scoreboard-names",
      method: "GET",
      dataType: "json",
      success: function (data) {
        resolve(data.data);
      },
      error: function (jqXHR, textStatus, errorThrown) {
        console.error(
          "Failed to fetch scoreboard names:",
          textStatus,
          errorThrown
        );
        reject(new Error(`Error fetching scoreboard names: ${textStatus}`));
      },
    });
  });
}

export async function getScoreboardPreferences(scoreboard) {
  return new Promise((resolve, reject) => {
    $.ajax({
      url: "/api/scoreboard-preferences",
      method: "GET",
      dataType: "json",
      data: {
        Scoreboard: scoreboard,
      },
      success: function (data) {
        resolve(data.data);
      },
      error: function (jqXHR, textStatus, errorThrown) {
        console.error(
          "Failed to fetch scoreboard SVG:",
          textStatus,
          errorThrown
        );
        reject(new Error(`Error fetching scoreboard SVG: ${textStatus}`));
      },
    });
  });
}

export async function updateScoreboard(scoreboard, preferences) {
  return new Promise((resolve, reject) => {
    $.ajax({
      url: "/api/scoreboard-update",
      method: "POST",
      dataType: "json",
      contentType: "application/json",
      data: JSON.stringify({
        scoreboard: scoreboard,
        preferences: preferences,
      }),
      success: function (data) {
        resolve(data);
      },
      error: function (jqXHR, textStatus, errorThrown) {
        console.error("Failed to update scoreboard:", textStatus, errorThrown);
        reject(new Error(`Error updating scoreboard: ${textStatus}`));
      },
    });
  });
}

export async function startService(
  scoreboard,
  communication_method,
  ip = "",
  port = ""
) {
  return new Promise((resolve, reject) => {
    $.ajax({
      url: "/api/scoreboard-service/start",
      method: "POST",
      dataType: "json",
      contentType: "application/json",
      data: JSON.stringify({
        scoreboard: scoreboard,
        method: communication_method,
        ip: ip,
        port: port,
      }),
      success: function (data) {
        resolve(data);
      },
      error: function (jqXHR, textStatus, errorThrown) {
        console.error("Failed to start service:", textStatus, errorThrown);
        reject(new Error(`Error starting service: ${textStatus}`));
      },
    });
  });
}

export async function updateScore(score) {
  return new Promise((resolve, reject) => {
    $.ajax({
      url: "/api/scoreboard-service/update-score",
      method: "POST",
      dataType: "json",
      contentType: "application/json",
      data: JSON.stringify({
        score: score,
      }),
      success: function (data) {
        resolve(data);
      },
      error: function (jqXHR, textStatus, errorThrown) {
        console.error("Failed to start service:", textStatus, errorThrown);
        reject(new Error(`Error starting service: ${textStatus}`));
      },
    });
  });
}

export async function getScore(score) {
  return new Promise((resolve, reject) => {
    $.ajax({
      url: "/api/scoreboard-service/get-score",
      method: "GET",
      dataType: "json",
      contentType: "application/json",
      success: function (data) {
        resolve(data);
      },
      error: function (jqXHR, textStatus, errorThrown) {
        console.error("Failed to start service:", textStatus, errorThrown);
        reject(new Error(`Error starting service: ${textStatus}`));
      },
    });
  });
}

export async function getScoreboardName() {
  return new Promise((resolve, reject) => {
    $.ajax({
      url: "/api/scoreboard-service/get-scoreboard-name",
      method: "GET",
      dataType: "json",
      contentType: "application/json",
      success: function (data) {
        resolve(data.scoreboard_name);
      },
      error: function (jqXHR, textStatus, errorThrown) {
        console.error("Failed to start service:", textStatus, errorThrown);
        reject(new Error(`Error starting service: ${textStatus}`));
      },
    });
  });
}

export async function getServiceStatus() {
  return new Promise((resolve, reject) => {
    $.ajax({
      url: "/api/scoreboard-service/status",
      method: "GET",
      dataType: "json",
      success: function (data) {
        resolve(data);
      },
      error: function (jqXHR, textStatus, errorThrown) {
        console.error("Failed to get status:", textStatus, errorThrown);
        reject(new Error(`Error getting status: ${textStatus}`));
      },
    });
  });
}
