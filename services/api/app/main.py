import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI

from .db import init_db
from .mqtt_ingest import start_mqtt_client

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
