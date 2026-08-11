import numpy as np
import cv2
import torch

class FaceRecognitionService:
    def __init__(self):
        self.active = False
        self.use_deepface = False
        self.app = None
        self._embedding_cache = {}

        try:
            import insightface
            from insightface.app import FaceAnalysis
            
            # Initialize InsightFace
            providers = ['CUDAExecutionProvider', 'CPUExecutionProvider'] if torch.cuda.is_available() else ['CPUExecutionProvider']
            self.app = FaceAnalysis(name='buffalo_l', providers=providers)
            
            # Disable face detection in InsightFace since we already use YOLO
            # We just need the recognition part (embedding extraction)
            self.app.prepare(ctx_id=0 if torch.cuda.is_available() else -1, det_size=(640, 640))
            self.active = True
            print("✅ InsightFace ArcFace loaded successfully")
            
        except Exception as e:
            print(f"⚠️ InsightFace failed: {e}. Falling back to DeepFace ArcFace...")
            try:
                from deepface import DeepFace
                # Just build the model to cache it
                DeepFace.build_model('ArcFace')
                self.use_deepface = True
                self.active = True
                print("✅ DeepFace ArcFace fallback loaded successfully")
            except Exception as e2:
                print(f"❌ Both InsightFace and DeepFace failed. Recognition disabled. Error: {e2}")
                self.active = False

    def extract_embedding(self, face_crop: np.ndarray) -> np.ndarray | None:
        """Extracts 512-d normalized embedding from a face crop."""
        if not self.active or face_crop is None or face_crop.size == 0:
            return None
            
        try:
            if not self.use_deepface:
                # InsightFace extraction
                # The face model gives tight crops. InsightFace needs some context
                # to detect the face internally. Add padding around the crop.
                h, w = face_crop.shape[:2]
                pad = max(h, w) // 2
                padded = cv2.copyMakeBorder(face_crop, pad, pad, pad, pad, cv2.BORDER_CONSTANT, value=(128, 128, 128))
                
                # Resize to a reasonable size for InsightFace detection
                scale = max(1, 640 / max(padded.shape[:2]))
                if scale != 1:
                    padded = cv2.resize(padded, None, fx=scale, fy=scale)
                
                faces = self.app.get(padded)
                if faces and len(faces) > 0:
                    emb = faces[0].normed_embedding
                    return emb
                    
                # Fallback: try with the recognition model directly (skip detection)
                # Resize face crop to ArcFace expected input size
                try:
                    from insightface.utils import face_align
                    img_112 = cv2.resize(face_crop, (112, 112))
                    # Get the recognition model directly
                    rec_model = None
                    for m in self.app.models.values():
                        if hasattr(m, 'get_feat') or hasattr(m, 'get'):
                            rec_model = m
                            break
                    if rec_model is not None and hasattr(rec_model, 'get_feat'):
                        blob = cv2.dnn.blobFromImage(img_112, 1.0/127.5, (112, 112), (127.5, 127.5, 127.5), swapRB=True)
                        emb = rec_model.get_feat(blob).flatten()
                        norm = np.linalg.norm(emb)
                        if norm > 1e-6:
                            emb = emb / norm
                        return emb
                except Exception:
                    pass
                    
                return None
            else:
                # DeepFace extraction
                from deepface import DeepFace
                # enforce_detection=False since it's already a crop
                obj = DeepFace.represent(
                    img_path=face_crop, 
                    model_name="ArcFace", 
                    enforce_detection=False, 
                    detector_backend="skip"
                )
                if obj and len(obj) > 0:
                    emb = np.array(obj[0]["embedding"], dtype=np.float32)
                    norm = np.linalg.norm(emb)
                    if norm > 1e-6:
                        emb = emb / norm
                    return emb
                return None
        except Exception as e:
            print(f"Embedding extraction error: {e}")
            return None

    def compute_similarity(self, emb1: np.ndarray, emb2: np.ndarray) -> float:
        """Computes cosine similarity between two normalized embeddings."""
        if emb1 is None or emb2 is None:
            return 0.0
        # Since embeddings should be L2 normalized, dot product = cosine similarity
        return float(np.dot(emb1, emb2))

    def match_identity(self, embedding: np.ndarray, known_identities: list[dict], threshold: float = 0.45) -> int | None:
        """
        Match embedding against known identities.
        known_identities is a list of dicts: {"identity_id": int, "avg_embedding": np.ndarray}
        Returns identity_id or None if no match above threshold.
        """
        if not self.active or embedding is None or not known_identities:
            return None
            
        best_match_id = None
        best_sim = -1.0
        
        for identity in known_identities:
            known_emb = identity.get("avg_embedding")
            if known_emb is not None:
                sim = self.compute_similarity(embedding, known_emb)
                if sim > best_sim:
                    best_sim = sim
                    best_match_id = identity.get("identity_id")
                    
        if best_sim >= threshold:
            return best_match_id
            
        return None
