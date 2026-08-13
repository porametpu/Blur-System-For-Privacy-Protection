import cv2
import numpy as np
import os
import subprocess
import base64
from concurrent.futures import ThreadPoolExecutor

class RenderingService:
    @staticmethod
    def apply_effect_to_frame(frame: np.ndarray, regions: list[dict], blur_type: str = 'gaussian', blur_strength: int = 51, sticker_img: np.ndarray = None) -> np.ndarray:
        """
        Applies blur/effect to specified regions in a frame.
        regions is a list of {"x1", "y1", "x2", "y2"}
        """
        if frame is None or not regions:
            return frame
            
        res = frame.copy()
        
        # Ensure blur strength is odd for gaussian
        k_size = int(blur_strength)
        if k_size % 2 == 0:
            k_size += 1
        k_size = max(3, k_size)
            
        for r in regions:
            x1, y1, x2, y2 = int(r.get("x1", 0)), int(r.get("y1", 0)), int(r.get("x2", 0)), int(r.get("y2", 0))
            
            # Bounds check
            x1, y1 = max(0, x1), max(0, y1)
            x2, y2 = min(res.shape[1], x2), min(res.shape[0], y2)
            
            if x2 <= x1 or y2 <= y1:
                continue
                
            roi = res[y1:y2, x1:x2]
            if roi.size == 0:
                continue
                
            if blur_type == "gaussian":
                # Ensure kernel size isn't larger than ROI
                actual_k_size = min(k_size, min(roi.shape[0], roi.shape[1]))
                if actual_k_size % 2 == 0:
                    actual_k_size -= 1
                if actual_k_size >= 3:
                    roi = cv2.GaussianBlur(roi, (actual_k_size, actual_k_size), 0)
            
            elif blur_type == "pixelate":
                rh, rw = roi.shape[:2]
                div = max(2, int(blur_strength / 4))
                sm_w, sm_h = max(1, rw // div), max(1, rh // div)
                sm = cv2.resize(roi, (sm_w, sm_h), interpolation=cv2.INTER_LINEAR)
                roi = cv2.resize(sm, (rw, rh), interpolation=cv2.INTER_NEAREST)
                
            elif blur_type == "black":
                roi = np.zeros_like(roi)

            elif blur_type == "sticker" and sticker_img is not None:
                rh, rw = roi.shape[:2]
                # Resize sticker to fit region
                sticker_resized = cv2.resize(sticker_img, (rw, rh), interpolation=cv2.INTER_AREA)
                if sticker_resized.shape[2] == 4:
                    # Has alpha channel — composite over roi
                    alpha = sticker_resized[:, :, 3:4].astype(np.float32) / 255.0
                    sticker_rgb = sticker_resized[:, :, :3].astype(np.float32)
                    roi_f = roi.astype(np.float32)
                    blended = sticker_rgb * alpha + roi_f * (1.0 - alpha)
                    roi = blended.clip(0, 255).astype(np.uint8)
                else:
                    roi = sticker_resized[:, :, :3]
                
            res[y1:y2, x1:x2] = roi
            
        return res

    # Keep backward compat alias
    @staticmethod
    def apply_blur_to_frame(frame: np.ndarray, regions: list[dict], blur_type: str = 'gaussian', blur_strength: int = 51, sticker_img: np.ndarray = None) -> np.ndarray:
        return RenderingService.apply_effect_to_frame(frame, regions, blur_type, blur_strength, sticker_img)

    @staticmethod
    def extract_preview_frames(video_path: str, interval_frames: int = 30) -> list[tuple[int, float, np.ndarray]]:
        """
        Extracts frames at regular intervals.
        Returns list of (frame_number, timestamp_ms, frame_image)
        """
        ext = video_path.split('.')[-1].lower()
        if ext in ['jpg', 'jpeg', 'png', 'webp']:
            img = cv2.imread(video_path)
            if img is not None:
                return [(0, 0.0, img)]
            return []

        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            return []
            
        frames = []
        frame_idx = 0
        
        while True:
            ret, frame = cap.read()
            if not ret:
                break
                
            if frame_idx % interval_frames == 0:
                timestamp_ms = cap.get(cv2.CAP_PROP_POS_MSEC)
                frames.append((frame_idx, timestamp_ms, frame))
                
            frame_idx += 1
            
        cap.release()
        return frames

    @staticmethod
    def generate_preview_frame(video_path: str, frame_number: int) -> np.ndarray | None:
        """Extracts a specific frame by index."""
        ext = video_path.split('.')[-1].lower()
        if ext in ['jpg', 'jpeg', 'png', 'webp']:
            return cv2.imread(video_path)

        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            return None
            
        cap.set(cv2.CAP_PROP_POS_FRAMES, frame_number)
        ret, frame = cap.read()
        cap.release()
        
        return frame if ret else None

    @staticmethod
    def render_video(
        input_path: str, 
        output_path: str, 
        identity_blur_map: dict[int, bool], 
        face_data_by_frame: dict[int, list[dict]], 
        manual_boxes: list[dict] = None,
        blur_type: str = 'gaussian', 
        blur_strength: int = 51,
        sticker_image_b64: str = None,
        progress_callback = None
    ) -> bool:
        """
        Renders the video applying blur/effect to specified identities and manual boxes.
        sticker_image_b64: base64 encoded image string (no data: prefix)
        manual_boxes: [{"start_frame_number": int, "x": int, "y": int, "width": int, "height": int}]
        """
        # Decode sticker image once
        sticker_img = None
        if blur_type == 'sticker' and sticker_image_b64:
            try:
                img_bytes = base64.b64decode(sticker_image_b64)
                img_array = np.frombuffer(img_bytes, dtype=np.uint8)
                sticker_img = cv2.imdecode(img_array, cv2.IMREAD_UNCHANGED)
            except Exception as e:
                print(f"Sticker decode error: {e}")
        ext = input_path.split('.')[-1].lower()
        is_image = ext in ['jpg', 'jpeg', 'png', 'webp']

        if is_image:
            img = cv2.imread(input_path)
            if img is None:
                return False
            faces = face_data_by_frame.get(0, [])
            regions_to_blur = []
            
            for face in faces:
                identity_id = face.get("identity_id")
                should_blur = identity_blur_map.get(identity_id, True) if identity_id else True
                if should_blur and "bbox" in face:
                    regions_to_blur.append(face["bbox"])
                    
            for mb in (manual_boxes or []):
                regions_to_blur.append({
                    "x1": mb["x"], "y1": mb["y"], 
                    "x2": mb["x"] + mb["width"], "y2": mb["y"] + mb["height"]
                })
            
            if regions_to_blur:
                img = RenderingService.apply_effect_to_frame(img, regions_to_blur, blur_type, blur_strength, sticker_img)
                
            cv2.imwrite(output_path, img)
            return True

        cap = cv2.VideoCapture(input_path)
        if not cap.isOpened():
            return False
            
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        fps = cap.get(cv2.CAP_PROP_FPS) or 30
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        
        # Use mp4v codec
        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
        
        # Temporary video output (no audio)
        temp_out = output_path + ".temp.mp4"
        out = cv2.VideoWriter(temp_out, fourcc, fps, (width, height))
        
        frame_idx = 0
        manual_boxes = manual_boxes or []
        active_trackers = [] # list of cv2.Tracker

        # Check if legacy tracker exists (opencv-contrib) or standard
        def create_tracker():
            # Use KCF which is significantly faster than CSRT, with decent accuracy
            if hasattr(cv2, 'TrackerKCF_create'):
                return cv2.TrackerKCF_create()
            elif hasattr(cv2.legacy, 'TrackerKCF_create'):
                return cv2.legacy.TrackerKCF_create()
            # Fallback to CSRT if KCF is not available
            if hasattr(cv2, 'TrackerCSRT_create'):
                return cv2.TrackerCSRT_create()
            elif hasattr(cv2.legacy, 'TrackerCSRT_create'):
                return cv2.legacy.TrackerCSRT_create()
            return None

        while True:
            ret, frame = cap.read()
            if not ret:
                break
                
            faces = face_data_by_frame.get(frame_idx, [])
            regions_to_blur = []
            
            for face in faces:
                identity_id = face.get("identity_id")
                # If no identity, blur by default to be safe, or check map
                should_blur = identity_blur_map.get(identity_id, True) if identity_id else True
                
                if should_blur and "bbox" in face:
                    regions_to_blur.append(face["bbox"])
                    
            # Apply static boxes that have started
            for mb in manual_boxes:
                # If it's a static box (is_tracking == False) and we are past its start frame
                if not mb.get("is_tracking", True) and frame_idx >= mb.get("start_frame_number", 0):
                    regions_to_blur.append({
                        "x1": mb["x"], "y1": mb["y"], 
                        "x2": mb["x"] + mb["width"], "y2": mb["y"] + mb["height"]
                    })
                    
            # Initialize new manual trackers starting at this frame
            for mb in manual_boxes:
                if mb.get("is_tracking", True) and mb.get("start_frame_number") == frame_idx:
                    tracker = create_tracker()
                    if tracker is not None:
                        # Tracker expects (x, y, w, h)
                        bbox = (mb["x"], mb["y"], mb["width"], mb["height"])
                        tracker.init(frame, bbox)
                        active_trackers.append(tracker)
                    else:
                        # Fallback to static box if no tracker
                        regions_to_blur.append({
                            "x1": mb["x"], "y1": mb["y"], 
                            "x2": mb["x"] + mb["width"], "y2": mb["y"] + mb["height"]
                        })
            
            # Update active trackers
            retained_trackers = []
            for tracker in active_trackers:
                success, box = tracker.update(frame)
                if success:
                    x, y, w, h = [int(v) for v in box]
                    regions_to_blur.append({"x1": x, "y1": y, "x2": x + w, "y2": y + h})
                    retained_trackers.append(tracker)
            active_trackers = retained_trackers

            if regions_to_blur:
                frame = RenderingService.apply_effect_to_frame(frame, regions_to_blur, blur_type, blur_strength, sticker_img)
                
            out.write(frame)
            frame_idx += 1
            
            if progress_callback and frame_idx % 30 == 0:
                progress_callback(frame_idx, total_frames)
                
        cap.release()
        out.release()
        
        # Attempt to copy audio using ffmpeg
        try:
            cmd = [
                'ffmpeg', '-y',
                '-i', temp_out,
                '-i', input_path,
                '-c:v', 'copy',
                '-c:a', 'aac',
                '-map', '0:v:0',
                '-map', '1:a:0?', # ? means optional (if input has audio)
                output_path
            ]
            subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
            # Remove temp video if successful
            if os.path.exists(temp_out) and os.path.exists(output_path):
                os.remove(temp_out)
        except Exception as e:
            print(f"Audio muxing failed: {e}. Keeping video without audio.")
            # If ffmpeg fails, just use the temp file
            import shutil
            shutil.move(temp_out, output_path)
            
        return True
