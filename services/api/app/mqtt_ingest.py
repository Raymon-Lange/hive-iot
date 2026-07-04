import json
import logging
import os

import paho.mqtt.client as mqtt

from .db import get_connection
from .twin import upsert_reported

logger = logging.getLogger(__name__)

MQTT_BROKER_HOST = os.environ.get("MQTT_BROKER_HOST", "localhost")
MQTT_BROKER_PORT = int(os.environ.get("MQTT_BROKER_PORT", "1883"))
TELEMETRY_TOPIC = "devices/+/telemetry"


def _on_connect(client, userdata, flags, reason_code, properties=None):
    if reason_code == 0:
        logger.info("Connected to MQTT broker %s:%s", MQTT_BROKER_HOST, MQTT_BROKER_PORT)
        client.subscribe(TELEMETRY_TOPIC)
    else:
        logger.error("MQTT connect failed: %s", reason_code)


def _on_message(client, userdata, msg):
    try:
        payload = json.loads(msg.payload.decode())
    except (json.JSONDecodeError, UnicodeDecodeError):
        logger.warning("Dropping malformed telemetry payload on %s: %r", msg.topic, msg.payload)
        return

    device_id = payload.get("deviceId")
    temperature = payload.get("temperature")
    if device_id is None or temperature is None:
        logger.warning("Dropping telemetry missing deviceId/temperature: %r", payload)
        return

    rssi = payload.get("rssi")
    uptime = payload.get("uptime")

    conn = get_connection()
    conn.execute(
        "INSERT INTO telemetry (device_id, temperature, rssi, uptime) VALUES (?, ?, ?, ?)",
        (device_id, temperature, rssi, uptime),
    )
    conn.commit()
    conn.close()
    logger.info("Stored telemetry from %s: temp=%s", device_id, temperature)

    upsert_reported(device_id, {
        "temperature": temperature,
        "uptime": uptime,
        "rssi": rssi,
        "firmware": payload.get("firmware"),
    })


def start_mqtt_client() -> mqtt.Client:
    client = mqtt.Client(callback_api_version=mqtt.CallbackAPIVersion.VERSION2)
    client.on_connect = _on_connect
    client.on_message = _on_message
    client.connect(MQTT_BROKER_HOST, MQTT_BROKER_PORT)
    client.loop_start()
    return client
