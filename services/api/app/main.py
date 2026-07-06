import logging
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from .db import init_db
from .devices import register_device
from .firmware import FIRMWARE_DIR, get_firmware_by_version, list_firmware, save_firmware
from .mqtt_ingest import start_mqtt_client
from .telemetry import get_telemetry_history
from .twin import get_twin, list_devices, upsert_desired

logging.basicConfig(level=logging.INFO)

mqtt_client = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global mqtt_client
    init_db()
    mqtt_client = start_mqtt_client()
    yield
    if mqtt_client:
        mqtt_client.loop_stop()
        mqtt_client.disconnect()


app = FastAPI(title="Hive IoT API", lifespan=lifespan)

# Local prototype dashboard only, not a public deployment.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/devices")
def read_devices():
    return list_devices()


@app.post("/devices")
def create_device(payload: dict[str, Any]):
    device_id = payload["deviceId"]
    name = payload["name"]
    certificate = payload.get("certificate")
    return register_device(device_id, name, certificate)


@app.get("/devices/{device_id}/twin")
def read_twin(device_id: str):
    twin = get_twin(device_id)
    if twin is None:
        raise HTTPException(status_code=404, detail="Device not found")
    return twin


@app.get("/devices/{device_id}/telemetry")
def read_telemetry(device_id: str, limit: int = 100):
    return get_telemetry_history(device_id, limit)


@app.post("/devices/{device_id}/desired")
def set_desired(device_id: str, desired: dict[str, Any]):
    merged = upsert_desired(device_id, desired)
    firmware = merged.get("firmware")
    if mqtt_client is not None and firmware is not None:
        mqtt_client.publish(
            f"devices/{device_id}/twin/desired/firmware", firmware, retain=True
        )
    return {"deviceId": device_id, "desired": merged}


@app.get("/firmware")
def read_firmware():
    return list_firmware()


@app.post("/firmware")
def upload_firmware(version: str = Form(...), file: UploadFile = File(...)):
    return save_firmware(version, file)


@app.get("/firmware/{version}/download")
def download_firmware(version: str):
    record = get_firmware_by_version(version)
    if record is None:
        raise HTTPException(status_code=404, detail="Firmware not found")
    return FileResponse(
        FIRMWARE_DIR / record["filename"],
        filename=record["filename"],
        media_type="application/octet-stream",
    )
