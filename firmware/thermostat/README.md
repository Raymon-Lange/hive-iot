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
