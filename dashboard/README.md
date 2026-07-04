# dashboard

React dashboard displaying device status, telemetry history, Digital Twin
state, and firmware version. Scaffolded with Vite (`npm create vite`).

Pages:
- **Overview** — list of known devices, online status, current temp
- **Device Detail** — full twin state, telemetry history chart for one device
- **Firmware Management** — upload firmware, push a desired version to a device (device doesn't act on it yet — OTA client isn't implemented on the firmware side)

## Setup

```bash
npm install
npm run dev
```

Expects the API (`services/api`) running and reachable — see `VITE_API_URL` in `.env` (defaults to `http://localhost:8010`).
