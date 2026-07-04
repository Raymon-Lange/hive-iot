from .db import get_connection


def get_telemetry_history(device_id: str, limit: int = 100) -> list[dict]:
    conn = get_connection()
    rows = conn.execute(
        """
        SELECT temperature, rssi, uptime, timestamp
        FROM telemetry
        WHERE device_id = ?
        ORDER BY id DESC
        LIMIT ?
        """,
        (device_id, limit),
    ).fetchall()
    conn.close()

    history = [dict(row) for row in rows]
    history.reverse()  # chronological order for charting
    return history
