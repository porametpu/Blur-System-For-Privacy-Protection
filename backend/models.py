from sqlalchemy import Column, Integer, String, Float, Boolean, ForeignKey, DateTime, LargeBinary
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from database import Base

def utcnow():
    return datetime.now(timezone.utc)

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=True)
    full_name = Column(String, nullable=True)
    google_id = Column(String, unique=True, index=True, nullable=True)
    avatar_url = Column(String, nullable=True)
    created_at = Column(DateTime, default=utcnow)

    videos = relationship("Video", back_populates="user", cascade="all, delete-orphan")


class Video(Base):
    __tablename__ = "videos"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    filename = Column(String, index=True)
    original_path = Column(String)
    fps = Column(Float)
    width = Column(Integer)
    height = Column(Integer)
    total_frames = Column(Integer)
    duration_seconds = Column(Float)
    status = Column(String, default="uploaded")
    created_at = Column(DateTime, default=utcnow)

    user = relationship("User", back_populates="videos")
    preview_frames = relationship("PreviewFrame", back_populates="video", cascade="all, delete-orphan")
    detected_faces = relationship("DetectedFace", back_populates="video", cascade="all, delete-orphan")
    identities = relationship("Identity", back_populates="video", cascade="all, delete-orphan")
    blur_selections = relationship("BlurSelection", back_populates="video", cascade="all, delete-orphan")
    manual_blur_boxes = relationship("ManualBlurBox", back_populates="video", cascade="all, delete-orphan")


class PreviewFrame(Base):
    __tablename__ = "preview_frames"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    video_id = Column(Integer, ForeignKey("videos.id"))
    frame_number = Column(Integer)
    timestamp_ms = Column(Float)
    thumbnail_path = Column(String)

    video = relationship("Video", back_populates="preview_frames")


class Identity(Base):
    __tablename__ = "identities"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    video_id = Column(Integer, ForeignKey("videos.id"))
    label = Column(String)
    representative_thumbnail = Column(String, nullable=True) # Base64 encoded or path
    avg_embedding = Column(LargeBinary, nullable=True)
    appearance_count = Column(Integer, default=0)
    avg_confidence = Column(Float, default=0.0)

    video = relationship("Video", back_populates="identities")
    detected_faces = relationship("DetectedFace", back_populates="identity")
    blur_selection = relationship("BlurSelection", back_populates="identity", uselist=False, cascade="all, delete-orphan")
    timeline_entries = relationship("TimelineEntry", back_populates="identity", cascade="all, delete-orphan")


class DetectedFace(Base):
    __tablename__ = "detected_faces"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    video_id = Column(Integer, ForeignKey("videos.id"))
    frame_number = Column(Integer)
    bbox_x1 = Column(Integer)
    bbox_y1 = Column(Integer)
    bbox_x2 = Column(Integer)
    bbox_y2 = Column(Integer)
    confidence = Column(Float)
    embedding = Column(LargeBinary, nullable=True)
    identity_id = Column(Integer, ForeignKey("identities.id"), nullable=True)

    video = relationship("Video", back_populates="detected_faces")
    identity = relationship("Identity", back_populates="detected_faces")


class BlurSelection(Base):
    __tablename__ = "blur_selections"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    video_id = Column(Integer, ForeignKey("videos.id"))
    identity_id = Column(Integer, ForeignKey("identities.id"))
    should_blur = Column(Boolean, default=True)

    video = relationship("Video", back_populates="blur_selections")
    identity = relationship("Identity", back_populates="blur_selection")


class TimelineEntry(Base):
    __tablename__ = "timeline_entries"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    identity_id = Column(Integer, ForeignKey("identities.id"))
    frame_number = Column(Integer)
    timestamp_ms = Column(Float)

    identity = relationship("Identity", back_populates="timeline_entries")


class ManualBlurBox(Base):
    __tablename__ = "manual_blur_boxes"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    video_id = Column(Integer, ForeignKey("videos.id"))
    start_frame_number = Column(Integer)
    end_frame_number = Column(Integer, nullable=True)
    x = Column(Integer)
    y = Column(Integer)
    width = Column(Integer)
    height = Column(Integer)
    is_tracking = Column(Boolean, default=True)
    engine_preset = Column(String, nullable=True, default="gaussian")

    video = relationship("Video", back_populates="manual_blur_boxes")
