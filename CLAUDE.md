# Hive IoT

## Vision

Hive IoT is a lightweight IoT platform demonstrating the full lifecycle of a
connected device. The MVP uses a single **ESP8266** acting as a thermostat
(temperature monitor only, not a controller) to showcase:

- Secure device identity
- Telemetry
- Digital Twin
- Device management
- OTA firmware deployment

See `Hive_IoT_MVP_Project_Plan.md` for the full plan this file is derived
from.

## Status

Milestones 1-5 are implemented; OTA (milestone 6) has not started.

- **Firmware**: ESP8266 connects to Wi-Fi, shows status on OLED, publishes
  simulated temperature to `devices/{deviceId}/telemetry` every 60s.
  Plaintext MQTT (no TLS/cert auth yet — Epic 1 deferred). RSSI, uptime,
  and firmware version are not yet reported by the device.
- **MQTT**: Mosquitto broker via Docker Compose, plaintext,
  `allow_anonymous true`. Prototype config pending Epic 1.
- **Backend**: FastAPI + SQLite, containerized. Implements the REST API
  below, MQTT ingest into the Digital Twin, and firmware upload/listing.
  `services/digital-twin` and `services/ota` are still stub READMEs — that
  logic currently lives inside `services/api`.
- **Dashboard**: React app, containerized. Overview, Device Detail
  (with temperature history chart), and Firmware Management pages.
- **Not started**: Epic 1 (X.509 device certs, TLS), and the device-side
  OTA flow (downloading/installing firmware, reporting new version).

## MVP Goals

1. Connect an ESP8266 to Wi-Fi.
2. Authenticate using an X.509 device certificate.
3. Publish telemetry over MQTT (TLS).
4. Update a Digital Twin from incoming telemetry.
5. Display device status on a dashboard.
6. Push OTA firmware updates.
7. Verify the device reports the new firmware version.

## Architecture

```
ESP8266
   |
MQTT over TLS
   |
Mosquitto Broker
   |
FastAPI Backend
   |
SQLite (Telemetry + Digital Twin)
   |
React Dashboard
```

## Technology Stack

| Component      | Technology            |
|-----------------|-----------------------|
| Device          | ESP8266               |
| Firmware        | PlatformIO + Arduino  |
| Sensor          | DHT22 (or simulated)  |
| Display         | OLED (U8g2)           |
| MQTT            | Eclipse Mosquitto     |
| API             | FastAPI                |
| Database        | SQLite                 |
| Dashboard       | React                  |
| OTA             | ESP8266 HTTP OTA       |
| Certificates    | OpenSSL                |
| Infrastructure  | Docker Compose         |

## Local Dev Environment

- PlatformIO CLI is installed in a dedicated venv, not on `PATH`:
  `~/.venvs/pio/bin/pio`. Build the firmware with:
  ```bash
  ~/.venvs/pio/bin/pio run -d firmware/thermostat
  ```

## Repository Structure

```
hive-iot/
├── docs/
├── firmware/
│   └── thermostat/
├── services/
│   ├── api/
│   ├── mqtt/
│   ├── digital-twin/
│   ├── ota/
├── dashboard/
├── certificates/
├── docker/
└── scripts/
```

## Core Epics

1. **Device Identity** — X.509 device certificates, private key, CA
   certificate, MQTT authentication over TLS.
2. **Device Firmware** — Wi-Fi connectivity, temperature reporting, RSSI,
   uptime, firmware version, onboard OLED display of device status.
3. **MQTT** — Topics: `devices/{deviceId}/telemetry`,
   `devices/{deviceId}/status`, `devices/{deviceId}/twin/reported`,
   `devices/{deviceId}/twin/desired`, `devices/{deviceId}/firmware`.
4. **Digital Twin** — Maintains reported state, desired state,
   online/offline, last seen.
5. **Dashboard** — Displays current temperature, device health, firmware
   version, RSSI, last seen, Digital Twin, temperature history.
6. **OTA Firmware** — Dashboard sets desired firmware version → backend
   updates Digital Twin → device downloads firmware → device installs and
   reboots → device reports new version.

## REST API

- `GET /devices`
- `GET /devices/{id}`
- `GET /devices/{id}/twin`
- `GET /devices/{id}/telemetry`
- `POST /devices/{id}/desired`
- `POST /firmware`

## Database

**Devices**: id, name, certificate, firmware, last_seen, online

**Telemetry**: device_id, temperature, rssi, uptime, timestamp

**Twin**: device_id, reported_json, desired_json

## Milestones

1. ESP8266 Wi-Fi + Temperature — done
2. MQTT Telemetry — done
3. Backend + SQLite — done
4. Digital Twin — done
5. Dashboard — done
6. OTA Firmware — not started

## Stretch Goals

- Multiple devices
- Certificate rotation
- Fleet management
- Rules engine
- Alerts
- Cloud deployment

## Success Criteria

The MVP demonstrates: secure device identity, MQTT messaging, telemetry
ingestion, Digital Twin synchronization, device health monitoring, and OTA
firmware lifecycle.
