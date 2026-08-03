from datetime import datetime, timedelta, timezone

from .db import get_connection
from .telemetry import count_telemetry_since
from .twin import get_twin, list_devices

TELEMETRY_INTERVAL_SECONDS = 60  # matches the device's telemetry publish cadence
UPDATE_DEADLINE_SECONDS = 300  # max time to wait for reported.firmware to flip to target
CONTINUITY_GRACE_SECONDS = 180  # settle time after update before judging heartbeat continuity
MIN_EXPECTED_RATIO = 0.7  # actual/expected telemetry messages required after grace


def _parse_ts(ts: str) -> datetime:
    return datetime.strptime(ts, "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _elapsed_seconds(ts: str) -> float:
    return (_now() - _parse_ts(ts)).total_seconds()


def create_rollout(firmware_version: str, device_ids: list[str], bake_minutes: int) -> dict:
    """Snapshot each device's current reported firmware (the revert target),
    then create the rollout and its per-device rows.
    """
    previous_versions = {}
    for device_id in device_ids:
        twin = get_twin(device_id)
        previous_version = twin["reported"].get("firmware") if twin else None
        if not previous_version:
            raise ValueError(f"Device {device_id} has no known reported firmware version yet")
        previous_versions[device_id] = previous_version

    conn = get_connection()
    cur = conn.execute(
        "INSERT INTO rollouts (firmware_version, bake_minutes) VALUES (?, ?)",
        (firmware_version, bake_minutes),
    )
    rollout_id = cur.lastrowid
    for device_id, previous_version in previous_versions.items():
        conn.execute(
            "INSERT INTO rollout_devices (rollout_id, device_id, previous_version) VALUES (?, ?, ?)",
            (rollout_id, device_id, previous_version),
        )
    conn.commit()
    conn.close()
    return get_rollout(rollout_id)


def list_rollouts() -> list[dict]:
    conn = get_connection()
    rows = conn.execute(
        "SELECT id, firmware_version, bake_minutes, status, created_at FROM rollouts ORDER BY id DESC"
    ).fetchall()
    result = []
    for row in rows:
        count_row = conn.execute(
            "SELECT COUNT(*) AS n FROM rollout_devices WHERE rollout_id = ?", (row["id"],)
        ).fetchone()
        result.append(
            {
                "id": row["id"],
                "firmwareVersion": row["firmware_version"],
                "bakeMinutes": row["bake_minutes"],
                "status": row["status"],
                "createdAt": row["created_at"],
                "deviceCount": count_row["n"],
            }
        )
    conn.close()
    return result


def get_rollout(rollout_id: int) -> dict | None:
    conn = get_connection()
    row = conn.execute(
        "SELECT id, firmware_version, bake_minutes, status, created_at FROM rollouts WHERE id = ?",
        (rollout_id,),
    ).fetchone()
    if row is None:
        conn.close()
        return None

    device_rows = conn.execute(
        """SELECT device_id, previous_version, status, updated_at, reverted_at
           FROM rollout_devices WHERE rollout_id = ?""",
        (rollout_id,),
    ).fetchall()
    conn.close()

    bake_ends_at = _parse_ts(row["created_at"]) + timedelta(minutes=row["bake_minutes"])
    bake_elapsed = _now() >= bake_ends_at

    devices = []
    all_updated = len(device_rows) > 0
    for d in device_rows:
        twin = get_twin(d["device_id"])
        devices.append(
            {
                "deviceId": d["device_id"],
                "previousVersion": d["previous_version"],
                "status": d["status"],
                "updatedAt": d["updated_at"],
                "revertedAt": d["reverted_at"],
                "online": twin["online"] if twin else False,
                "currentFirmware": twin["reported"].get("firmware") if twin else None,
            }
        )
        if d["status"] != "updated":
            all_updated = False

    ready_to_promote = row["status"] == "baking" and bake_elapsed and all_updated

    return {
        "id": row["id"],
        "firmwareVersion": row["firmware_version"],
        "bakeMinutes": row["bake_minutes"],
        "status": row["status"],
        "createdAt": row["created_at"],
        "bakeEndsAt": bake_ends_at.strftime("%Y-%m-%d %H:%M:%S"),
        "readyToPromote": ready_to_promote,
        "devices": devices,
    }


def list_active_rollouts() -> list[dict]:
    conn = get_connection()
    rows = conn.execute("SELECT id FROM rollouts WHERE status = 'baking'").fetchall()
    conn.close()
    return [get_rollout(row["id"]) for row in rows]


def evaluate_rollout(rollout: dict) -> list[dict]:
    """Pure decision function: given a rollout's current state (as returned by
    get_rollout), decide what should happen to each of its canary devices.
    Never touches MQTT or the database - callers act on the returned decisions.
    """
    decisions = []
    target_version = rollout["firmwareVersion"]

    for device in rollout["devices"]:
        status = device["status"]
        if status == "failed":
            continue

        device_id = device["deviceId"]

        if status == "pending":
            if device["currentFirmware"] == target_version:
                decisions.append({"deviceId": device_id, "action": "mark_updated"})
            elif _elapsed_seconds(rollout["createdAt"]) > UPDATE_DEADLINE_SECONDS:
                decisions.append(
                    {
                        "deviceId": device_id,
                        "action": "revert",
                        "revertToVersion": device["previousVersion"],
                    }
                )
            continue

        if status == "updated":
            if device["updatedAt"] is None:
                continue
            elapsed_since_update = _elapsed_seconds(device["updatedAt"])
            if elapsed_since_update < CONTINUITY_GRACE_SECONDS:
                continue
            expected = elapsed_since_update / TELEMETRY_INTERVAL_SECONDS
            actual = count_telemetry_since(device_id, since=device["updatedAt"])
            ratio = (actual / expected) if expected > 0 else 1.0
            if ratio < MIN_EXPECTED_RATIO:
                decisions.append(
                    {
                        "deviceId": device_id,
                        "action": "revert",
                        "revertToVersion": device["previousVersion"],
                    }
                )

    return decisions


def claim_mark_updated(rollout_id: int, device_id: str) -> bool:
    conn = get_connection()
    cur = conn.execute(
        """UPDATE rollout_devices SET status = 'updated', updated_at = datetime('now')
           WHERE rollout_id = ? AND device_id = ? AND status = 'pending'""",
        (rollout_id, device_id),
    )
    conn.commit()
    won = cur.rowcount == 1
    conn.close()
    return won


def claim_revert(rollout_id: int, device_id: str) -> bool:
    """Atomically claim the right to revert a device. reverted_at IS NULL is
    the idempotency guard - only the caller that wins this UPDATE should
    perform the actual MQTT publish/desired-state revert.
    """
    conn = get_connection()
    cur = conn.execute(
        """UPDATE rollout_devices SET status = 'failed', reverted_at = datetime('now')
           WHERE rollout_id = ? AND device_id = ? AND reverted_at IS NULL""",
        (rollout_id, device_id),
    )
    won = cur.rowcount == 1
    if won:
        conn.execute(
            "UPDATE rollouts SET status = 'failed' WHERE id = ? AND status = 'baking'",
            (rollout_id,),
        )
    conn.commit()
    conn.close()
    return won


def promote_rollout(rollout_id: int) -> dict:
    rollout = get_rollout(rollout_id)
    if rollout is None:
        raise ValueError("Rollout not found")
    if rollout["status"] != "baking":
        raise ValueError(f"Rollout is not baking (status={rollout['status']})")
    if not rollout["readyToPromote"]:
        raise ValueError("Rollout is not ready to promote yet")

    conn = get_connection()
    cur = conn.execute(
        "UPDATE rollouts SET status = 'promoted' WHERE id = ? AND status = 'baking'",
        (rollout_id,),
    )
    conn.commit()
    conn.close()
    if cur.rowcount != 1:
        raise ValueError("Rollout was already promoted or failed")

    canary_device_ids = {d["deviceId"] for d in rollout["devices"]}
    target_device_ids = [
        d["deviceId"] for d in list_devices() if d["deviceId"] not in canary_device_ids
    ]

    return {
        "rollout": get_rollout(rollout_id),
        "targetDeviceIds": target_device_ids,
    }
