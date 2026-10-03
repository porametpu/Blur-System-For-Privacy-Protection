import os
import threading
import torch
import numpy as np
import cv2
from ultralytics import YOLO

# ---------------------------------------------------------------------------
# Backend registry
# ---------------------------------------------------------------------------
BACKEND_FORMATS = {
    "pytorch":     {"ext": ".pt",          "format": None,          "label": "PyTorch"},
    "torchscript": {"ext": ".torchscript", "format": "torchscript", "label": "TorchScript"},
    "onnx":        {"ext": ".onnx",        "format": "onnx",        "label": "ONNX"},
    "tensorrt":    {"ext": ".engine",      "format": "engine",      "label": "TensorRT"},
}

BASE_MODEL_STEM = "yolo26n-face"   # stem without extension
FALLBACK_PT     = "yolov8n.pt"     # fallback if primary .pt missing
MODEL_DIR       = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "model"))

MODEL_CATALOG = {
    **{f"yolov8{size}": {"family": "YOLOv8", "label": f"YOLOv8{size.upper()} Face", "stem": f"yolov8{size}-face", "description": "Reliable general-purpose face detector; n is fastest, x is most accurate."} for size in "nsmlx"},
    **{f"yolo11{size}": {"family": "YOLO11", "label": f"YOLO11{size.upper()} Face", "stem": f"yolo11{size}-face", "description": "Modern accuracy/speed balance; s/m are strong defaults for video."} for size in "nsmlx"},
    **{f"yolo26{size}": {"family": "YOLO26", "label": f"YOLO26{size.upper()} Face", "stem": f"yolo26{size}-face", "description": "Efficient current YOLO family; n/s suit CPU and ONNX, m/l/x suit GPU."} for size in "nsmlx"},
    "yunet": {"family": "YuNet", "label": "YuNet", "stem": "face_detection_yunet_2023mar", "description": "Very lightweight CPU detector; best for real-time and low-power devices."},
    "retinaface": {"family": "RetinaFace", "label": "RetinaFace", "stem": "retinaface", "description": "High recall with landmarks; best for small, angled, or crowded faces."},
}


class FaceDetectionService:
    """
    Wraps a YOLO face-detection model with hot-swappable inference backends.

    Switching to a backend whose exported file does not yet exist triggers a
    one-time background export.  Poll ``get_status()`` to track progress.
    """

    def __init__(self, backend: str = "pytorch", model_key: str = "yolo26n"):
        self.device: str = "cuda" if torch.cuda.is_available() else "cpu"
        self.use_fp16: bool = self.device == "cuda"
        self.is_face_model: bool = True
        self.current_model: str | None = None
        self.model_key = model_key if model_key in MODEL_CATALOG else "yolo26n"

        self.model: YOLO | None = None
        self.current_backend: str | None = None

        # Per-backend export status: "ready" | "exporting" | "error"
        self.export_status: dict[str, str] = {}
        self.export_errors:  dict[str, str] = {}

        self._lock = threading.Lock()
        self._export_threads: dict[str, threading.Thread] = {}

        self._load_backend_sync(backend)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def switch_backend(self, backend: str) -> dict:
        """
        Switch to *backend*.  If the model file already exists the switch is
        synchronous.  Otherwise an export is started in the background and
        ``{"status": "exporting"}`` is returned — poll ``get_status()`` for
        completion.
        """
        if backend not in BACKEND_FORMATS:
            return {"success": False, "error": f"Unknown backend: '{backend}'"}

        if backend == "tensorrt" and self.device != "cuda":
            return {
                "success": False,
                "error": "TensorRT requires an NVIDIA CUDA-capable GPU, which was not detected.",
            }

        model_path = self._model_path(backend)

        # Already ready — load synchronously (fast)
        if os.path.exists(model_path):
            return self._load_backend_sync(backend)

        if not MODEL_CATALOG[self.model_key]["family"].startswith("YOLO"):
            return {"success": False, "error": f"{MODEL_CATALOG[self.model_key]['label']} does not support automatic export to {backend}."}

        # PyTorch .pt should always exist
        if backend == "pytorch":
            return self._load_backend_sync(backend)

        # Need to export first — run in background
        return self._start_export_async(backend)

    def list_models(self) -> list[dict]:
        result = []
        for key, meta in MODEL_CATALOG.items():
            pytorch_path = self._model_path("pytorch", key)
            onnx_path = self._model_path("onnx", key)
            available = self._model_available(key, "pytorch") or self._model_available(key, "onnx")
            weights_kind = "face-trained" if "-face" in os.path.basename(pytorch_path) or "-face" in os.path.basename(onnx_path) else "general-object"
            result.append({**meta, "key": key, "available": available,
                           "weights_kind": weights_kind,
                           "recommended_backends": ["pytorch", "onnx"] if meta["family"].startswith("YOLO") else ["onnx", "pytorch"]})
        return result

    def switch_model(self, model_key: str) -> dict:
        if model_key not in MODEL_CATALOG:
            return {"success": False, "error": f"Unknown model: '{model_key}'"}
        backend = self.current_backend or "pytorch"
        if not self._model_available(model_key, backend):
            if self._model_available(model_key, "onnx"):
                backend = "onnx"
            elif MODEL_CATALOG[model_key]["family"] == "YuNet":
                backend = "pytorch"
            else:
                return {"success": False, "error": f"Model weights are not installed for {MODEL_CATALOG[model_key]['label']}"}
        if model_key == "yunet":
            backend = "pytorch"
        if not self._model_available(model_key, backend):
            return {"success": False, "error": f"Model weights are not installed for {MODEL_CATALOG[model_key]['label']}"}
        return self._load_backend_sync(backend, model_key)

    def get_status(self) -> dict:
        """Return current backend info and per-backend export states."""
        return {
            "current":       self.current_backend,
            "current_model": self.current_model,
            "models":         self.list_models(),
            "available":     list(BACKEND_FORMATS.keys()),
            "export_status": {**self.export_status},
            "export_errors": {**self.export_errors},
            "device":        self.device,
            "has_cuda":      self.device == "cuda",
        }

    # ------------------------------------------------------------------
    # Detection (unchanged interface)
    # ------------------------------------------------------------------

    def detect_faces(self, frame: np.ndarray, conf_threshold: float = 0.25) -> list[dict]:
        if self.model is None or frame is None:
            return []
        try:
            if self.current_model == "yunet":
                h, w = frame.shape[:2]
                self.model.setInputSize((w, h))
                _, faces = self.model.detect(frame)
                detections = []
                for face in faces if faces is not None else []:
                    score = float(face[-1])
                    if score >= conf_threshold:
                        detections.append({"bbox": {"x1": int(face[0]), "y1": int(face[1]), "x2": int(face[0] + face[2]), "y2": int(face[1] + face[3])}, "confidence": score})
                return detections
            if self.current_model == "retinaface":
                result = self.model.detect_faces(frame, threshold=conf_threshold)
                detections = []
                for face in result.values():
                    area = face.get("facial_area", [])
                    if len(area) == 4:
                        detections.append({"bbox": {"x1": int(area[0]), "y1": int(area[1]), "x2": int(area[2]), "y2": int(area[3])}, "confidence": float(face.get("score", 0.0))})
                return detections
            results = self.model.predict(
                frame,
                verbose=False,
                device=self.device,
                half=self.use_fp16,
                conf=conf_threshold,
            )
            return self._parse_results(results)
        except Exception as e:
            print(f"[Detection] Error: {e}")
            return []

    def detect_faces_batch(self, frames: list[np.ndarray], conf_threshold: float = 0.25) -> list[list[dict]]:
        if self.model is None or not frames:
            return [[] for _ in frames]
        try:
            results = self.model.predict(
                frames,
                verbose=False,
                device=self.device,
                half=self.use_fp16,
                conf=conf_threshold,
            )
            return [self._parse_results([r]) for r in results]
        except Exception as e:
            print(f"[Detection] Batch error: {e}")
            return [[] for _ in frames]

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _model_path(self, backend: str, model_key: str | None = None) -> str:
        model_key = model_key or self.model_key
        meta = MODEL_CATALOG[model_key]
        if meta["family"] == "YuNet":
            return os.path.join(MODEL_DIR, f"{meta['stem']}.onnx")
        if meta["family"] == "RetinaFace":
            return f"{meta['stem']}.onnx"
        if meta["family"].startswith("YOLO"):
            size = model_key[-1]
            if meta["family"] == "YOLOv8":
                generic_stem = f"yolov8{size}"
            else:
                generic_stem = f"{meta['family'].lower()}{size}"
            candidates = [
                os.path.abspath(os.path.join(os.path.dirname(__file__), "..", f"{meta['stem']}{BACKEND_FORMATS[backend]['ext'] if backend != 'pytorch' else '.pt'}")),
                os.path.join(MODEL_DIR, f"{meta['stem']}{BACKEND_FORMATS[backend]['ext'] if backend != 'pytorch' else '.pt'}"),
                os.path.join(MODEL_DIR, f"{generic_stem}{BACKEND_FORMATS[backend]['ext'] if backend != 'pytorch' else '.pt'}"),
            ]
            for candidate in candidates:
                if os.path.exists(candidate):
                    return candidate
            return candidates[0]
        if backend == "pytorch":
            return f"{meta['stem']}.pt"
        return f"{meta['stem']}{BACKEND_FORMATS[backend]['ext']}"

    def _model_available(self, model_key: str, backend: str) -> bool:
        if MODEL_CATALOG[model_key]["family"] == "RetinaFace":
            try:
                import retinaface  # noqa: F401
                return True
            except Exception:
                return False
        return os.path.exists(self._model_path(backend, model_key))

    def _load_backend_sync(self, backend: str, model_key: str | None = None) -> dict:
        """Load model synchronously.  Returns success dict."""
        model_key = model_key or self.model_key
        model_path = self._model_path(backend, model_key)

        with self._lock:
            try:
                meta = MODEL_CATALOG[model_key]
                if meta["family"] == "YuNet":
                    new_model = cv2.FaceDetectorYN.create(model_path, "", (320, 320), 0.6, 0.3, 500)
                elif meta["family"] == "RetinaFace":
                    from retinaface import RetinaFace
                    new_model = RetinaFace
                else:
                    new_model = YOLO(model_path)
                self.model = new_model
                self.current_backend = backend
                self.current_model = model_key
                self.model_key = model_key
                self.is_face_model = meta["family"] in {"YuNet", "RetinaFace"} or "-face" in os.path.basename(model_path)
                self.export_status[backend] = "ready"
                print(f"✅ [{backend.upper()}] Loaded from {model_path}")
                return {"success": True, "backend": backend, "model": model_key, "status": "ready"}
            except Exception as e:
                # Try fallback to PyTorch
                if backend == "pytorch":
                    try:
                        print(f"⚠️  Primary face model unavailable, trying fallback...")
                        self.model = YOLO(FALLBACK_PT)
                        self.is_face_model = False
                        self.current_backend = "pytorch"
                        self.export_status["pytorch"] = "ready"
                        print(f"✅ [PYTORCH] Loaded fallback {FALLBACK_PT}")
                        return {"success": True, "backend": "pytorch", "status": "ready"}
                    except Exception as fe:
                        print(f"❌ Failed to load any model: {fe}")
                        self.export_status["pytorch"] = "error"
                        self.export_errors["pytorch"] = str(fe)
                        return {"success": False, "error": str(fe)}
                else:
                    err = str(e)
                    self.export_status[backend] = "error"
                    self.export_errors[backend] = err
                    return {"success": False, "error": err}

    def _start_export_async(self, backend: str) -> dict:
        """Kick off a background export thread."""
        # If already exporting, don't start another thread
        existing = self._export_threads.get(backend)
        if existing and existing.is_alive():
            return {"success": True, "backend": backend, "status": "exporting"}

        self.export_status[backend] = "exporting"
        self.export_errors.pop(backend, None)

        t = threading.Thread(
            target=self._export_and_load,
            args=(backend,),
            daemon=True,
            name=f"export-{backend}",
        )
        self._export_threads[backend] = t
        t.start()
        print(f"🔄 [{backend.upper()}] Export started in background...")
        return {"success": True, "backend": backend, "status": "exporting"}

    def _export_and_load(self, backend: str) -> None:
        """Background thread: export the model then hot-swap it."""
        try:
            pt_path = self._model_path("pytorch")
            fmt_info = BACKEND_FORMATS[backend]

            print(f"🔄 [{backend.upper()}] Exporting from {pt_path}...")
            base_model = YOLO(pt_path)

            export_kwargs: dict = {"format": fmt_info["format"], "verbose": False}
            if backend == "tensorrt":
                export_kwargs["half"] = True          # FP16 for speed
                export_kwargs["device"] = 0           # GPU 0
            elif backend == "onnx":
                export_kwargs["simplify"] = True      # Simplify ONNX graph
                export_kwargs["dynamic"] = False

            base_model.export(**export_kwargs)

            model_path = self._model_path(backend)
            print(f"✅ [{backend.upper()}] Export complete → {model_path}")

            # Hot-swap the running model
            self._load_backend_sync(backend)

        except Exception as e:
            err = str(e)
            self.export_status[backend] = "error"
            self.export_errors[backend] = err
            print(f"❌ [{backend.upper()}] Export failed: {err}")

    def _parse_results(self, results) -> list[dict]:
        """Convert Ultralytics result objects into our bbox dict format."""
        detections = []
        for r in results:
            for box in r.boxes:
                cls_id = int(box.cls[0].item())
                if cls_id != 0:
                    continue
                x1, y1, x2, y2 = box.xyxy[0].tolist()

                # General YOLOv8/YOLO11 weights detect the whole person, not a
                # face. Approximate the head region with a tighter crop so the
                # webcam overlay does not cover the hair/background area.
                if not self.is_face_model:
                    w, h = x2 - x1, y2 - y1
                    x1  = x1 + w * 0.30
                    x2  = x2 - w * 0.30
                    y2  = y1 + h * 0.24

                detections.append({
                    "bbox": {
                        "x1": int(x1), "y1": int(y1),
                        "x2": int(x2), "y2": int(y2),
                    },
                    "confidence": float(box.conf[0].item()),
                })
        return detections
