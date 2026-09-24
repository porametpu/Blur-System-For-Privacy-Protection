import os
import threading
import torch
import numpy as np
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


class FaceDetectionService:
    """
    Wraps a YOLO face-detection model with hot-swappable inference backends.

    Switching to a backend whose exported file does not yet exist triggers a
    one-time background export.  Poll ``get_status()`` to track progress.
    """

    def __init__(self, backend: str = "pytorch"):
        self.device: str = "cuda" if torch.cuda.is_available() else "cpu"
        self.use_fp16: bool = self.device == "cuda"
        self.is_face_model: bool = True

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

        # PyTorch .pt should always exist
        if backend == "pytorch":
            return self._load_backend_sync(backend)

        # Need to export first — run in background
        return self._start_export_async(backend)

    def get_status(self) -> dict:
        """Return current backend info and per-backend export states."""
        return {
            "current":       self.current_backend,
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

    def _model_path(self, backend: str) -> str:
        if backend == "pytorch":
            return f"{BASE_MODEL_STEM}.pt"
        return f"{BASE_MODEL_STEM}{BACKEND_FORMATS[backend]['ext']}"

    def _load_backend_sync(self, backend: str) -> dict:
        """Load model synchronously.  Returns success dict."""
        model_path = self._model_path(backend)

        with self._lock:
            try:
                new_model = YOLO(model_path)
                self.model = new_model
                self.current_backend = backend
                self.is_face_model = True
                self.export_status[backend] = "ready"
                print(f"✅ [{backend.upper()}] Loaded from {model_path}")
                return {"success": True, "backend": backend, "status": "ready"}
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
            pt_path = f"{BASE_MODEL_STEM}.pt"
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

                # Person model heuristic: shrink to face region
                if not self.is_face_model:
                    w, h = x2 - x1, y2 - y1
                    y2  = y1 + h * 0.30
                    x1  = x1 + w * 0.20
                    x2  = x2 - w * 0.20

                detections.append({
                    "bbox": {
                        "x1": int(x1), "y1": int(y1),
                        "x2": int(x2), "y2": int(y2),
                    },
                    "confidence": float(box.conf[0].item()),
                })
        return detections
