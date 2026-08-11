# BlurSystem - AI Privacy Protection

**BlurSystem** is an advanced, AI-powered web application designed to automatically detect and anonymize faces and objects in images and videos. Built with a modern tech stack, it provides tools for automatic face blurring, selective identity protection, and manual object tracking.

## ✨ Features

- **Full Auto-Anonymize:** One-click processing to detect and blur all faces in a video or image using YOLO models.
- **Selective Privacy (Face Map):** The system groups detected faces by identity using DeepFace/ArcFace, allowing you to choose exactly *who* to blur and who to keep visible.
- **Manual Control & Tracking:** Draw boxes manually over any object (e.g., license plates, screens). The system uses OpenCV tracking (KCF/CSRT) to follow the object across the video automatically.
- **Dynamic Blur Engines:** Choose between Gaussian Blur, Pixelate, or Black Box, and adjust the intensity of the effect to meet your specific privacy requirements.

## 💻 Tech Stack

### Frontend
- **Framework:** Next.js 16 (React 19) with TypeScript
- **Styling:** Tailwind CSS 4 & Lucide React (Icons)
- **Key Libraries:** `react-dropzone` (Uploads), `react-konva` (Canvas drawing for manual blur), `react-player` (Video playback), `axios`.

### Backend
- **Framework:** FastAPI (Python) & Uvicorn
- **Computer Vision & AI:** 
  - `OpenCV` (Video processing, Object Tracking)
  - `Ultralytics YOLO` (Face/Person Detection)
  - `InsightFace` / `ONNXRuntime` (Face Recognition & Embeddings)
- **Database:** SQLAlchemy (ORM)
- **Cloud Storage:** Cloudinary (For hosting processed media)

---

## 🚀 Installation & Setup

### Prerequisites
- Node.js (v18+)
- Python (3.9+)
- Cloudinary Account (for media storage)

### 1. Backend Setup

1. **Navigate to the backend directory:**
   ```bash
   cd backend
   ```

2. **Create and activate a virtual environment:**
   ```bash
   python3 -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install Core Dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Environment Configuration (`backend/.env`):**
   Create a file named `.env` inside the `backend/` folder:
   ```env
   # Cloudinary Credentials (Required for media processing)
   CLOUDINARY_CLOUD_NAME=your_cloud_name
   CLOUDINARY_API_KEY=your_api_key
   CLOUDINARY_API_SECRET=your_api_secret
   ```

5. **Run the AI Server:**
   ```bash
   uvicorn main:app --reload
   ```
   *The backend will start at http://localhost:8000*

---

### 2. Frontend Setup

1. **Navigate to the frontend directory:**
   ```bash
   cd frontend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Environment Configuration (`frontend/.env`):**
   Create a file named `.env.local` inside the `frontend/` folder:
   ```env
   # Backend Connection
   FASTAPI_URL=http://localhost:8000
   ```

4. **Run the Development Server:**
   ```bash
   npm run dev
   ```
   *The frontend will start at http://localhost:3000*

---

## 📝 License
This project is open-source and available under the MIT License.
