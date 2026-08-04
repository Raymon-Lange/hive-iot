import asyncio
import contextlib
import logging
from contextlib import asynccontextmanager
from typing import Any, Literal

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from .db import init_db
from .devices import register_device
from .firmware import FIRMWARE_DIR, get_firmware_by_version, list_firmware, save_firmware
from .mqtt_ingest import start_mqtt_client
from .rollout import (
    claim_mark_updated,
    claim_revert,
    create_rollout,
    evaluate_rollout,
    get_rollout,
    list_active_rollouts,
    list_rollouts,
    promote_rollout,
)
from .telemetry import get_telemetry_history
from .twin import get_twin, list_devices, upsert_desired

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

mqtt_client = None

ROLLOUT_EVAL_INTERVAL_SECONDS = 30


def _rollout_evaluator_tick() -> None:
    for rollout in list_active_rollouts():
        for decision in evaluate_rollout(rollout):
            if decision["action"] == "mark_updated":
                claim_mark_updated(rollout["id"], decision["deviceId"])
            elif decision["action"] == "revert":
                if claim_revert(rollout["id"], decision["deviceId"]):
                    upsert_desired(decision["deviceId"], {"firmware": decision["revertToVersion"]})
                    if mqtt_client is not None:
                        mqtt_client.publish(
                            f"devices/{decision['deviceId']}/twin/desired/firmware",
                            decision["revertToVersion"],
                            retain=True,
                        )
                    logger.warning(
                        "Auto-reverted %s to %s (rollout %s failed)",
                        decision["deviceId"],
                        decision["revertToVersion"],
                        rollout["id"],
                    )


async def _rollout_evaluator_loop() -> None:
    while True:
        await asyncio.sleep(ROLLOUT_EVAL_INTERVAL_SECONDS)
        try:
            _rollout_evaluator_tick()
        except Exception:
            logger.exception("Rollout evaluator tick failed")


@asynccontextmanager
async def lifespan(app: FastAPI):
    global mqtt_client
    init_db()
    mqtt_client = start_mqtt_client()
    evaluator_task = asyncio.create_task(_rollout_evaluator_loop())
    yield
    evaluator_task.cancel()
    with contextlib.suppress(asyncio.CancelledError):
        await evaluator_task
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
def read_telemetry(device_id: str, range: Literal["24h", "7d"] = "24h"):
    return get_telemetry_history(device_id, range)


@app.post("/devices/{device_id}/desired")
def set_desired(device_id: str, desired: dict[str, Any]):
    merged = upsert_desired(device_id, desired)
    if mqtt_client is not None:
        for key in ("firmware", "mode", "temp", "sensorMode"):
            value = merged.get(key)
            if value is not None:
                mqtt_client.publish(
                    f"devices/{device_id}/twin/desired/{key}", value, retain=True
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


@app.post("/rollouts", status_code=201)
def create_rollout_route(payload: dict[str, Any]):
    firmware_version = payload["firmwareVersion"]
    device_ids = payload["deviceIds"]
    bake_minutes = payload["bakeMinutes"]

    if get_firmware_by_version(firmware_version) is None:
        raise HTTPException(status_code=404, detail="Firmware version not found")
    if not device_ids:
        raise HTTPException(status_code=400, detail="At least one device required")
    if list_active_rollouts():
        raise HTTPException(status_code=409, detail="A rollout is already in progress")

    try:
        rollout = create_rollout(firmware_version, device_ids, bake_minutes)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    for device_id in device_ids:
        upsert_desired(device_id, {"firmware": firmware_version})
        if mqtt_client is not None:
            mqtt_client.publish(
                f"devices/{device_id}/twin/desired/firmware", firmware_version, retain=True
            )

    return rollout


@app.get("/rollouts")
def read_rollouts():
    return list_rollouts()


@app.get("/rollouts/{rollout_id}")
def read_rollout(rollout_id: int):
    rollout = get_rollout(rollout_id)
    if rollout is None:
        raise HTTPException(status_code=404, detail="Rollout not found")
    return rollout


@app.post("/rollouts/{rollout_id}/promote")
def promote_rollout_route(rollout_id: int):
    try:
        result = promote_rollout(rollout_id)
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))

    firmware_version = result["rollout"]["firmwareVersion"]
    for device_id in result["targetDeviceIds"]:
        upsert_desired(device_id, {"firmware": firmware_version})
        if mqtt_client is not None:
            mqtt_client.publish(
                f"devices/{device_id}/twin/desired/firmware", firmware_version, retain=True
            )

    return result["rollout"]
