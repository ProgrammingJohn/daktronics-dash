# Collapsed Device Discovery Design

## Goal

Make device discovery feel transient. Operators should see useful progress and recovery controls while discovery is unresolved, without retaining a large diagnostic panel after the device has been found.

## Interaction

- During `DIRECT_CONNECT`, `PASSIVE_LOOKUP`, or `BROADCAST_PROBING`, show the existing full discovery panel in the sidebar above Control authority.
- During `NOT_FOUND`, keep the full panel with its Retry discovery and Enter IP manually actions.
- During `FOUND`, replace the full panel in the same sidebar position with one compact row labeled `Device IP` containing `resolved_host`.
- If `FOUND` has no `resolved_host`, show an em dash rather than inventing an address.
- The compact row remains visible for the active session. Starting a new session resets the presentation through the existing session lifecycle.

## Architecture

This is a frontend presentation change in `OperatorConsole`. Backend discovery, connection, polling, and retry behavior remain unchanged. The console derives one of two views directly from the existing `snapshot.connection.discovery.phase`:

1. Full discovery panel for active or failed discovery.
2. Compact resolved-address row for successful discovery.

No modal, toast, new state machine, timer, dismissal state, or persistence key is added.

## Error Handling

`NOT_FOUND` and retry errors continue using the current full recovery panel. A missing resolved host in `FOUND` is displayed as `—` and does not interrupt monitoring.

## Verification

Focused component tests will verify that:

- `FOUND` shows only the compact Device IP row and hides full diagnostics.
- `NOT_FOUND` retains diagnostics and recovery actions.
- An active search retains progress messaging.

The complete frontend test suite and production build will be run afterward.
