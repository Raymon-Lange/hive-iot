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

Two build environments select where temperature readings come from:

- `pio run` (env `nodemcuv2`, default) — **SIM** mode, no sensor hardware
  required. Temperature is stepped in software between 65-75°F.
- `pio run -e nodemcuv2-phy` — **PHY** mode, reads real temperature from a
  BMP180 (GY-68 breakout) over I2C, sharing the OLED's D5(SCL)/D6(SDA) bus.
  See `docs/hardware-platformio-runbook.md` for wiring.
