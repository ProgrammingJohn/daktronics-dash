# Connection Discovery UI Handoff

Wire the operator UI to the additive bounded-discovery API. Do not implement UDP, ARP inspection, subnet scanning, or retry logic in browser code; the Python backend owns all discovery and enforces its traffic limits.

## Start Contract

`POST /api/scoreboard-service/start` accepts:

```json
{
  "scoreboard": "football",
  "method": "synced",
  "ip": "",
  "port": 1234,
  "device_id": "wt32-943cc63d1287"
}
```

`ip` is optional. `device_id` is required in `wt32-<12 hex>` form. With an IP, the backend tries it first; without one, discovery begins immediately. One service start causes at most one passive ARP lookup and one three-probe/500 ms UDP window.

## Status Contract

`GET /api/scoreboard-service/status` retains `status`, `transport`, `source`, `revision`, and `source_age_ms`, and adds:

```json
{
  "discovery": {
    "phase": "BROADCAST_PROBING",
    "active": true,
    "attempts": 2,
    "method": null,
    "requested_host": null,
    "resolved_host": null
  }
}
```

Render phases as:

- `IDLE`: no search is running.
- `DIRECT_CONNECT`: “Connecting to saved device…”
- `PASSIVE_LOOKUP`: “Checking for the device locally…”
- `BROADCAST_PROBING`: “Searching network… attempt N of 3.”
- `FOUND`: show `resolved_host`; method is `saved_ip`, `arp_cache`, or `udp_broadcast`.
- `NOT_FOUND`: request manual IP entry and offer an explicit Retry action.

Do not repeatedly POST start while polling. Poll status through the existing single managed interval, preserve the last valid score during discovery/reconnect, and surface backend 400/503 messages. A blank IP should be a supported “Find device” flow, not a validation error. Do not hard-code venue IP addresses.

## Acceptance

- A blank IP plus a valid device ID starts discovery.
- Search progress is visible without creating duplicate timers or requests.
- A found address is displayed but identity remains the device ID.
- `NOT_FOUND` stops automatically and does not restart until the user retries.
- Manual mode and direct-IP synced mode continue to work.
