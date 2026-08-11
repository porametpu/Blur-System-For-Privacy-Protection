import re

# --- 1. Fix detection.py (Box scaling + lower threshold) ---
with open('backend/services/detection.py', 'r') as f:
    det_content = f.read()

# Change default conf_threshold to 0.25 in detect_faces and detect_faces_batch
det_content = det_content.replace('def detect_faces(self, frame: np.ndarray, conf_threshold: float = 0.5)', 'def detect_faces(self, frame: np.ndarray, conf_threshold: float = 0.25)')
det_content = det_content.replace('def detect_faces_batch(self, frames: list[np.ndarray], conf_threshold: float = 0.5)', 'def detect_faces_batch(self, frames: list[np.ndarray], conf_threshold: float = 0.25)')

# Add heuristic to shrink person bbox to face bbox
box_logic_old = """                    if cls_id == 0: 
                        x1, y1, x2, y2 = box.xyxy[0].tolist()
                        conf = box.conf[0].item()"""
box_logic_new = """                    if cls_id == 0: 
                        x1, y1, x2, y2 = box.xyxy[0].tolist()
                        
                        # If using person model, shrink box to approximate face region (top 20%, center 50%)
                        if not getattr(self, 'is_face_model', True):
                            w = x2 - x1
                            h = y2 - y1
                            y2 = y1 + (h * 0.22)
                            x1 = x1 + (w * 0.25)
                            x2 = x2 - (w * 0.25)
                            
                        conf = box.conf[0].item()"""

# Replace in both places (single and batch)
det_content = det_content.replace(
"""                    if cls_id == 0: 
                        x1, y1, x2, y2 = box.xyxy[0].tolist()
                        conf = box.conf[0].item()""", box_logic_new)
det_content = det_content.replace(
"""                    if cls_id == 0:
                        x1, y1, x2, y2 = box.xyxy[0].tolist()
                        conf = box.conf[0].item()""", box_logic_new.replace("                    if cls_id == 0: \n", "                    if cls_id == 0:\n"))


with open('backend/services/detection.py', 'w') as f:
    f.write(det_content)


# --- 2. Fix tracking.py (Constant Velocity Model) ---
with open('backend/services/tracking.py', 'r') as f:
    trk_content = f.read()

# Init tracks with vx and vy
trk_content = trk_content.replace(
"""                    "bbox": det["bbox"],
                    "age": 0,
                    "hits": 1,""",
"""                    "bbox": det["bbox"],
                    "vx": 0.0,
                    "vy": 0.0,
                    "age": 0,
                    "hits": 1,"""
)

# Update matched tracks
matched_old = """        for r, c in zip(row_ind, col_ind):
            if iou_matrix[r, c] >= self.min_iou:
                self.tracks[r]["bbox"] = detections[c]["bbox"]
                self.tracks[r]["age"] = 0
                self.tracks[r]["hits"] += 1"""
matched_new = """        for r, c in zip(row_ind, col_ind):
            if iou_matrix[r, c] >= self.min_iou:
                # Calculate velocity
                old_cx = (self.tracks[r]["bbox"]["x1"] + self.tracks[r]["bbox"]["x2"]) / 2
                old_cy = (self.tracks[r]["bbox"]["y1"] + self.tracks[r]["bbox"]["y2"]) / 2
                new_cx = (detections[c]["bbox"]["x1"] + detections[c]["bbox"]["x2"]) / 2
                new_cy = (detections[c]["bbox"]["y1"] + detections[c]["bbox"]["y2"]) / 2
                
                self.tracks[r]["vx"] = new_cx - old_cx
                self.tracks[r]["vy"] = new_cy - old_cy
                self.tracks[r]["bbox"] = detections[c]["bbox"]
                self.tracks[r]["age"] = 0
                self.tracks[r]["hits"] += 1"""
trk_content = trk_content.replace(matched_old, matched_new)

# Update unmatched tracks
unmatched_old = """        # Handle unmatched tracks (increment age)
        active_tracks = []
        for t, track in enumerate(self.tracks):
            if t not in matched_tracks:
                track["age"] += 1
            if track["age"] <= self.max_age:
                active_tracks.append(track)"""
unmatched_new = """        # Handle unmatched tracks (increment age and apply velocity)
        active_tracks = []
        for t, track in enumerate(self.tracks):
            if t not in matched_tracks:
                track["age"] += 1
                # Apply velocity for smooth interpolation when detection drops
                track["bbox"]["x1"] += track.get("vx", 0)
                track["bbox"]["y1"] += track.get("vy", 0)
                track["bbox"]["x2"] += track.get("vx", 0)
                track["bbox"]["y2"] += track.get("vy", 0)
                
            if track["age"] <= self.max_age:
                active_tracks.append(track)"""
trk_content = trk_content.replace(unmatched_old, unmatched_new)

with open('backend/services/tracking.py', 'w') as f:
    f.write(trk_content)

print("Detection and Tracking tweaked successfully.")
