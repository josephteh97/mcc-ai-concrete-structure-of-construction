from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
import shutil
import os
import uuid
from typing import Optional

from processing_unit.object_detection import ObjectDetector
from processing_unit.ocr_extraction import OCRExtractor
from generating_unit.ifc_generator import IfcGenerator

app = FastAPI(title="MCC AI Construction System")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Directories
UPLOAD_DIR = "uploads"
OUTPUT_DIR = "outputs"
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Initialize models (Lazy load or at startup)
# In production, we'd want to check if model exists
detector = ObjectDetector() # Will use default weights if file not found, might warn
ocr = OCRExtractor()

@app.get("/")
def read_root():
    return {"message": "Floor Plan AI System Backend is Running"}

@app.post("/process")
async def process_drawing(
    file: UploadFile = File(...),
    scale: float = Form(0.05), # pixels to meters scale factor (default guess)
    height: float = Form(3.0)  # floor height in meters
):
    """
    Process an uploaded PDF/Image and generate a 3D IFC model.
    """
    # 1. Save uploaded file
    file_id = str(uuid.uuid4())
    file_path = os.path.join(UPLOAD_DIR, f"{file_id}_{file.filename}")
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    # 2. Run Object Detection (YOLO)
    # Detect Columns, Beams, etc.
    try:
        det_results = detector.predict(file_path)
    except Exception as e:
        return {"error": f"Detection failed: {str(e)}"}
    
    # 3. Run OCR (optional)
    # text_results = ocr.extract_text(file_path)
    
    # 4. Generate IFC Model
    ifc_gen = IfcGenerator(project_name=f"Project_{file_id}")
    
    # Convert detections to 3D elements
    # Note: This is a simplified mapping. Real world requires coordinate transform (pixel -> meter)
    # and handling of origin.
    
    # Center the model?
    # Let's assume image (0,0) is world (0,0) for now, with Y inverted (image y goes down, 3d y goes up)
    
    img_height = 1000 # Mock, we should read image size
    
    for det in det_results['detections']:
        cls = det['class']
        bbox = det['bbox'] # x1, y1, x2, y2
        
        # Convert pixels to meters
        x1_m = bbox[0] * scale
        y1_m = bbox[1] * scale
        x2_m = bbox[2] * scale
        y2_m = bbox[3] * scale
        
        width = x2_m - x1_m
        depth = y2_m - y1_m
        cx = x1_m + width / 2
        cy = - (y1_m + depth / 2) # Flip Y axis for 3D
        
        if cls == 'column' or cls == 'person': # using 'person' as proxy if testing with standard yolo model
            ifc_gen.create_column(cx, cy, width, depth, height)
        
        # Add logic for beams/slabs here
            
    output_filename = f"{file_id}.ifc"
    output_path = os.path.join(OUTPUT_DIR, output_filename)
    ifc_gen.save(output_path)
    
    return {
        "status": "success",
        "file_id": file_id,
        "detections": det_results['count'],
        "ifc_url": f"/download/{output_filename}"
    }

@app.get("/download/{filename}")
def download_file(filename: str):
    from fastapi.responses import FileResponse
    path = os.path.join(OUTPUT_DIR, filename)
    if os.path.exists(path):
        return FileResponse(path)
    return {"error": "File not found"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
