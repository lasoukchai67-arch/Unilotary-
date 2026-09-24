import os
from datetime import date, timedelta
import uuid
from decimal import Decimal
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import settings
from app.core.database import engine, Base, SessionLocal
from app.models import User, Animal, DrawPeriod, Wallet, Ticket
from app.services.lottery_service import LAO_ANIMALS
from app.core.security import hash_pin

from app.api.v1.auth import router as auth_router
from app.api.v1.lottery import router as lottery_router
from app.api.v1.finance import router as finance_router
from app.api.v1.audit import router as audit_router
from app.api.v1.docs import router as docs_router

# Initialize FastAPI
app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
    description="Enterprise 3-Tier Lao Lottery Platform (Sokxay Plus Parity) with Double-Entry Ledger and Immutable Audit"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    # Create tables
    Base.metadata.create_all(bind=engine)

    # Seed master data
    db = SessionLocal()
    try:
        # 1. Seed Animals
        if db.query(Animal).count() == 0:
            for item in LAO_ANIMALS:
                a = Animal(
                    animal_id=item["id"],
                    animal_name_lo=item["name_lo"],
                    animal_name_en=item["name_en"],
                    base_number=item["base"],
                    related_numbers=item["related"],
                    icon_symbol=item["icon"]
                )
                db.add(a)
            db.commit()

        # 2. Seed Default Admin & Demo Player
        if db.query(User).count() == 0:
            admin_user = User(
                user_id=str(uuid.uuid4()),
                phone_number="02099999999",
                full_name="System Auditor / Admin",
                pin_hash=hash_pin("888888"),
                role="Admin"
            )
            demo_player = User(
                user_id=str(uuid.uuid4()),
                phone_number="02055556666",
                full_name="Sokxay Player",
                pin_hash=hash_pin("123456"),
                role="Player"
            )
            db.add(admin_user)
            db.add(demo_player)
            db.commit()

            # Wallets
            db.add(Wallet(
                wallet_id=str(uuid.uuid4()),
                user_id=demo_player.user_id,
                currency="LAK",
                balance=Decimal("150000.00")
            ))
            db.commit()

        # 3. Seed Draw Periods (Open Today & Past)
        today = date.today()
        existing_open = db.query(DrawPeriod).filter(DrawPeriod.status == "OPEN").first()
        if not existing_open:
            active_draw = DrawPeriod(
                period_id=str(uuid.uuid4()),
                period_code=f"DRAW-{today.strftime('%Y%m%d')}-01",
                draw_date=today,
                status="OPEN"
            )
            db.add(active_draw)

            past_date = today - timedelta(days=2)
            past_draw = DrawPeriod(
                period_id=str(uuid.uuid4()),
                period_code=f"DRAW-{past_date.strftime('%Y%m%d')}-01",
                draw_date=past_date,
                status="DRAWN",
                winning_number_6="582914",
                winning_animal_id=14
            )
            db.add(past_draw)
            db.commit()

    finally:
        db.close()


# Mount API Routers
app.include_router(auth_router, prefix=settings.API_V1_PREFIX)
app.include_router(lottery_router, prefix=settings.API_V1_PREFIX)
app.include_router(finance_router, prefix=settings.API_V1_PREFIX)
app.include_router(audit_router, prefix=settings.API_V1_PREFIX)
app.include_router(docs_router, prefix=settings.API_V1_PREFIX)


@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "app": settings.APP_NAME,
        "version": "1.0.0",
        "timestamp": str(date.today())
    }


# Mount Frontend static files
from fastapi.responses import FileResponse

frontend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "frontend"))
if os.path.exists(frontend_dir):
    # Mount sub-directories
    public_dir = os.path.join(frontend_dir, "public")
    src_dir = os.path.join(frontend_dir, "src")
    if os.path.exists(public_dir):
        app.mount("/icons", StaticFiles(directory=os.path.join(public_dir, "icons")), name="icons")
        
        @app.get("/manifest.json")
        def get_manifest():
            return FileResponse(os.path.join(public_dir, "manifest.json"), media_type="application/manifest+json")

        @app.get("/sw.js")
        def get_sw():
            return FileResponse(os.path.join(public_dir, "sw.js"), media_type="application/javascript")

    if os.path.exists(src_dir):
        app.mount("/src", StaticFiles(directory=src_dir), name="src")

    @app.get("/")
    def serve_frontend_index():
        return FileResponse(os.path.join(frontend_dir, "index.html"))

