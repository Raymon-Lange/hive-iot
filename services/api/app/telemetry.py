from datetime import datetime, timedelta
from typing import Literal

from .db import get_connection

_RANGE_DELTAS = {"1h": timedelta(hours=1), "24h": timedelta(hours=24), "7d": timedelta(days=7)}


def get_telemetry_history(device_id: str, range: Literal["1h", "24h", "7d"] = "1h") -> list[dict]:
    since = (datetime.utcnow() - _RANGE_DELTAS[range]).strftime("%Y-%m-%d %H:%M:%S")
    conn = get_connection()
    if range in ("1h", "24h"):
        rows = conn.execute(
            """
            SELECT temperature, rssi, uptime, timestamp
            FROM telemetry
            WHERE device_id = ? AND timestamp > ?
            ORDER BY timestamp ASC
            """,
            (device_id, since),
        ).fetchall()
    else:
        # Downsample to 30-minute buckets (1800s) so a week of data stays
        # readable in the chart/table instead of ~10k raw points.
        rows = conn.execute(
            """
            SELECT
                datetime((CAST(strftime('%s', timestamp) AS INTEGER) / 1800) * 1800, 'unixepoch') AS timestamp,
                AVG(temperature) AS temperature,
                AVG(rssi) AS rssi,
                MAX(uptime) AS uptime
            FROM telemetry
            WHERE device_id = ? AND timestamp > ?
            GROUP BY CAST(strftime('%s', timestamp) AS INTEGER) / 1800
            ORDER BY timestamp ASC
            """,
            (device_id, since),
        ).fetchall()
    conn.close()
    return [dict(row) for row in rows]


def count_telemetry_since(device_id: str, since: str) -> int:
    """since is a SQLite datetime('now')-shaped string ('YYYY-MM-DD HH:MM:SS')."""
    conn = get_connection()
    row = conn.execute(
        "SELECT COUNT(*) AS n FROM telemetry WHERE device_id = ? AND timestamp > ?",
        (device_id, since),
    ).fetchone()
    conn.close()
    return row["n"]
