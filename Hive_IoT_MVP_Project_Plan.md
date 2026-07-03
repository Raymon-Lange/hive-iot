# Hive IoT MVP Project Plan

## Vision

**Hive IoT** is a lightweight IoT platform that demonstrates the
complete lifecycle of a connected device.

The MVP uses a single **ESP8266** acting as a thermostat (temperature
monitor only) to showcase:

-   Secure device identity
-   Telemetry
-   Digital Twin
-   Device management
-   OTA firmware deployment

------------------------------------------------------------------------

# MVP Goals

By the end of the project you will be able to:

1.  Connect an ESP8266 to Wi-Fi.
2.  Authenticate using an X.509 device certificate.
3.  Publish telemetry over MQTT (TLS).
4.  Update a Digital Twin from incoming telemetry.
5.  Display device status on a dashboard.
6.  Push OTA firmware updates.
7.  Verify the device reports the new firmware version.

------------------------------------------------------------------------

# Architecture

``` text
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

------------------------------------------------------------------------

# Technology Stack

  Component        Technology
  ---------------- ----------------------
  Device           ESP8266
  Firmware         PlatformIO + Arduino
  Sensor           DHT22 (or simulated)
  Display          OLED (U8g2)
  MQTT             Eclipse Mosquitto
  API              FastAPI
  Database         SQLite
  Dashboard        React
  OTA              ESP8266 HTTP OTA
  Certificates     OpenSSL
  Infrastructure   Docker Compose

------------------------------------------------------------------------

# Repository Structure

``` text
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

------------------------------------------------------------------------

# Core Epics

## Epic 1 -- Device Identity

-   X.509 device certificates
-   Private key
-   CA certificate
-   MQTT authentication over TLS

## Epic 2 -- Device Firmware

-   Wi-Fi connectivity
-   Temperature reporting
-   RSSI
-   Uptime
-   Firmware version
-   Onboard OLED display of device status

## Epic 3 -- MQTT

Topics: - devices/{deviceId}/telemetry - devices/{deviceId}/status -
devices/{deviceId}/twin/reported - devices/{deviceId}/twin/desired -
devices/{deviceId}/firmware

## Epic 4 -- Digital Twin

Maintain: - Reported state - Desired state - Online/offline - Last seen

## Epic 5 -- Dashboard

Display: - Current temperature - Device health - Firmware version -
RSSI - Last seen - Digital Twin - Temperature history

## Epic 6 -- OTA Firmware

Workflow: 1. Dashboard sets desired firmware version. 2. Backend updates
Digital Twin. 3. Device downloads firmware. 4. Device installs and
reboots. 5. Device reports new version.

------------------------------------------------------------------------

# REST API

-   GET /devices
-   GET /devices/{id}
-   GET /devices/{id}/twin
-   GET /devices/{id}/telemetry
-   POST /devices/{id}/desired
-   POST /firmware

------------------------------------------------------------------------

# Database

## Devices

-   id
-   name
-   certificate
-   firmware
-   last_seen
-   online

## Telemetry

-   device_id
-   temperature
-   rssi
-   uptime
-   timestamp

## Twin

-   device_id
-   reported_json
-   desired_json

------------------------------------------------------------------------

# Milestones

1.  ESP8266 Wi-Fi + Temperature
2.  MQTT Telemetry
3.  Backend + SQLite
4.  Digital Twin
5.  Dashboard
6.  OTA Firmware

------------------------------------------------------------------------

# Stretch Goals

-   Multiple devices
-   Certificate rotation
-   Fleet management
-   Rules engine
-   Alerts
-   Cloud deployment

------------------------------------------------------------------------

# Demo Flow

1.  Power on the ESP8266.
2.  Authenticate with its device certificate.
3.  View telemetry on the dashboard.
4.  Watch the Digital Twin update.
5.  Push firmware version 1.0.1.
6.  Verify OTA update completes successfully.

------------------------------------------------------------------------

# Success Criteria

The MVP demonstrates:

-   Secure device identity
-   MQTT messaging
-   Telemetry ingestion
-   Digital Twin synchronization
-   Device health monitoring
-   OTA firmware lifecycle
