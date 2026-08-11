import numpy as np
from scipy.optimize import linear_sum_assignment

class SimpleTracker:
    """
    A simple IoU-based object tracker inspired by SORT/ByteTrack.
    """
    def __init__(self, max_age=30, min_iou=0.3):
        self.max_age = max_age
        self.min_iou = min_iou
        self.tracks = [] # List of dicts: {"track_id": int, "bbox": dict, "age": int, "hits": int, "identity_id": int}
        self.next_track_id = 1

    def reset(self):
        self.tracks = []
        self.next_track_id = 1

    def _compute_iou(self, box1, box2):
        """Computes IoU between two bounding boxes {"x1", "y1", "x2", "y2"}."""
        xA = max(box1["x1"], box2["x1"])
        yA = max(box1["y1"], box2["y1"])
        xB = min(box1["x2"], box2["x2"])
        yB = min(box1["y2"], box2["y2"])
        
        interArea = max(0, xB - xA) * max(0, yB - yA)
        
        box1Area = (box1["x2"] - box1["x1"]) * (box1["y2"] - box1["y1"])
        box2Area = (box2["x2"] - box2["x1"]) * (box2["y2"] - box2["y1"])
        
        denom = float(box1Area + box2Area - interArea)
        return interArea / denom if denom > 0 else 0

    def update(self, detections: list[dict]) -> list[dict]:
        """
        Update tracker with new detections.
        detections: list of {"bbox": {"x1", "y1", "x2", "y2"}, "identity_id": int (optional)}
        Returns list of updated tracks: {"track_id", "bbox", "age", "hits", "identity_id"}
        """
        # If no tracks, just add all detections as new tracks
        if not self.tracks:
            for det in detections:
                self.tracks.append({
                    "track_id": self.next_track_id,
                    "bbox": det["bbox"],
                    "vx": 0.0,
                    "vy": 0.0,
                    "age": 0,
                    "hits": 1,
                    "identity_id": det.get("identity_id")
                })
                self.next_track_id += 1
            return self.tracks.copy()

        # If no detections, increment age for all tracks and remove old ones
        if not detections:
            active_tracks = []
            for track in self.tracks:
                track["age"] += 1
                if track["age"] <= self.max_age:
                    active_tracks.append(track)
            self.tracks = active_tracks
            return self.tracks.copy()

        # Compute IoU matrix between existing tracks and new detections
        iou_matrix = np.zeros((len(self.tracks), len(detections)), dtype=np.float32)
        for t, track in enumerate(self.tracks):
            for d, det in enumerate(detections):
                iou_matrix[t, d] = self._compute_iou(track["bbox"], det["bbox"])

        # Cost matrix for Hungarian algorithm (we want to maximize IoU, so minimize 1-IoU)
        cost_matrix = 1.0 - iou_matrix
        
        # Linear assignment
        row_ind, col_ind = linear_sum_assignment(cost_matrix)
        
        matched_tracks = set()
        matched_detections = set()
        
        # Update matched tracks
        for r, c in zip(row_ind, col_ind):
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
                self.tracks[r]["hits"] += 1
                
                # Update identity if detection has one
                det_identity = detections[c].get("identity_id")
                if det_identity is not None:
                    self.tracks[r]["identity_id"] = det_identity
                    
                matched_tracks.add(r)
                matched_detections.add(c)
                
        # Handle unmatched tracks (increment age and apply velocity)
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
                active_tracks.append(track)
                
        # Handle unmatched detections (create new tracks)
        for d, det in enumerate(detections):
            if d not in matched_detections:
                active_tracks.append({
                    "track_id": self.next_track_id,
                    "bbox": det["bbox"],
                    "vx": 0.0,
                    "vy": 0.0,
                    "age": 0,
                    "hits": 1,
                    "identity_id": det.get("identity_id")
                })
                self.next_track_id += 1
                
        self.tracks = active_tracks
        return self.tracks.copy()
