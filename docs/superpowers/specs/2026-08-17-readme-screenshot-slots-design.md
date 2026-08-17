# README Screenshot Slots Design

## Goal

Make the project README feel more polished by giving three product images clear,
contextual homes without showing broken images or unfinished placeholder graphics
before the screenshots are available.

## Design

Add three commented screenshot slots to `README.md`:

1. A wide operator-console image immediately after the introduction. This is the
   visual overview and should show the application with representative score data.
2. An OBS/browser scoreboard image in the Electron operator-console section,
   close to the documented viewer URL.
3. An ESP32 and Daktronics connection image in a short new live-score transport
   section, close to the explanation of how synchronized data reaches the app.

Each slot will be an HTML comment containing:

- the destination path under `docs/images/`;
- recommended framing and content;
- a ready-to-uncomment Markdown image line;
- concise accessible alt text and a suggested caption.

Comments keep the published README clean until each image exists. The image paths
will use lowercase kebab-case names:

- `docs/images/operator-console.png`
- `docs/images/obs-scoreboard.png`
- `docs/images/esp32-hardware.png`

## Content Changes

The existing introduction, setup commands, and build instructions remain intact.
A concise `Live score transport` section will explain that the ESP32 frames the
Daktronics serial stream and relays the newest payload to the desktop application
over TCP. It will not duplicate detailed protocol documentation.

## Verification

- Review the Markdown around all three insertion points.
- Confirm no active image references point to files that do not exist.
- Confirm the existing command blocks and heading hierarchy remain valid.
- Review the diff for unrelated changes.
