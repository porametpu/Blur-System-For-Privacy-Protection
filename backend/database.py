from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os

DATABASE_URL = "sqlite:///./blursystem.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

from sqlalchemy import text

def init_db():
    from models import Base as ModelsBase
    ModelsBase.metadata.create_all(bind=engine)
    with engine.begin() as conn:
        try:
            conn.execute(text("ALTER TABLE manual_blur_boxes ADD COLUMN end_frame_number INTEGER"))
        except Exception:
            pass
        try:
            conn.execute(text("ALTER TABLE manual_blur_boxes ADD COLUMN engine_preset VARCHAR"))
        except Exception:
            pass
