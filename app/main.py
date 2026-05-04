from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import documents, runs, approvals, admin, audit, jira_history, notifications


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield


app = FastAPI(
    title="CRI/Feature Request Workflow",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(documents.router)
app.include_router(runs.router)
app.include_router(approvals.router)
app.include_router(admin.router)
app.include_router(audit.router)
app.include_router(jira_history.router)
app.include_router(notifications.router)


@app.get("/health")
async def health():
    return {"status": "ok"}
