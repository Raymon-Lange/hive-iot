# Hive IoT

A lightweight IoT platform demonstrating the full lifecycle of a connected
device — one or more ESP8266s acting as thermostats (temperature monitors
only, not controllers) publish telemetry that flows through an MQTT broker
into a FastAPI backend, gets modeled as a Digital Twin, and is displayed
on a React dashboard. The dashboard can also push OTA firmware updates
back down to the devices.

```
ESP8266(s) -- MQTT --> Mosquitto --> FastAPI --> SQLite --> React Dashboard
```

## Status

All six MVP milestones are implemented, including OTA firmware updates,
verified end-to-end (both success and failure paths). Device IDs are
MAC-derived at boot, so one firmware build serves multiple devices —
registered, named, and managed from the dashboard.

MQTT and the OTA firmware download are currently **plaintext, no
authentication** (`allow_anonymous true`). Cert-based device identity
(X.509 + MQTT over TLS) and OTA signature verification are designed but
not yet built — see [Not yet built](#not-yet-built) below.

- **Firmware**: ESP8266 connects to Wi-Fi, shows connection/OTA status on
  an OLED display, and publishes simulated temperature to
  `devices/{deviceId}/telemetry` every 60s, including its firmware
  version (currently `0.1.4`), uptime, and RSSI. The device ID is derived
  from its own MAC address at boot (`deriveDeviceId()`), so the same
  compiled binary can run on any number of physical units with no
  per-device build step and no baked-in secrets.
- **OTA**: the device subscribes to `devices/{deviceId}/twin/desired/firmware`.
  On a version mismatch it downloads the new binary via `ESPhttpUpdate`,
  flashes, and reboots. A sticky `otaFailed` flag stops it from retrying
  after a failed attempt (until power-cycle), so a bad push doesn't loop
  instead of reporting telemetry. There is no integrity or signature
  check yet — a corrupted or malicious binary would currently be flashed
  without complaint.
- **MQTT**: Eclipse Mosquitto broker via Docker Compose, plaintext,
  anonymous access — a prototyping setup, not production-grade.
- **Backend**: FastAPI + SQLite, containerized. Ingests telemetry over
  MQTT into a Digital Twin (reported/desired state, online/offline,
  last-seen), serves the REST API below, stores/lists/serves firmware
  binaries, and publishes desired-firmware changes to MQTT (retained) so
  devices pick them up.
- **Dashboard**: React app, containerized. The Overview page lets you
  register a device (ID + name) and lists all known devices as a grid of
  cards showing temperature, firmware version, last-reported time, and an
  online/offline badge. The Device Detail page shows a temperature
  history chart plus RSSI and other reported state. The Firmware
  Management page uploads firmware builds and pushes a desired version to
  a device to trigger OTA. Status/error messages across pages use a
  shared dismissible banner component.

### Not yet built

- **Device identity (Epic 1)** — X.509 device certificates, private
  key, CA certificate, and MQTT authentication over TLS. Devices and the
  OTA download are unauthenticated in the meantime.
- **OTA firmware signing** — ECDSA P-256 + SHA-256 signature, verified
  on-device against a baked-in public key before flashing. Designed but
  not built; closes the "unsigned binary gets flashed without complaint"
  gap above.
- Certificate rotation, fleet management, rules engine, alerts, cloud
  deployment — stretch goals, not started.

## Architecture

```
ESP8266
   |
MQTT (plaintext, prototype)
   |
Mosquitto Broker
   |
FastAPI Backend
   |
SQLite (Telemetry + Digital Twin + Firmware)
   |
React Dashboard
```

MQTT topics:

- `devices/{deviceId}/telemetry` — temperature, RSSI, uptime, firmware
  version, published every 60s
- `devices/{deviceId}/twin/desired/firmware` — retained, backend publishes
  the desired firmware version; device subscribes and triggers OTA on a
  mismatch

## Technology Stack

| Component      | Technology            |
|-----------------|-----------------------|
| Device          | ESP8266               |
| Firmware        | PlatformIO + Arduino  |
| Sensor          | Simulated temperature |
| Display         | OLED (U8g2)           |
| MQTT            | Eclipse Mosquitto     |
| API             | FastAPI               |
| Database        | SQLite                |
| Dashboard       | React                 |
| OTA             | ESP8266 HTTP OTA (`ESPhttpUpdate`) |
| Infrastructure  | Docker Compose        |

## REST API

- `GET /devices` — list all known devices (registered and/or reporting telemetry)
- `POST /devices` — register or rename a device (`deviceId`, `name`, optional `certificate`)
- `GET /devices/{id}/twin` — reported/desired state, online status, last-seen
- `GET /devices/{id}/telemetry` — telemetry history
- `POST /devices/{id}/desired` — set desired state (e.g. firmware version); triggers an MQTT publish to the device
- `GET /firmware` — list uploaded firmware builds
- `POST /firmware` — upload a firmware binary under a version tag
- `GET /firmware/{version}/download` — download a specific firmware binary (used by devices during OTA)

## Database (SQLite)

- **devices**: `id`, `name`, `certificate` — the directory of
  explicitly-registered devices. Firmware version, last-seen, and
  online/offline shown on the dashboard are derived at read time from
  `twin` (and telemetry-derived reported state), not stored on this table.
- **telemetry**: `device_id`, `temperature`, `rssi`, `uptime`, `timestamp`
- **twin**: `device_id`, `reported_json`, `desired_json`, `last_seen`
- **firmware**: `id`, `version`, `filename`, `uploaded_at`

## Prerequisites

- **Docker + Docker Compose** — runs the broker, API, and dashboard;
  nothing else needs to be installed locally to use them.
- **PlatformIO CLI** — only needed to build/flash firmware. Expected in a
  dedicated venv, not on `PATH` (`~/.venvs/pio/bin/pio`).
- **Hardware** — a NodeMCU v2 (ESP8266) board (`platformio.ini`'s
  `board = nodemcuv2`) and an SSD1306 I2C OLED display. The reference
  wiring uses non-default I2C pins: SDA=GPIO12/D6, SCL=GPIO14/D5.

## Configuration

Set via environment variables on the `api` and `dashboard` containers
(already wired up in `docker/docker-compose.yml` — override there if you
need different values):

| Variable | Used by | Default | Purpose |
|----------|---------|---------|---------|
| `MQTT_BROKER_HOST` | backend | `localhost` | Hostname of the Mosquitto broker |
| `MQTT_BROKER_PORT` | backend | `1883` | Mosquitto port |
| `HIVE_DB_PATH` | backend | `services/api/data/hive_iot.db` | SQLite file location |
| `VITE_API_URL` | dashboard (build-time) | — | Base URL the dashboard calls for the API |

Firmware-side configuration (Wi-Fi credentials) lives in
`firmware/thermostat/include/secrets.h` — see
[Flashing the firmware](#flashing-the-firmware).

## Running it

```bash
cd docker
docker compose up --build
```

- Dashboard: http://localhost:5173
- API: http://localhost:8010
- MQTT broker: localhost:1883 (plaintext, prototype only)

### Flashing the firmware

```bash
cp firmware/thermostat/include/secrets.h.example firmware/thermostat/include/secrets.h
# fill in your Wi-Fi credentials in secrets.h (gitignored, never commit it)

~/.venvs/pio/bin/pio run -d firmware/thermostat --target upload
```

The device ID is derived from the board's MAC address at boot, so the
same build can be flashed to any number of physical units.

## Troubleshooting

- **`pio: command not found`** — PlatformIO is installed in a dedicated
  venv, not on `PATH`. Use the full path,
  `~/.venvs/pio/bin/pio run -d firmware/thermostat`, or activate that venv
  first.
- **OLED shows nothing / garbled output** — check the I2C wiring against
  the pins declared in `firmware/thermostat/src/main.cpp` (SDA=GPIO12/D6,
  SCL=GPIO14/D5) — these are not the board's default I2C pins, so a
  generic wiring guide will be wrong.
- **Device never appears in the dashboard** — confirm the device connected
  to Wi-Fi (check the OLED status / serial log) and that it can reach the
  broker on port 1883; MQTT is plaintext with no auth, so a firewall or
  network ACL blocking the port is the most common cause.
- **OTA push doesn't do anything a second time** — a failed OTA attempt
  sets a sticky `otaFailed` flag that blocks retries until the device is
  power-cycled, by design (so a bad push doesn't loop instead of
  reporting telemetry). Power-cycle the device before pushing again.

## Repository layout

| Path | Purpose |
|------|---------|
| `firmware/thermostat/` | PlatformIO + Arduino firmware for the ESP8266 |
| `services/api/` | FastAPI backend (REST API, MQTT ingest, Digital Twin, firmware storage) |
| `services/mqtt/` | Mosquitto broker config |
| `services/digital-twin/`, `services/ota/` | Reserved for future extraction; currently implemented inside `services/api` |
| `dashboard/` | React dashboard |
| `certificates/` | CA/device certs for MQTT TLS auth (not yet in use) |
| `docker/` | Docker Compose setup for the broker, API, and dashboard |
| `scripts/` | Helper scripts (cert generation, device simulation, local setup) |
