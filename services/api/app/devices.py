from .db import get_connection


def register_device(device_id: str, name: str, certificate: str | None = None) -> dict:
    conn = get_connection()
    conn.execute(
        """
        INSERT INTO devices (id, name, certificate)
        VALUES (?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET name = excluded.name, certificate = excluded.certificate
        """,
        (device_id, name, certificate),
    )
    conn.commit()
    conn.close()
    return {"deviceId": device_id, "name": name, "certificate": certificate}


def list_registered_devices() -> dict[str, dict]:
    conn = get_connection()
    rows = conn.execute("SELECT id, name, certificate FROM devices").fetchall()
    conn.close()
    return {
        row["id"]: {"name": row["name"], "certificate": row["certificate"]}
        for row in rows
    }
