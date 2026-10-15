from fastapi import APIRouter

from app.api.routes import discussions, followups, health, leads

api_router = APIRouter(prefix="/api")
api_router.include_router(health.router)
api_router.include_router(leads.router)
api_router.include_router(discussions.router)
api_router.include_router(followups.router)
