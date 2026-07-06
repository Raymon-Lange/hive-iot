import json
from datetime import datetime, timezone

from .db import get_connection
from .devices import list_registered_devices

ONLINE_THRESHOLD_SECONDS = 90  # ~1.5x the device's 60s telemetry interval


def upsert_reported(device_id: str, reported: dict) -> None:
    """Update a device twin's reported state and last-seen timestamp.

    Currently called from telemetry ingestion (mqtt_ingest.py), since the
    device doesn't yet publish a dedicated twin/reported message. Kept
    generic so a future firmware update publishing to devices/{id}/twin/reported
    directly can call this the same way.
    """
    conn = get_connection()
    now = datetime.now(timezone.utc).isoformat()
    conn.execute(
        """
        INSERT INTO twin (device_id, reported_json, last_seen)
        VALUES (?, ?, ?)
        ON CONFLICT(device_id) DO UPDATE SET
            reported_json = excluded.reported_json,
            last_seen = excluded.last_seen
        """,
        (device_id, json.dumps(reported), now),
    )
    conn.commit()
    conn.close()


def get_twin(device_id: str) -> dict | None:
    conn = get_connection()
    row = conn.execute(
        "SELECT device_id, reported_json, desired_json, last_seen FROM twin WHERE device_id = ?",
        (device_id,),
    ).fetchone()
    conn.close()

    if row is None:
        return None

    online = False
    if row["last_seen"] is not None:
        last_seen = datetime.fromisoformat(row["last_seen"])
        age = (datetime.now(timezone.utc) - last_seen).total_seconds()
        online = age < ONLINE_THRESHOLD_SECONDS

    return {
        "deviceId": row["device_id"],
        "reported": json.loads(row["reported_json"]),
        "desired": json.loads(row["desired_json"]),
        "online": online,
        "lastSeen": row["last_seen"],
    }


def list_devices() -> list[dict]:
    """List every device that's either registered or has ever sent telemetry.

    Registration (devices.py) is a directory, not a gate: a registered
    device with no telemetry yet still shows up (offline, no readings),
    and a device that's been publishing telemetry without ever being
    explicitly registered still shows up too (name is just null) — this
    keeps existing unregistered devices visible rather than dropping them
    once registration was introduced.
    """
    registered = list_registered_devices()

    conn = get_connection()
    rows = conn.execute("SELECT device_id, reported_json, last_seen FROM twin").fetchall()
    conn.close()

    now = datetime.now(timezone.utc)
    devices_by_id = {}

    for row in rows:
        online = False
        if row["last_seen"] is not None:
            last_seen = datetime.fromisoformat(row["last_seen"])
            online = (now - last_seen).total_seconds() < ONLINE_THRESHOLD_SECONDS

        reported = json.loads(row["reported_json"])
        devices_by_id[row["device_id"]] = {
            "deviceId": row["device_id"],
            "name": registered.get(row["device_id"], {}).get("name"),
            "online": online,
            "lastSeen": row["last_seen"],
            "temperature": reported.get("temperature"),
            "firmware": reported.get("firmware"),
        }

    for device_id, info in registered.items():
        if device_id not in devices_by_id:
            devices_by_id[device_id] = {
                "deviceId": device_id,
                "name": info["name"],
                "online": False,
                "lastSeen": None,
                "temperature": None,
                "firmware": None,
            }

    return [devices_by_id[k] for k in sorted(devices_by_id)]


def upsert_desired(device_id: str, desired_updates: dict) -> dict:
    """Shallow-merge desired_updates into the twin's desired state, creating
    the twin row if it doesn't exist yet, and return the merged desired dict.
    """
    conn = get_connection()
    row = conn.execute(
        "SELECT desired_json FROM twin WHERE device_id = ?", (device_id,)
    ).fetchone()

    desired = json.loads(row["desired_json"]) if row else {}
    desired.update(desired_updates)

    conn.execute(
        """
        INSERT INTO twin (device_id, desired_json)
        VALUES (?, ?)
        ON CONFLICT(device_id) DO UPDATE SET desired_json = excluded.desired_json
        """,
        (device_id, json.dumps(desired)),
    )
    conn.commit()
    conn.close()
    return desired
