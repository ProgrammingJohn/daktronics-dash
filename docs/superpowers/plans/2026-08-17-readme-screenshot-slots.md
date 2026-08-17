# README Screenshot Slots Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three contextual, non-rendering screenshot slots to the README for the operator console, OBS output, and ESP32 hardware setup.

**Architecture:** Keep the published README clean by placing capture guidance and ready-to-use image markup inside HTML comments. Add one concise transport section so the hardware image has useful context instead of appearing as a disconnected gallery item.

**Tech Stack:** GitHub-flavored Markdown and HTML comments

## Global Constraints

- Preserve the existing setup, development, and macOS build instructions.
- Do not add active image references until the corresponding image files exist.
- Use `docs/images/operator-console.png`, `docs/images/obs-scoreboard.png`, and `docs/images/esp32-hardware.png` as the final asset paths.
- Keep all capture guidance invisible in the rendered GitHub README.

---

### Task 1: Add contextual screenshot slots

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: the existing README introduction, viewer URL, and live-sync description
- Produces: three commented screenshot insertion points with stable asset paths and a short `Live score transport` section

- [x] **Step 1: Confirm the baseline README has no active image markup**

Run:

```bash
rg -n '^!\[' README.md
```

Expected: no matches.

- [x] **Step 2: Add the operator-console slot after the introduction**

Insert this HTML comment immediately before `## Running`:

```markdown
<!--
Screenshot slot: Operator console
Capture the complete application window with representative teams, scores, and
a LIVE connection state. Use a wide crop and hide personal or venue-specific data.
Save the image as docs/images/operator-console.png, then replace this comment with:

![DakDash operator console showing a live scoreboard](docs/images/operator-console.png)

_Configure the scoreboard, connection, and broadcast appearance from one console._
-->
```

- [x] **Step 3: Add the live transport explanation and hardware slot**

Insert this section between the operator-console slot and `## Running`:

```markdown
## Live score transport

DakDash receives the Daktronics serial feed at 19,200 baud through an ESP32. The
device frames the incoming data, retains the newest complete payload, and relays
it to the desktop application over TCP port `1234`, where sport-specific parsing
and scoreboard state updates occur.

<!--
Screenshot slot: ESP32 hardware setup
Photograph the ESP32, serial connection, Ethernet connection, and scoreboard
controller together. Use a clean background and keep credentials and venue network
details out of frame. Save the image as docs/images/esp32-hardware.png, then replace
this comment with:

![ESP32 connected between a Daktronics controller and the DakDash network](docs/images/esp32-hardware.png)

_The ESP32 bridges the Daktronics serial feed to DakDash over the local network._
-->
```

- [x] **Step 4: Add the OBS-output slot after the viewer URL**

Insert this HTML comment after the `http://127.0.0.1:58321/viewer` code block:

```markdown
<!--
Screenshot slot: OBS scoreboard output
Capture the clean scoreboard graphic over representative video or a neutral preview.
Hide browser controls and use a 16:9 crop. Save the image as
docs/images/obs-scoreboard.png, then replace this comment with:

![DakDash scoreboard graphic displayed in OBS](docs/images/obs-scoreboard.png)

_Use the dedicated viewer URL as a browser source in OBS._
-->
```

- [x] **Step 5: Verify formatting and scope**

Run:

```bash
git diff --check -- README.md
git diff -- README.md
```

Expected: no whitespace errors; the diff contains only the new transport copy and three commented screenshot slots.

- [x] **Step 6: Commit the README change**

```bash
git add README.md
git commit -m "Add README screenshot placements"
```
