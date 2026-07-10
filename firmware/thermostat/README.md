# firmware/thermostat

PlatformIO + Arduino firmware for the ESP8266 thermostat device.
Handles Wi-Fi connectivity, X.509 certificate auth, MQTT/TLS telemetry
publishing, and OTA firmware updates.

## Setup

Copy `include/secrets.h.example` to `include/secrets.h` and fill in your
Wi-Fi credentials. `secrets.h` is gitignored and must never be committed.

```bash
cp include/secrets.h.example include/secrets.h
```

## Modes

One firmware build supports two temperature sources, switchable at runtime
over MQTT — no reflash needed to go between them:

- **SIM** (default on boot) — temperature stepped in software between
  65-75°F, no sensor hardware required.
- **PHY** — reads real temperature from a BMP180 (GY-68 breakout) over I2C,
  sharing the OLED's D5(SCL)/D6(SDA) bus. See
  `docs/hardware-platformio-runbook.md` for wiring. The BMP180 is probed at
  boot regardless of starting mode, so a switch to PHY takes effect
  immediately if the sensor's present.

Switch modes by publishing to `devices/{deviceId}/twin/desired/sensorMode`
(retained), payload `sim` or `phy` — e.g. via
`POST /devices/{id}/desired` with body `{"sensorMode": "phy"}`.
