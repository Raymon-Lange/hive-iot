import logging
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, HTTPException

from .db import init_db
from .mqtt_ingest import start_mqtt_client
from .twin import get_twin, upsert_desired

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


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/devices/{device_id}/twin")
def read_twin(device_id: str):
    twin = get_twin(device_id)
    if twin is None:
        raise HTTPException(status_code=404, detail="Device not found")
    return twin


@app.post("/devices/{device_id}/desired")
def set_desired(device_id: str, desired: dict[str, Any]):
    return {"deviceId": device_id, "desired": upsert_desired(device_id, desired)}
