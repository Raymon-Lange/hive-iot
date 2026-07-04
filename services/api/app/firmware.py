import shutil
from datetime import datetime, timezone
from pathlib import Path

from fastapi import UploadFile

from .db import get_connection

FIRMWARE_DIR = Path(__file__).resolve().parent.parent / "data" / "firmware"
FIRMWARE_DIR.mkdir(parents=True, exist_ok=True)


def save_firmware(version: str, file: UploadFile) -> dict:
    filename = f"{version}_{file.filename}"
    dest = FIRMWARE_DIR / filename
    with dest.open("wb") as f:
        shutil.copyfileobj(file.file, f)

    uploaded_at = datetime.now(timezone.utc).isoformat()
    conn = get_connection()
    conn.execute(
        "INSERT INTO firmware (version, filename, uploaded_at) VALUES (?, ?, ?)",
        (version, filename, uploaded_at),
    )
    conn.commit()
    conn.close()

    return {"version": version, "filename": filename, "uploadedAt": uploaded_at}


def list_firmware() -> list[dict]:
    conn = get_connection()
    rows = conn.execute(
        "SELECT version, filename, uploaded_at FROM firmware ORDER BY id DESC"
    ).fetchall()
    conn.close()
    return [
        {"version": r["version"], "filename": r["filename"], "uploadedAt": r["uploaded_at"]}
        for r in rows
    ]
