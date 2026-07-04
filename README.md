# Hive IoT

A lightweight IoT platform demonstrating the full lifecycle of a connected
device — a single ESP8266 acting as a thermostat (temperature monitor
only, not a controller) publishes telemetry that flows through an MQTT
broker into a FastAPI backend, gets modeled as a Digital Twin, and is
displayed on a React dashboard.

```
ESP8266 -- MQTT (TLS) --> Mosquitto --> FastAPI --> SQLite --> React Dashboard
```

See [`CLAUDE.md`](CLAUDE.md) for the full architecture, stack, and
per-component status, and [`Hive_IoT_MVP_Project_Plan.md`](Hive_IoT_MVP_Project_Plan.md)
for the original project plan and milestones.

## Status

Milestones 1-5 (Wi-Fi + telemetry, MQTT, backend, Digital Twin, dashboard)
are implemented. OTA firmware updates (milestone 6) and cert-based device
identity (Epic 1 — MQTT is currently plaintext/no-auth) are not yet built.

## Running it

```bash
cd docker
docker compose up --build
```

- Dashboard: http://localhost:5173
- API: http://localhost:8010
- MQTT broker: localhost:1883 (plaintext, prototype only)

To flash the firmware, see [`firmware/thermostat/README.md`](firmware/thermostat/README.md).

## Repository layout

| Path | Purpose |
|------|---------|
| `firmware/thermostat/` | PlatformIO + Arduino firmware for the ESP8266 |
| `services/api/` | FastAPI backend (REST API, MQTT ingest, Digital Twin, firmware storage) |
| `services/mqtt/` | Mosquitto broker config |
| `services/digital-twin/`, `services/ota/` | Reserved for future extraction; currently implemented inside `services/api` |
| `dashboard/` | React dashboard |
| `certificates/` | CA/device certs for MQTT TLS auth (Epic 1, not yet in use) |
| `docker/` | Docker Compose setup for the broker, API, and dashboard |
| `docs/` | Architecture notes and runbooks |
| `scripts/` | Helper scripts (cert generation, device simulation, local setup) |
