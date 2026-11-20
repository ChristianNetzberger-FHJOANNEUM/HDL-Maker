"""FastAPI entry point. Bind this server to localhost only."""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import __version__
from app.api.health import router as health_router
from app.api.libraries import router as libraries_router

app = FastAPI(title="HDL Design Studio", version=__version__)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5173",
        "http://localhost:5173",
    ],
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["*"],
)

app.include_router(health_router, prefix="/api")
app.include_router(libraries_router, prefix="/api")
