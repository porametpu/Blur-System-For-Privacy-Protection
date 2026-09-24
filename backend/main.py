import os
import re
import shutil
import cv2
import uuid
import base64
import json
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
    processing_status[video_id] = {"status": "processing", "progress": 0}
    
    db = next(get_db())
    try:
        video = db.query(Video).filter(Video.id == video_id).first()
        if not video:
            return
            
        cap = cv2.VideoCapture(video.original_path)
        tracker = SimpleTracker(max_age=30, min_iou=0.3)
        
        identities = [] # list of dicts: {"identity_id": int, "avg_embedding": np.ndarray, "thumbnail": str, "count": 1, "conf": float}
        next_identity_id = 1
        
        # Clear existing data
        db.query(DetectedFace).filter(DetectedFace.video_id == video_id).delete()
        db.query(Identity).filter(Identity.video_id == video_id).delete()
        db.commit()
        
        frame_idx = 0
        total_frames = video.total_frames
        
        while True:
            ret, frame = cap.read()
            if not ret:
                break
                
            processing_status[video_id]["progress"] = int((frame_idx / total_frames) * 100)
            
            # Detect on keyframes or interval
            if frame_idx in keyframe_indices or frame_idx % skip_frames == 0:
                detections = detection_service.detect_faces(frame)
                
                # Recognition
                tracker_input = []
                for det in detections:
                    bbox = det["bbox"]
                    x1, y1, x2, y2 = bbox["x1"], bbox["y1"], bbox["x2"], bbox["y2"]
                    
                    # Add generous padding for recognition (InsightFace needs context)
                    w, h = x2 - x1, y2 - y1
                    px1, py1 = max(0, int(x1 - w*0.5)), max(0, int(y1 - h*0.5))
                    px2, py2 = min(frame.shape[1], int(x2 + w*0.5)), min(frame.shape[0], int(y2 + h*0.5))
                    crop = frame[py1:py2, px1:px2]
                    
                    emb = recognition_service.extract_embedding(crop)
                    identity_id = None
                    
                    if emb is not None:
                        # Match identity
                        matched_id = recognition_service.match_identity(emb, identities, threshold=0.45)
                        if matched_id is not None:
                            identity_id = matched_id
                            # Update existing
                            for idx, identity in enumerate(identities):
                                if identity["identity_id"] == identity_id:
                                    identities[idx]["count"] += 1
                                    # Running average of embedding
                                    identities[idx]["avg_embedding"] = (identities[idx]["avg_embedding"] * (identities[idx]["count"]-1) + emb) / identities[idx]["count"]
                                    identities[idx]["avg_embedding"] /= np.linalg.norm(identities[idx]["avg_embedding"])
                                    identities[idx]["conf"] = (identities[idx]["conf"] * (identities[idx]["count"]-1) + det["confidence"]) / identities[idx]["count"]
                                    break
                        else:
                            # New identity
                            identity_id = next_identity_id
                            next_identity_id += 1
                            identities.append({
                                "identity_id": identity_id,
                                "avg_embedding": emb,
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
                # Track without detection
                # In a real system, we'd use optical flow or KCF for skipped frames.
                # For ByteTrack IoU, we need detections. If we just skip, we can reuse last known locations,
                # but to be accurate we'll just run detection if not skipping.
                # To simplify: we'll actually run detection on EVERY frame, but only do recognition on intervals/keyframes to save time.
                detections = detection_service.detect_faces(frame)
                tracker_input = [{"bbox": d["bbox"]} for d in detections]
                tracks = tracker.update(tracker_input)
                
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
async def start_detection(video_id: int, background_tasks: BackgroundTasks, keyframe_indices: str = Form(...), skip_frames: int = Form(5), db: Session = Depends(get_db)):
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

                # Padded crop for InsightFace
                w, h = x2 - x1, y2 - y1
                px1 = max(0, int(x1 - w * 0.5))
                py1 = max(0, int(y1 - h * 0.5))
                px2 = min(frame.shape[1], int(x2 + w * 0.5))
                py2 = min(frame.shape[0], int(y2 + h * 0.5))
                crop = frame[py1:py2, px1:px2]

                emb = recognition_service.extract_embedding(crop)
                identity_id = None

                if emb is not None:
                    matched_id = recognition_service.match_identity(emb, identities, threshold=0.45)
                    if matched_id is not None:
                        identity_id = matched_id
                        for i, ident in enumerate(identities):
                            if ident["identity_id"] == identity_id:
                                cnt = identities[i]["count"]
                                identities[i]["avg_embedding"] = (ident["avg_embedding"] * cnt + emb) / (cnt + 1)
                                identities[i]["avg_embedding"] /= np.linalg.norm(identities[i]["avg_embedding"])
                                identities[i]["conf"] = (ident["conf"] * cnt + det["confidence"]) / (cnt + 1)
                                identities[i]["count"] += 1
                                break
                    else:
                        identity_id = next_identity_id
                        next_identity_id += 1
                        thumb = ndarray_to_base64(cv2.resize(crop, (112, 112))) if crop.size > 0 else None
                        identities.append({
                            "identity_id": identity_id,
                            "avg_embedding": emb,
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
