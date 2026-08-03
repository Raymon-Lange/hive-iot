import os
import sqlite3
from pathlib import Path

DEFAULT_DB_PATH = Path(__file__).resolve().parent.parent / "data" / "hive_iot.db"
DB_PATH = Path(os.environ.get("HIVE_DB_PATH", DEFAULT_DB_PATH))
DB_PATH.parent.mkdir(parents=True, exist_ok=True)


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    conn = get_connection()
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS telemetry (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            device_id TEXT NOT NULL,
            temperature REAL NOT NULL,
            rssi REAL,
            uptime INTEGER,
            timestamp TEXT NOT NULL DEFAULT (datetime('now'))
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS twin (
            device_id TEXT PRIMARY KEY,
            reported_json TEXT NOT NULL DEFAULT '{}',
            desired_json TEXT NOT NULL DEFAULT '{}',
            last_seen TEXT
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS devices (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            certificate TEXT
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS firmware (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            version TEXT NOT NULL,
            filename TEXT NOT NULL,
            uploaded_at TEXT NOT NULL
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS rollouts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            firmware_version TEXT NOT NULL,
            bake_minutes INTEGER NOT NULL,
            status TEXT NOT NULL DEFAULT 'baking',
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS rollout_devices (
            rollout_id INTEGER NOT NULL REFERENCES rollouts(id),
            device_id TEXT NOT NULL,
            previous_version TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            updated_at TEXT,
            reverted_at TEXT,
            PRIMARY KEY (rollout_id, device_id)
        )
        """
    )
    conn.commit()
    conn.close()
