const SCOREBOARD_FONT_STYLE = `
  @font-face {
    font-family: "DakDash Scoreboard";
    src: url("/fonts/LEMONMILK-Light.otf") format("opentype");
    font-style: normal;
    font-weight: 300;
    font-display: swap;
  }

  @font-face {
    font-family: "DakDash Scoreboard";
    src: url("/fonts/LEMONMILK-Medium.otf") format("opentype");
    font-style: normal;
    font-weight: 500;
    font-display: swap;
  }

  @font-face {
    font-family: "DakDash Scoreboard";
    src: url("/fonts/LEMONMILK-Bold.otf") format("opentype");
    font-style: normal;
    font-weight: 700;
    font-display: swap;
  }
`;

export function install_scoreboard_fonts(document: Document): void {
  if (document.head.querySelector("style[data-dakdash-scoreboard-fonts]") !== null) return;
  const style = document.createElement("style");
  style.dataset.dakdashScoreboardFonts = "";
  style.textContent = SCOREBOARD_FONT_STYLE;
  document.head.append(style);
}
