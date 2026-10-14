import os
import re
import shutil
import cv2
import uuid
import base64
import json
import time
from fastapi import FastAPI, File, UploadFile, HTTPException, Form, Depends, BackgroundTasks, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
import cloudinary
import cloudinary.uploader
from dotenv import load_dotenv

from typing import Optional
from pydantic import BaseModel
from database import init_db, get_db
from models import Video, PreviewFrame, Identity, DetectedFace, BlurSelection, TimelineEntry, ManualBlurBox, User
from services.detection import FaceDetectionService
from services.recognition import FaceRecognitionService
from services.tracking import SimpleTracker
from services.rendering import RenderingService
from services.auth import hash_password, verify_password, create_access_token, decode_access_token
import numpy as np

load_dotenv()

# Setup Cloudinary
cloudinary.config(
    cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
    api_key=os.getenv("CLOUDINARY_API_KEY"),
    api_secret=os.getenv("CLOUDINARY_API_SECRET")
)

app = FastAPI(title="BlurSystem API v2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

MAX_UPLOAD_BYTES = 500 * 1024 * 1024  # 500 MB
ALLOWED_VIDEO_EXT = {'mp4', 'mov', 'avi', 'mkv', 'webm'}
ALLOWED_IMAGE_EXT = {'jpg', 'jpeg', 'png', 'webp'}
ALLOWED_BLUR_TYPES = {'gaussian', 'pixelate', 'black'}

def sanitize_filename(filename: str | None) -> str:
    if not filename:
        return "upload.bin"
    base = os.path.basename(filename)
    base = re.sub(r'[^\w.\-]', '_', base)
    return base or "upload.bin"

# Model Backend Schema
class ModelBackendRequest(BaseModel):
    backend: str  # "pytorch" | "torchscript" | "onnx" | "tensorrt"

class ModelSelectionRequest(BaseModel):
    model: str

class WebcamFrameRequest(BaseModel):
    image: str
    model: str | None = None
    session_id: str | None = None

# Client Detection Schemas
class BBoxInput(BaseModel):
    x1: int
    y1: int
    x2: int
    y2: int

class ClientFaceDetection(BaseModel):
    bbox: BBoxInput
    confidence: float

class FrameDetectionInput(BaseModel):
    frame_number: int
    detections: list[ClientFaceDetection]

class ClientDetectionsRequest(BaseModel):
    frame_detections: list[FrameDetectionInput]

# Auth Schemas & Dependencies
class RegisterRequest(BaseModel):
    email: str
    password: str
    full_name: str | None = None

class LoginRequest(BaseModel):
    email: str
    password: str

class GoogleLoginRequest(BaseModel):
    token: str | None = None
    email: str
    full_name: str | None = None
    google_id: str
    avatar_url: str | None = None

def get_current_user_optional(authorization: str | None = Header(None), db: Session = Depends(get_db)) -> User | None:
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization.split(" ")[1]
    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        return None
    return db.query(User).filter(User.id == int(payload["sub"])).first()

def get_current_user(user: User | None = Depends(get_current_user_optional)) -> User:
    if not user:
        raise HTTPException(401, "Not authenticated")
    return user

# Auth API Endpoints
@app.post("/api/auth/register")
async def register_user(req: RegisterRequest, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == req.email.lower().strip()).first()
    if existing:
        raise HTTPException(400, "Email already registered")
    
    pw_hash = hash_password(req.password)
    user = User(
        email=req.email.lower().strip(),
        password_hash=pw_hash,
        full_name=req.full_name or req.email.split('@')[0],
        avatar_url=f"https://api.dicebear.com/7.x/bottts/svg?seed={req.email}"
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token({"sub": str(user.id), "email": user.email})
    return {
        "access_token": token,
        "user": {
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "avatar_url": user.avatar_url
        }
    }

@app.post("/api/auth/login")
async def login_user(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == req.email.lower().strip()).first()
    if not user or not user.password_hash or not verify_password(req.password, user.password_hash):
        raise HTTPException(401, "Invalid email or password")

    token = create_access_token({"sub": str(user.id), "email": user.email})
    return {
        "access_token": token,
        "user": {
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "avatar_url": user.avatar_url
        }
    }

@app.post("/api/auth/google")
async def google_login(req: GoogleLoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter((User.google_id == req.google_id) | (User.email == req.email.lower().strip())).first()
    if user:
        if not user.google_id:
            user.google_id = req.google_id
        if req.avatar_url and not user.avatar_url:
            user.avatar_url = req.avatar_url
        db.commit()
    else:
        user = User(
            email=req.email.lower().strip(),
            full_name=req.full_name or "Google User",
            google_id=req.google_id,
            avatar_url=req.avatar_url or f"https://api.dicebear.com/7.x/bottts/svg?seed={req.email}"
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    token = create_access_token({"sub": str(user.id), "email": user.email})
    return {
        "access_token": token,
        "user": {
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "avatar_url": user.avatar_url
        }
    }

@app.get("/api/auth/me")
async def get_me(user: User = Depends(get_current_user)):
    return {
        "id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "avatar_url": user.avatar_url
    }

@app.get("/api/history")
async def get_history(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    videos = db.query(Video).filter(Video.user_id == user.id).order_by(Video.created_at.desc()).all()
    result = []
    for v in videos:
        ext = v.original_path.split('.')[-1].lower() if v.original_path else 'mp4'
        is_img = ext in ALLOWED_IMAGE_EXT
        result.append({
            "id": v.id,
            "filename": v.filename,
            "status": v.status,
            "is_image": is_img,
            "created_at": v.created_at.isoformat() if v.created_at else None,
            "download_url": f"/api/serve-video/{v.id}/export",
            "preview_url": f"/api/serve-video/{v.id}/preview" if os.path.exists(f"temp/previews/{v.id}/preview_blur.{ext}") else None,
        })
    return result

# Globals for services
detection_service = None
recognition_service = None

processing_status = {}
webcam_sessions: dict[str, dict] = {}

@app.on_event("startup")
def startup_event():
    os.makedirs("uploads", exist_ok=True)
    os.makedirs("temp/previews", exist_ok=True)
    os.makedirs("processed", exist_ok=True)
    init_db()
    
    global detection_service, recognition_service
    detection_service = FaceDetectionService()
    recognition_service = FaceRecognitionService()

def ndarray_to_base64(img):
    if img is None or img.size == 0:
        return None
    _, buffer = cv2.imencode('.jpg', img)
    return base64.b64encode(buffer).decode('utf-8')


# Recognition tuning values. These should be calibrated against representative
# frames from the application's real videos.
RECOGNITION_THRESHOLD = 0.50
IDENTITY_MERGE_THRESHOLD = 0.58
# Occluded/partial singleton crops can have a much lower ArcFace similarity.
# This relaxed value is used only when attaching a one-sample group to an
# established identity; normal identity matching remains at 0.50.
SINGLETON_MERGE_THRESHOLD = 0.25
MAX_IDENTITY_EMBEDDINGS = 8


def _identity_similarity(a: dict, b: dict) -> float:
    """Return the strongest similarity between two identities' samples."""
    samples_a = a.get("embeddings") or [a.get("avg_embedding")]
    samples_b = b.get("embeddings") or [b.get("avg_embedding")]
    best = -1.0
    for emb_a in samples_a:
        for emb_b in samples_b:
            if emb_a is not None and emb_b is not None:
                best = max(best, recognition_service.compute_similarity(emb_a, emb_b))
    return best


def _merge_similar_identities(identities: list[dict]) -> dict[int, int]:
    """Merge duplicate temporary groups and return old-id -> surviving-id map."""
    parent = {item["identity_id"]: item["identity_id"] for item in identities}

    def find(value):
        while parent[value] != value:
            parent[value] = parent[parent[value]]
            value = parent[value]
        return value

    def union(left, right):
        left, right = find(left), find(right)
        if left != right:
            parent[right] = left

    for i, left in enumerate(identities):
        for right in identities[i + 1:]:
            similarity = _identity_similarity(left, right)
            # YuNet can produce a single low-quality/occluded face crop that
            # falls below the normal threshold. Prefer attaching such sparse
            # groups to a well-established identity when similarity is still
            # meaningful, instead of exposing a duplicate Person card.
            # A newly appearing/partially occluded face can form a singleton
            # group before it gets enough recognition samples. Compare that
            # singleton against established groups with the relaxed threshold;
            # requiring at least two samples in the larger group avoids making
            # two one-off detections merge too easily.
            is_sparse_pair = min(left["count"], right["count"]) <= 1 and max(left["count"], right["count"]) >= 2
            merge_threshold = SINGLETON_MERGE_THRESHOLD if is_sparse_pair else IDENTITY_MERGE_THRESHOLD
            if similarity >= merge_threshold:
                union(left["identity_id"], right["identity_id"])

    groups = {}
    for item in identities:
        groups.setdefault(find(item["identity_id"]), []).append(item)

    remap = {}
    for survivor, members in groups.items():
        for member in members:
            remap[member["identity_id"]] = survivor
        if len(members) > 1:
            merged = [emb for member in members for emb in (member.get("embeddings") or [])]
            survivor_item = next(member for member in members if member["identity_id"] == survivor)
            survivor_item["embeddings"] = merged[-MAX_IDENTITY_EMBEDDINGS:]
            survivor_item["count"] = sum(member["count"] for member in members)
            avg = np.mean(merged, axis=0)
            survivor_item["avg_embedding"] = avg / max(np.linalg.norm(avg), 1e-6)
    return remap


def _add_embedding_to_identity(identity: dict, embedding: np.ndarray, confidence: float):
    identity["count"] += 1
    identity.setdefault("embeddings", []).append(embedding)
    identity["embeddings"] = identity["embeddings"][-MAX_IDENTITY_EMBEDDINGS:]
    avg = np.mean(identity["embeddings"], axis=0)
    identity["avg_embedding"] = avg / max(np.linalg.norm(avg), 1e-6)
    identity["conf"] = (identity["conf"] * (identity["count"] - 1) + confidence) / identity["count"]


def _match_stable_identity(embedding: np.ndarray, identities: list[dict]) -> int | None:
    """Recover a low-quality sample when one established identity is clearly best."""
    candidates = []
    for identity in identities:
        if identity.get("count", 0) < 2:
            continue
        samples = identity.get("embeddings") or [identity.get("avg_embedding")]
        score = max(
            (recognition_service.compute_similarity(embedding, sample) for sample in samples if sample is not None),
            default=-1.0,
        )
        candidates.append((score, identity["identity_id"]))

    candidates.sort(reverse=True)
    if not candidates or candidates[0][0] < SINGLETON_MERGE_THRESHOLD:
        return None
    if len(candidates) > 1 and candidates[0][0] - candidates[1][0] < 0.06:
        return None
    return candidates[0][1]

@app.post("/api/upload")
async def upload_video(
    file: UploadFile = File(...), 
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional)
):
    try:
        ext = file.filename.split('.')[-1].lower()
        is_image = ext in ['jpg', 'jpeg', 'png', 'webp']
        if ext not in ['mp4', 'mov', 'avi', 'mkv', 'webm'] and not is_image:
            raise HTTPException(400, "Only video and image files are supported")
            
        unique_name = f"{uuid.uuid4().hex}_{file.filename}"
        file_path = os.path.join("uploads", unique_name)
        
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        if is_image:
            img = cv2.imread(file_path)
            if img is None:
                raise HTTPException(400, "Invalid image file")
            height, width = img.shape[:2]
            fps = 1.0
            total_frames = 1
            duration = 0.0
        else:
            cap = cv2.VideoCapture(file_path)
            fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
            width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
            height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
            total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            duration = total_frames / fps if fps > 0 else 0.0
            cap.release()
        
        video = Video(
            user_id=current_user.id if current_user else None,
            filename=file.filename,
            original_path=file_path,
            fps=fps,
            width=width,
            height=height,
            total_frames=total_frames,
            duration_seconds=duration,
            status="uploaded"
        )
        db.add(video)
        db.commit()
        db.refresh(video)
        
        return {
            "video_id": video.id,
            "filename": video.filename,
            "fps": video.fps,
            "width": video.width,
            "height": video.height,
            "total_frames": video.total_frames,
            "duration_seconds": video.duration_seconds
        }
    except Exception as e:
        raise HTTPException(500, str(e))

@app.get("/api/preview-frames/{video_id}")
async def get_preview_frames(video_id: int, db: Session = Depends(get_db)):
    video = db.query(Video).filter(Video.id == video_id).first()
    if not video:
        raise HTTPException(404, "Video not found")
        
    existing_frames = db.query(PreviewFrame).filter(PreviewFrame.video_id == video_id).all()
    if existing_frames:
        return {"frames": [{"frame_number": f.frame_number, "timestamp_ms": f.timestamp_ms, "thumbnail_url": f"/api/thumbnail/{video_id}/{f.frame_number}"} for f in existing_frames]}
        
    frames_dir = os.path.join("temp", "previews", str(video_id))
    os.makedirs(frames_dir, exist_ok=True)
    
    interval = max(1, int(video.fps))
    extracted = RenderingService.extract_preview_frames(video.original_path, interval_frames=interval)
    
    result = []
    for frame_num, ts_ms, img in extracted:
        max_w = min(1920, video.width)
        if video.width > max_w:
            thumb = cv2.resize(img, (max_w, int(max_w * (video.height / video.width))), interpolation=cv2.INTER_AREA)
        else:
            thumb = img
        thumb_path = os.path.join(frames_dir, f"frame_{frame_num}.jpg")
        cv2.imwrite(thumb_path, thumb, [int(cv2.IMWRITE_JPEG_QUALITY), 95])
        
        pf = PreviewFrame(video_id=video_id, frame_number=frame_num, timestamp_ms=ts_ms, thumbnail_path=thumb_path)
        db.add(pf)
        result.append({"frame_number": frame_num, "timestamp_ms": ts_ms, "thumbnail_url": f"/api/thumbnail/{video_id}/{frame_num}"})
        
    db.commit()
    return {"frames": result}

@app.get("/api/thumbnail/{video_id}/{frame_number}")
async def serve_thumbnail(video_id: int, frame_number: int, db: Session = Depends(get_db)):
    pf = db.query(PreviewFrame).filter(PreviewFrame.video_id == video_id, PreviewFrame.frame_number == frame_number).first()
    if not pf or not os.path.exists(pf.thumbnail_path):
        raise HTTPException(404, "Thumbnail not found")
    return FileResponse(pf.thumbnail_path)

@app.post("/api/select-keyframes")
async def select_keyframes(video_id: int = Form(...), keyframe_indices: str = Form(...), db: Session = Depends(get_db)):
    video = db.query(Video).filter(Video.id == video_id).first()
    if not video:
        raise HTTPException(404, "Video not found")
        
    indices = json.loads(keyframe_indices)
    video.status = "keyframes_selected"
    db.commit()
    
    return {"status": "ok", "count": len(indices)}

class ManualBoxInput(BaseModel):
    start_frame_number: int
    end_frame_number: Optional[int] = None
    x: int
    y: int
    width: int
    height: int
    is_tracking: bool = True
    engine_preset: Optional[str] = "gaussian"

class ManualBlurRequest(BaseModel):
    boxes: list[ManualBoxInput]

@app.get("/api/manual-blur/{video_id}")
async def get_manual_blur(video_id: int, db: Session = Depends(get_db)):
    boxes = db.query(ManualBlurBox).filter(ManualBlurBox.video_id == video_id).all()
    return {"boxes": [{"id": b.id, "start_frame_number": b.start_frame_number, "end_frame_number": b.end_frame_number, "x": b.x, "y": b.y, "width": b.width, "height": b.height, "is_tracking": b.is_tracking, "engine_preset": b.engine_preset} for b in boxes]}

@app.post("/api/manual-blur/{video_id}")
async def save_manual_blur(video_id: int, req: ManualBlurRequest, db: Session = Depends(get_db)):
    db.query(ManualBlurBox).filter(ManualBlurBox.video_id == video_id).delete()
    for box in req.boxes:
        db.add(ManualBlurBox(
            video_id=video_id,
            start_frame_number=box.start_frame_number,
            end_frame_number=box.end_frame_number,
            x=box.x,
            y=box.y,
            width=box.width,
            height=box.height,
            is_tracking=box.is_tracking,
            engine_preset=box.engine_preset
        ))
    db.commit()
    return {"status": "ok"}

def detection_pipeline(video_id: int, keyframe_indices: list[int], skip_frames: int):
    global processing_status
    skip_frames = max(1, int(skip_frames))
    processing_status[video_id] = {"status": "processing", "progress": 0}
    
    db = next(get_db())
    try:
        video = db.query(Video).filter(Video.id == video_id).first()
        if not video:
            return
            
        cap = cv2.VideoCapture(video.original_path)
        # Keep tracks alive across skipped frames and allow faster-moving
        # faces to associate after their predicted box has shifted. This does
        # not add inference cost because it only changes tracker matching.
        tracker = SimpleTracker(max_age=max(30, skip_frames * 8), min_iou=0.15)
        
        identities = [] # list of dicts: {"identity_id": int, "avg_embedding": np.ndarray, "thumbnail": str, "count": 1, "conf": float}
        next_identity_id = 1
        
        # Clear existing data
        db.query(DetectedFace).filter(DetectedFace.video_id == video_id).delete()
        db.query(Identity).filter(Identity.video_id == video_id).delete()
        db.commit()
        
        frame_idx = 0
        total_frames = video.total_frames
        keyframe_set = set(keyframe_indices)
        
        while True:
            ret, frame = cap.read()
            if not ret:
                break
                
            processing_status[video_id]["progress"] = int((frame_idx / total_frames) * 100)
            
            # Detect on keyframes or interval
            is_keyframe = frame_idx in keyframe_set
            if is_keyframe or frame_idx % skip_frames == 0:
                detections = detection_service.detect_faces(frame)
                
                # Run the expensive face-recognition embedding step only on
                # selected keyframes. Intermediate detector refreshes still
                # update tracking, while existing identity assignments remain
                # attached to matched tracker tracks.
                tracker_input = []
                for det in detections:
                    bbox = det["bbox"]
                    x1, y1, x2, y2 = bbox["x1"], bbox["y1"], bbox["x2"], bbox["y2"]
                    
                    # Use moderate context while avoiding background/neighboring faces.
                    w, h = x2 - x1, y2 - y1
                    if w < 32 or h < 32 or det["confidence"] < 0.30:
                        continue
                    px1, py1 = max(0, int(x1 - w*0.25)), max(0, int(y1 - h*0.25))
                    px2, py2 = min(frame.shape[1], int(x2 + w*0.25)), min(frame.shape[0], int(y2 + h*0.25))
                    crop = frame[py1:py2, px1:px2]
                    
                    emb = recognition_service.extract_embedding(crop) if is_keyframe else None
                    identity_id = None
                    
                    if emb is not None:
                        # Match identity
                        matched_id = recognition_service.match_identity(emb, identities, threshold=RECOGNITION_THRESHOLD)
                        if matched_id is None:
                            matched_id = _match_stable_identity(emb, identities)
                        if matched_id is not None:
                            identity_id = matched_id
                            # Update existing
                            for idx, identity in enumerate(identities):
                                if identity["identity_id"] == identity_id:
                                    _add_embedding_to_identity(identities[idx], emb, det["confidence"])
                                    break
                        else:
                            # New identity
                            identity_id = next_identity_id
                            next_identity_id += 1
                            identities.append({
                                "identity_id": identity_id,
                                "avg_embedding": emb,
                                "embeddings": [emb],
                                "thumbnail": ndarray_to_base64(cv2.resize(crop, (112, 112)) if crop.size > 0 else None),
                                "count": 1,
                                "conf": det["confidence"]
                            })
                            
                    tracker_input.append({
                        "bbox": bbox,
                        "confidence": det["confidence"],
                        "embedding": emb,
                        "identity_id": identity_id
                    })
                    
                # Tracking
                tracks = tracker.update(tracker_input)
            else:
                # Do not run YOLO on skipped frames. Let the tracker advance
                # existing identities using their last velocity until the next
                # scheduled detection refreshes their positions.
                tracks = tracker.update([])
                
            # Save detections to DB
            for track in tracks:
                if track.get("identity_id") is not None:
                    bbox = track["bbox"]
                    df = DetectedFace(
                        video_id=video_id,
                        frame_number=frame_idx,
                        bbox_x1=bbox["x1"], bbox_y1=bbox["y1"], bbox_x2=bbox["x2"], bbox_y2=bbox["y2"],
                        confidence=1.0, # Approximate from track
                        identity_id=track["identity_id"] # We need to map this later
                    )
                    # We store temporarily, we'll fix identity_ids after DB insertion
                    db.add(df)
                    
            frame_idx += 1
            if frame_idx % 100 == 0:
                db.commit()
                
        cap.release()
        db.commit()

        # Fill short internal gaps between confirmed boxes. This is much
        # cheaper than another detector pass and prevents brief tracker misses
        # from becoming visible holes in the rendered blur.
        max_interpolation_gap = max(6, min(15, skip_frames * 4))
        faces_by_identity = {}
        saved_faces = db.query(DetectedFace).filter(
            DetectedFace.video_id == video_id
        ).order_by(DetectedFace.identity_id, DetectedFace.frame_number).all()
        for face in saved_faces:
            faces_by_identity.setdefault(face.identity_id, []).append(face)

        for identity_faces in faces_by_identity.values():
            for previous, following in zip(identity_faces, identity_faces[1:]):
                gap = following.frame_number - previous.frame_number - 1
                if gap <= 0 or gap > max_interpolation_gap:
                    continue
                for step in range(1, gap + 1):
                    ratio = step / (gap + 1)
                    db.add(DetectedFace(
                        video_id=video_id,
                        frame_number=previous.frame_number + step,
                        bbox_x1=round(previous.bbox_x1 + (following.bbox_x1 - previous.bbox_x1) * ratio),
                        bbox_y1=round(previous.bbox_y1 + (following.bbox_y1 - previous.bbox_y1) * ratio),
                        bbox_x2=round(previous.bbox_x2 + (following.bbox_x2 - previous.bbox_x2) * ratio),
                        bbox_y2=round(previous.bbox_y2 + (following.bbox_y2 - previous.bbox_y2) * ratio),
                        confidence=min(previous.confidence, following.confidence),
                        identity_id=previous.identity_id,
                    ))
        db.commit()

        temp_id_remap = _merge_similar_identities(identities)
        if temp_id_remap:
            for old_id, new_id in temp_id_remap.items():
                if old_id != new_id:
                    db.query(DetectedFace).filter(
                        DetectedFace.video_id == video_id,
                        DetectedFace.identity_id == old_id,
                    ).update({"identity_id": new_id})
            identities = [item for item in identities if item["identity_id"] == temp_id_remap[item["identity_id"]]]
        
        # Create Identity records
        id_map = {} # temp_id -> db_id
        for temp_id_dict in identities:
            temp_id = temp_id_dict["identity_id"]
            db_ident = Identity(
                video_id=video_id,
                label=f"Person {chr(64 + temp_id) if temp_id <= 26 else temp_id}",
                representative_thumbnail=temp_id_dict["thumbnail"],
                avg_embedding=temp_id_dict["avg_embedding"].tobytes() if temp_id_dict["avg_embedding"] is not None else None,
                appearance_count=temp_id_dict["count"],
                avg_confidence=temp_id_dict["conf"]
            )
            db.add(db_ident)
            db.commit()
            db.refresh(db_ident)
            id_map[temp_id] = db_ident.id
            
            # Default blur selection
            bs = BlurSelection(video_id=video_id, identity_id=db_ident.id, should_blur=True)
            db.add(bs)
            
        db.commit()
        
        # Update DetectedFace with real identity_ids
        for temp_id, db_id in id_map.items():
            db.query(DetectedFace).filter(DetectedFace.video_id == video_id, DetectedFace.identity_id == temp_id).update({"identity_id": db_id})
            
        # Create Timeline Entries
        fps = video.fps
        for db_id in id_map.values():
            faces = db.query(DetectedFace).filter(DetectedFace.identity_id == db_id).order_by(DetectedFace.frame_number).all()
            for face in faces:
                ts = (face.frame_number / fps) * 1000
                te = TimelineEntry(identity_id=db_id, frame_number=face.frame_number, timestamp_ms=ts)
                db.add(te)
                
        db.commit()
        video.status = "detection_complete"
        db.commit()
        processing_status[video_id] = {"status": "completed", "progress": 100}
        
    except Exception as e:
        processing_status[video_id] = {"status": "error", "error": str(e)}
        print(f"Pipeline error: {e}")
    finally:
        db.close()

@app.post("/api/start-detection/{video_id}")
async def start_detection(video_id: int, background_tasks: BackgroundTasks, keyframe_indices: str = Form(...), skip_frames: int = Form(3), db: Session = Depends(get_db)):
    video = db.query(Video).filter(Video.id == video_id).first()
    if not video:
        raise HTTPException(404, "Video not found")
        
    indices = json.loads(keyframe_indices)
    background_tasks.add_task(detection_pipeline, video_id, indices, skip_frames)
    return {"status": "processing"}

@app.get("/api/status/{video_id}")
async def get_status(video_id: int):
    status = processing_status.get(video_id, {"status": "unknown", "progress": 0})
    return status

# ---------------------------------------------------------------------------
# Model Backend Selection
# ---------------------------------------------------------------------------

@app.get("/api/model-backend")
async def get_model_backend():
    """Return current backend info and per-backend export states."""
    if detection_service is None:
        raise HTTPException(503, "Detection service not initialized")
    return detection_service.get_status()

@app.post("/api/model-backend")
async def set_model_backend(req: ModelBackendRequest):
    """Switch the active inference backend.  If the engine file doesn't exist
    yet, export runs in the background — poll GET /api/model-backend for status."""
    if detection_service is None:
        raise HTTPException(503, "Detection service not initialized")
    result = detection_service.switch_backend(req.backend)
    if not result.get("success"):
        raise HTTPException(400, result.get("error", "Failed to switch backend"))
    return result

@app.get("/api/models")
async def get_models():
    if detection_service is None:
        raise HTTPException(503, "Detection service not initialized")
    return {
        "current_model": detection_service.current_model,
        "models": detection_service.list_models(),
    }

@app.post("/api/models")
async def set_model(req: ModelSelectionRequest):
    if detection_service is None:
        raise HTTPException(503, "Detection service not initialized")
    result = detection_service.switch_model(req.model)
    if not result.get("success"):
        raise HTTPException(400, result.get("error", "Failed to switch model"))
    return result


def _webcam_iou(left: dict, right: dict) -> float:
    x1 = max(left["x1"], right["x1"])
    y1 = max(left["y1"], right["y1"])
    x2 = min(left["x2"], right["x2"])
    y2 = min(left["y2"], right["y2"])
    intersection = max(0, x2 - x1) * max(0, y2 - y1)
    left_area = max(1, left["x2"] - left["x1"]) * max(1, left["y2"] - left["y1"])
    right_area = max(1, right["x2"] - right["x1"]) * max(1, right["y2"] - right["y1"])
    return intersection / max(1, left_area + right_area - intersection)


def _webcam_embedding(image: np.ndarray, bbox: dict) -> np.ndarray | None:
    x1, y1, x2, y2 = bbox["x1"], bbox["y1"], bbox["x2"], bbox["y2"]
    width, height = x2 - x1, y2 - y1
    if width < 32 or height < 32:
        return None
    px1, py1 = max(0, int(x1 - width * 0.25)), max(0, int(y1 - height * 0.25))
    px2, py2 = min(image.shape[1], int(x2 + width * 0.25)), min(image.shape[0], int(y2 + height * 0.25))
    return recognition_service.extract_embedding(image[py1:py2, px1:px2])


def _assign_webcam_identities(session: dict, image: np.ndarray, detections: list[dict]) -> list[dict]:
    previous_tracks = session["tracks"]
    used_tracks = set()
    matched = []

    for detection in detections:
        best_index, best_score = -1, 0.15
        for index, track in enumerate(previous_tracks):
            if index not in used_tracks:
                score = _webcam_iou(track["bbox"], detection["bbox"])
                if score > best_score:
                    best_index, best_score = index, score
        if best_index >= 0:
            used_tracks.add(best_index)
            track = previous_tracks[best_index]
            track["bbox"] = detection["bbox"]
            track["missed"] = 0
            detection["person_id"] = track["person_id"]
            matched.append(track)
        else:
            embedding = _webcam_embedding(image, detection["bbox"])
            person_id = None
            if embedding is not None:
                candidates = []
                for identity in session["identities"]:
                    similarity = recognition_service.compute_similarity(embedding, identity["embedding"])
                    candidates.append((similarity, identity["person_id"]))
                candidates.sort(reverse=True)
                if candidates and candidates[0][0] >= 0.45:
                    person_id = candidates[0][1]
            if person_id is None:
                person_id = session["next_person_id"]
                session["next_person_id"] += 1
                if embedding is not None:
                    session["identities"].append({"person_id": person_id, "embedding": embedding})
            detection["person_id"] = person_id
            matched.append({"bbox": detection["bbox"], "person_id": person_id, "missed": 0})

    retained = []
    for index, track in enumerate(previous_tracks):
        if index not in used_tracks and track not in matched:
            track["missed"] += 1
            if track["missed"] <= 15:
                retained.append(track)
    session["tracks"] = matched + retained
    return detections

@app.post("/api/webcam-detect")
async def webcam_detect(req: WebcamFrameRequest):
    if detection_service is None:
        raise HTTPException(503, "Detection service not initialized")
    try:
        started = time.perf_counter()
        encoded = req.image.split(",", 1)[1] if "," in req.image else req.image
        image = cv2.imdecode(np.frombuffer(base64.b64decode(encoded), dtype=np.uint8), cv2.IMREAD_COLOR)
        if image is None:
            raise HTTPException(400, "Invalid webcam frame")
        if req.model and req.model != detection_service.current_model:
            result = detection_service.switch_model(req.model)
            if not result.get("success"):
                raise HTTPException(400, result.get("error", "Failed to load selected model"))
        detections = detection_service.detect_faces(image, conf_threshold=0.35)
        if req.session_id and recognition_service.active:
            if req.session_id not in webcam_sessions:
                webcam_sessions[req.session_id] = {"tracks": [], "identities": [], "next_person_id": 1, "last_seen": time.time()}
            session = webcam_sessions[req.session_id]
            session["last_seen"] = time.time()
            detections = _assign_webcam_identities(session, image, detections)
        return {
            "detections": detections,
            "model": detection_service.current_model,
            "latency_ms": round((time.perf_counter() - started) * 1000, 1),
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Webcam detection failed: {e}")

# ---------------------------------------------------------------------------
# Client-Side ONNX: serve model file + accept client-detected bounding boxes
# ---------------------------------------------------------------------------

@app.get("/api/model-file/onnx")
async def serve_onnx_model_file():
    """Serve the ONNX model file so browsers can download it for client-side inference.
    Auto-exports from .pt if the .onnx file doesn't exist yet."""
    onnx_path = "yolo26n-face.onnx"
    if not os.path.exists(onnx_path):
        try:
            from ultralytics import YOLO as _YOLO
            _m = _YOLO("yolo26n-face.pt")
            _m.export(format="onnx", simplify=True, verbose=False)
        except Exception as e:
            raise HTTPException(500, f"Could not export ONNX model: {e}")
    if not os.path.exists(onnx_path):
        raise HTTPException(404, "ONNX model file not available")
    return FileResponse(
        onnx_path,
        media_type="application/octet-stream",
        filename="yolo26n-face.onnx",
        headers={"Cache-Control": "public, max-age=86400"},
    )

def _recognition_pipeline_from_client(video_id: int, frame_detections: list[dict]):
    """Background task: run InsightFace recognition on client-submitted bboxes.
    Skips YOLO detection — bboxes come from the browser's ONNX inference."""
    global processing_status
    processing_status[video_id] = {"status": "processing", "progress": 0}

    db = next(get_db())
    try:
        video = db.query(Video).filter(Video.id == video_id).first()
        if not video:
            return

        # Clear any previous detection data
        db.query(DetectedFace).filter(DetectedFace.video_id == video_id).delete()
        db.query(Identity).filter(Identity.video_id == video_id).delete()
        db.commit()

        cap = cv2.VideoCapture(video.original_path)
        identities: list[dict] = []
        next_identity_id = 1
        total = len(frame_detections)

        for idx, frame_data in enumerate(frame_detections):
            processing_status[video_id]["progress"] = int((idx / max(total, 1)) * 100)

            frame_number = frame_data["frame_number"]
            detections   = frame_data["detections"]   # list of {bbox, confidence}

            cap.set(cv2.CAP_PROP_POS_FRAMES, frame_number)
            ret, frame = cap.read()
            if not ret:
                continue

            for det in detections:
                bbox = det["bbox"]
                x1, y1, x2, y2 = bbox["x1"], bbox["y1"], bbox["x2"], bbox["y2"]

                # Use moderate context while avoiding background/neighboring faces.
                w, h = x2 - x1, y2 - y1
                if w < 32 or h < 32 or det["confidence"] < 0.30:
                    continue
                px1 = max(0, int(x1 - w * 0.25))
                py1 = max(0, int(y1 - h * 0.25))
                px2 = min(frame.shape[1], int(x2 + w * 0.25))
                py2 = min(frame.shape[0], int(y2 + h * 0.25))
                crop = frame[py1:py2, px1:px2]

                emb = recognition_service.extract_embedding(crop)
                identity_id = None

                if emb is not None:
                    matched_id = recognition_service.match_identity(emb, identities, threshold=RECOGNITION_THRESHOLD)
                    if matched_id is None:
                        matched_id = _match_stable_identity(emb, identities)
                    if matched_id is not None:
                        identity_id = matched_id
                        for i, ident in enumerate(identities):
                            if ident["identity_id"] == identity_id:
                                _add_embedding_to_identity(identities[i], emb, det["confidence"])
                                break
                    else:
                        identity_id = next_identity_id
                        next_identity_id += 1
                        thumb = ndarray_to_base64(cv2.resize(crop, (112, 112))) if crop.size > 0 else None
                        identities.append({
                            "identity_id": identity_id,
                            "avg_embedding": emb,
                            "embeddings": [emb],
                            "thumbnail": thumb,
                            "count": 1,
                            "conf": det["confidence"],
                        })

                if identity_id is not None:
                    db.add(DetectedFace(
                        video_id=video_id,
                        frame_number=frame_number,
                        bbox_x1=x1, bbox_y1=y1, bbox_x2=x2, bbox_y2=y2,
                        confidence=det["confidence"],
                        identity_id=identity_id,  # temp id — remapped below
                    ))

            if idx % 50 == 0:
                db.commit()

        cap.release()
        db.commit()

        temp_id_remap = _merge_similar_identities(identities)
        for old_id, new_id in temp_id_remap.items():
            if old_id != new_id:
                db.query(DetectedFace).filter(
                    DetectedFace.video_id == video_id,
                    DetectedFace.identity_id == old_id,
                ).update({"identity_id": new_id})
        identities = [item for item in identities if item["identity_id"] == temp_id_remap[item["identity_id"]]]

        # --- Persist Identities & remap temp IDs ---
        id_map: dict[int, int] = {}
        for tmp in identities:
            db_ident = Identity(
                video_id=video_id,
                label=f"Person {chr(64 + tmp['identity_id']) if tmp['identity_id'] <= 26 else tmp['identity_id']}",
                representative_thumbnail=tmp["thumbnail"],
                avg_embedding=tmp["avg_embedding"].tobytes() if tmp["avg_embedding"] is not None else None,
                appearance_count=tmp["count"],
                avg_confidence=tmp["conf"],
            )
            db.add(db_ident)
            db.commit()
            db.refresh(db_ident)
            id_map[tmp["identity_id"]] = db_ident.id
            db.add(BlurSelection(video_id=video_id, identity_id=db_ident.id, should_blur=True))

        db.commit()

        for tmp_id, real_id in id_map.items():
            db.query(DetectedFace).filter(
                DetectedFace.video_id == video_id,
                DetectedFace.identity_id == tmp_id,
            ).update({"identity_id": real_id})

        fps = video.fps
        for real_id in id_map.values():
            faces = db.query(DetectedFace).filter(DetectedFace.identity_id == real_id).order_by(DetectedFace.frame_number).all()
            for face in faces:
                ts = (face.frame_number / fps) * 1000
                db.add(TimelineEntry(identity_id=real_id, frame_number=face.frame_number, timestamp_ms=ts))

        db.commit()
        video.status = "detection_complete"
        db.commit()
        processing_status[video_id] = {"status": "completed", "progress": 100}

    except Exception as e:
        processing_status[video_id] = {"status": "error", "error": str(e)}
        print(f"[ClientRecognition] Error: {e}")
    finally:
        db.close()

@app.post("/api/submit-detections/{video_id}")
async def submit_client_detections(
    video_id: int,
    req: ClientDetectionsRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """Accept bounding boxes detected client-side (browser ONNX) and run
    server-side face recognition + identity matching as a background task."""
    video = db.query(Video).filter(Video.id == video_id).first()
    if not video:
        raise HTTPException(404, "Video not found")

    frame_dets = [
        {
            "frame_number": fd.frame_number,
            "detections": [
                {"bbox": {"x1": d.bbox.x1, "y1": d.bbox.y1, "x2": d.bbox.x2, "y2": d.bbox.y2}, "confidence": d.confidence}
                for d in fd.detections
            ],
        }
        for fd in req.frame_detections
    ]
    background_tasks.add_task(_recognition_pipeline_from_client, video_id, frame_dets)
    return {"status": "processing"}

@app.get("/api/recognized-persons/{video_id}")
async def get_recognized_persons(video_id: int, db: Session = Depends(get_db)):
    identities = db.query(Identity).filter(Identity.video_id == video_id).all()
    res = []
    for iden in identities:
        blur_sel = db.query(BlurSelection).filter(BlurSelection.identity_id == iden.id).first()
        timeline = db.query(TimelineEntry).filter(TimelineEntry.identity_id == iden.id).order_by(TimelineEntry.frame_number).limit(5).all()
        
        def fmt_time(ms):
            s = ms // 1000
            return f"{int(s//3600):02d}:{int((s%3600)//60):02d}:{int(s%60):02d}"
            
        res.append({
            "id": iden.id,
            "label": iden.label,
            "representative_thumbnail": iden.representative_thumbnail,
            "appearance_count": iden.appearance_count,
            "avg_confidence": iden.avg_confidence,
            "should_blur": blur_sel.should_blur if blur_sel else True,
            "timeline_summary": [{"frame_number": t.frame_number, "timestamp_ms": t.timestamp_ms, "timestamp_formatted": fmt_time(t.timestamp_ms)} for t in timeline]
        })
    return res

@app.post("/api/update-blur-selection")
async def update_blur_selection(video_id: int = Form(...), selections: str = Form(...), db: Session = Depends(get_db)):
    # selections is JSON list of {"identity_id": int, "should_blur": bool}
    sels = json.loads(selections)
    for s in sels:
        db.query(BlurSelection).filter(BlurSelection.identity_id == s["identity_id"]).update({"should_blur": s["should_blur"]})
    db.commit()
    return {"status": "ok"}

@app.get("/api/timeline/{video_id}/{identity_id}")
async def get_timeline(video_id: int, identity_id: int, db: Session = Depends(get_db)):
    timeline = db.query(TimelineEntry).filter(TimelineEntry.identity_id == identity_id).order_by(TimelineEntry.frame_number).all()
    def fmt_time(ms):
        s = ms // 1000
        return f"{int(s//3600):02d}:{int((s%3600)//60):02d}:{int(s%60):02d}"
    
    return [
        {"frame_number": t.frame_number, "timestamp_ms": t.timestamp_ms, "timestamp_formatted": fmt_time(t.timestamp_ms)}
        for t in timeline
    ]

@app.post("/api/render-preview/{video_id}")
async def render_preview(video_id: int, blur_type: str = Form("gaussian"), blur_strength: int = Form(31), sticker_image: str = Form(None), db: Session = Depends(get_db)):
    video = db.query(Video).filter(Video.id == video_id).first()
    if not video:
        raise HTTPException(404, "Video not found")
        
    blurs = db.query(BlurSelection).filter(BlurSelection.video_id == video_id).all()
    identity_blur_map = {b.identity_id: b.should_blur for b in blurs}
    
    faces = db.query(DetectedFace).filter(DetectedFace.video_id == video_id).all()
    face_data = {}
    for f in faces:
        if f.frame_number not in face_data:
            face_data[f.frame_number] = []
        face_data[f.frame_number].append({
            "bbox": {"x1": f.bbox_x1, "y1": f.bbox_y1, "x2": f.bbox_x2, "y2": f.bbox_y2},
            "identity_id": f.identity_id
        })
        
    manual_boxes_db = db.query(ManualBlurBox).filter(ManualBlurBox.video_id == video_id).all()
    manual_boxes = [{"start_frame_number": b.start_frame_number, "end_frame_number": b.end_frame_number, "x": b.x, "y": b.y, "width": b.width, "height": b.height, "is_tracking": b.is_tracking, "engine_preset": b.engine_preset or "gaussian"} for b in manual_boxes_db]
        
    ext = video.original_path.split('.')[-1].lower() if video.original_path else "mp4"
    is_image = ext in ALLOWED_IMAGE_EXT
    out_ext = ext if is_image else "mp4"
    out_path = os.path.join("temp", "previews", str(video_id), f"preview_blur.{out_ext}")
    
    # We could scale down the video for faster preview, but let's just render
    success = RenderingService.render_video(
        video.original_path, out_path, identity_blur_map, face_data, 
        manual_boxes=manual_boxes, blur_type=blur_type, blur_strength=blur_strength,
        sticker_image_b64=sticker_image
    )
    
    if not success:
        raise HTTPException(500, "Preview render failed")
        
    return {"preview_url": f"/api/serve-video/{video_id}/preview"}

import glob
@app.get("/api/serve-video/{video_id}/{v_type}")
async def serve_video(video_id: int, v_type: str, db: Session = Depends(get_db)):
    if v_type == "preview":
        pattern = os.path.join("temp", "previews", str(video_id), "preview_blur.*")
    elif v_type == "export":
        pattern = os.path.join("processed", f"{video_id}_final.*")
    else:
        raise HTTPException(400, "Invalid video type")
        
    matches = glob.glob(pattern)
    if not matches:
        raise HTTPException(404, "File not found")
        
    path = matches[0]
    ext = path.split('.')[-1].lower()
    is_image = ext in ALLOWED_IMAGE_EXT
    media_type = f"image/{ext}" if is_image else "video/mp4"
    return FileResponse(path, media_type=media_type, headers={"Cache-Control": "no-cache, no-store, must-revalidate", "Pragma": "no-cache", "Expires": "0"})

@app.post("/api/export-video/{video_id}")
async def export_video(video_id: int, blur_type: str = Form("gaussian"), blur_strength: int = Form(51), sticker_image: str = Form(None), db: Session = Depends(get_db)):
    video = db.query(Video).filter(Video.id == video_id).first()
    if not video:
        raise HTTPException(404, "Video not found")
        
    blurs = db.query(BlurSelection).filter(BlurSelection.video_id == video_id).all()
    identity_blur_map = {b.identity_id: b.should_blur for b in blurs}
    
    faces = db.query(DetectedFace).filter(DetectedFace.video_id == video_id).all()
    face_data = {}
    for f in faces:
        if f.frame_number not in face_data:
            face_data[f.frame_number] = []
        face_data[f.frame_number].append({
            "bbox": {"x1": f.bbox_x1, "y1": f.bbox_y1, "x2": f.bbox_x2, "y2": f.bbox_y2},
            "identity_id": f.identity_id
        })
        
    manual_boxes_db = db.query(ManualBlurBox).filter(ManualBlurBox.video_id == video_id).all()
    manual_boxes = [{"start_frame_number": b.start_frame_number, "end_frame_number": b.end_frame_number, "x": b.x, "y": b.y, "width": b.width, "height": b.height, "is_tracking": b.is_tracking, "engine_preset": b.engine_preset or "gaussian"} for b in manual_boxes_db]
        
    ext = video.original_path.split('.')[-1].lower() if video.original_path else "mp4"
    is_image = ext in ALLOWED_IMAGE_EXT
    out_ext = ext if is_image else "mp4"
    
    out_path = os.path.join("processed", f"{video_id}_final.{out_ext}")
    
    success = RenderingService.render_video(
        video.original_path, out_path, identity_blur_map, face_data, 
        manual_boxes=manual_boxes, blur_type=blur_type, blur_strength=blur_strength,
        sticker_image_b64=sticker_image
    )
    
    if not success:
        raise HTTPException(500, "Export render failed")
        
    cloudinary_url = None
    try:
        r_type = "image" if is_image else "video"
        up = cloudinary.uploader.upload(out_path, folder="blur_system/processed", resource_type=r_type)
        cloudinary_url = up["secure_url"]
    except Exception as e:
        print(f"Cloudinary upload failed: {e}")
        
    return {
        "download_url": f"/api/serve-video/{video_id}/export",
        "cloudinary_url": cloudinary_url
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
