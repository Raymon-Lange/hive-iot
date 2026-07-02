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

This repository is currently in the planning stage — no code has been
written yet. See `Hive_IoT_MVP_Project_Plan.md` for the full plan this file
is derived from.

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
| MQTT            | Eclipse Mosquitto     |
| API             | FastAPI                |
| Database        | SQLite                 |
| Dashboard       | React                  |
| OTA             | ESP8266 HTTP OTA       |
| Certificates    | OpenSSL                |
| Infrastructure  | Docker Compose         |

## Repository Structure (planned)

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
   uptime, firmware version.
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

## REST API (planned)

- `GET /devices`
- `GET /devices/{id}`
- `GET /devices/{id}/twin`
- `GET /devices/{id}/telemetry`
- `POST /devices/{id}/desired`
- `POST /firmware`

## Database (planned)

**Devices**: id, name, certificate, firmware, last_seen, online

**Telemetry**: device_id, temperature, rssi, uptime, timestamp

**Twin**: device_id, reported_json, desired_json

## Milestones

1. ESP8266 Wi-Fi + Temperature
2. MQTT Telemetry
3. Backend + SQLite
4. Digital Twin
5. Dashboard
6. OTA Firmware

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
