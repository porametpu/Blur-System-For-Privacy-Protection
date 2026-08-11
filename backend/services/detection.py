import torch
import numpy as np
from ultralytics import YOLO

class FaceDetectionService:
    def __init__(self):
        self.device = 'cuda' if torch.cuda.is_available() else 'cpu'
        self.use_fp16 = self.device == 'cuda'
        
        try:
            self.model = YOLO("yolo26n-face.pt")
            self.is_face_model = True
            print("✅ Loaded yolov26n-face.pt")
        except Exception as e:
            print(f"⚠️ Primary face model unavailable: {e}")
            try:
                self.model = YOLO("yolov8n.pt")
                self.is_face_model = False
                print("✅ Loaded fallback yolov8n.pt (person detector)")
            except Exception as fallback_error:
                print(f"❌ Failed to load any YOLO model: {fallback_error}")
                self.model = None

    def detect_faces(self, frame: np.ndarray, conf_threshold: float = 0.25) -> list[dict]:
        if self.model is None or frame is None:
            return []
            
        try:
            results = self.model.predict(
                frame, 
                verbose=False, 
                device=self.device, 
                half=self.use_fp16, 
                conf=conf_threshold
            )
            
            detections = []
            for r in results:
                boxes = r.boxes
                for box in boxes:
                    # class 0 is face for yolov8n-face.pt, class 0 is person for yolov8n.pt
                    cls_id = int(box.cls[0].item())
                    if cls_id == 0: 
                        x1, y1, x2, y2 = box.xyxy[0].tolist()
                        
                        # If using person model, shrink box to approximate face region (top 30%, center 60%)
                        if not getattr(self, 'is_face_model', True):
                            w = x2 - x1
                            h = y2 - y1
                            y2 = y1 + (h * 0.30)
                            x1 = x1 + (w * 0.20)
                            x2 = x2 - (w * 0.20)
                            
                        conf = box.conf[0].item()
                        detections.append({
                            "bbox": {"x1": int(x1), "y1": int(y1), "x2": int(x2), "y2": int(y2)},
                            "confidence": float(conf)
                        })
            return detections
        except Exception as e:
            print(f"Detection Error: {e}")
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
                conf=conf_threshold
            )
            
            batch_detections = []
            for r in results:
                frame_detections = []
                boxes = r.boxes
                for box in boxes:
                    cls_id = int(box.cls[0].item())
                    if cls_id == 0:
                        x1, y1, x2, y2 = box.xyxy[0].tolist()
                        
                        # If using person model, shrink box to approximate face region (top 30%, center 60%)
                        if not getattr(self, 'is_face_model', True):
                            w = x2 - x1
                            h = y2 - y1
                            y2 = y1 + (h * 0.30)
                            x1 = x1 + (w * 0.20)
                            x2 = x2 - (w * 0.20)
                            
                        conf = box.conf[0].item()
                        frame_detections.append({
                            "bbox": {"x1": int(x1), "y1": int(y1), "x2": int(x2), "y2": int(y2)},
                            "confidence": float(conf)
                        })
                batch_detections.append(frame_detections)
            return batch_detections
        except Exception as e:
            print(f"Batch Detection Error: {e}")
            return [[] for _ in frames]
