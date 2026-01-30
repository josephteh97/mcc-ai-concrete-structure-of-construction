from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pathlib import Path
import shutil
import os
import uuid
from typing import Optional
from fastapi import Response

from processing_unit.vision_model import VisionReasoner
from processing_unit.system_manager import SystemManager
from pydantic import BaseModel
from generating_unit.ifc_generator import IfcGenerator
from ifc_to_gltf_converter import ifc_to_gltf

app = FastAPI(title="MCC AI Construction System")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize System Manager (Singleton)
system_manager = SystemManager()
vision_reasoner = VisionReasoner() # It internally uses SystemManager

class ChatRequest(BaseModel):
    message: str

UPLOAD_DIR = Path("uploads")
GLTF_DIR = Path("gltf_output")
UPLOAD_DIR.mkdir(exist_ok=True)
GLTF_DIR.mkdir(exist_ok=True)

@app.post("/api/upload-ifc")
async def upload_ifc(file: UploadFile):
    file_id = str(uuid.uuid4())
    ifc_path = UPLOAD_DIR / f"{file_id}.ifc"
    with open(ifc_path, "wb") as f:
        shutil.copyfileobj(file.file, f)
    return {"file_id": file_id}

@app.post("/api/convert-to-gltf")
async def convert_to_gltf(request: dict):
    file_id = request['file_id']
    ifc_path = UPLOAD_DIR / f"{file_id}.ifc"
    gltf_path = GLTF_DIR / f"{file_id}.glb"
    
    stats = ifc_to_gltf(str(ifc_path), str(gltf_path))
    return {"gltf_url": f"/api/models/{file_id}.glb", "stats": stats}

@app.get("/api/models/{filename}")
async def get_model(filename: str):
    return FileResponse(GLTF_DIR / filename, media_type="model/gltf-binary")

@app.get("/")
def read_root():
    return {"message": "Floor Plan AI System Backend is Running (Managed)"}

@app.get("/health")
def health_check():
    return {"status": "ok", "timestamp": str(uuid.uuid4())}

@app.post("/chat")
async def chat_agent(request: ChatRequest):
    """
    Endpoint for the embedded chat agent.
    """
    response = await vision_reasoner.chat_with_user(request.message)
    return response

@app.post("/process")
async def process_drawing(
    file: UploadFile = File(...),
    scale: float = Form(None), # Optional, defaults to SystemManager config
    height: float = Form(None),  
    floor_count: int = Form(None),
    generation_mode: str = Form(None) # "simple" or "advanced"
):
    """
    Process an uploaded PDF/Image and generate a 3D IFC model via SystemManager.
    """
    result = await system_manager.process_workflow(
        file=file,
        scale=scale,
        height=height,
        floor_count=floor_count,
        generation_mode=generation_mode
    )
    
    return result

@app.get("/download/{filename}")
def download_file(filename: str):
    from fastapi.responses import FileResponse
    path = os.path.join(system_manager.output_dir, filename)
    if os.path.exists(path):
        return FileResponse(path)
    return {"error": "File not found"}

@app.head("/download/{filename}")
def download_head(filename: str):
    path = os.path.join(system_manager.output_dir, filename)
    if os.path.exists(path):
        size = os.path.getsize(path)
        headers = {
            "Content-Type": "application/p21",
            "Content-Length": str(size),
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Expose-Headers": "Content-Length, Content-Type",
        }
        return Response(status_code=200, headers=headers)
    return Response(status_code=404)

@app.get("/debug/sample-ifc")
def debug_sample_ifc():
    from fastapi.responses import FileResponse
    path = os.path.join(system_manager.output_dir, "sample.ifc")
    try:
        gen = IfcGenerator(project_name="DebugSample")
        gen.create_column(0.0, 0.0, 0.5, 0.5, 3.0, 0.0)
        gen.save(path)
    except Exception as e:
        return {"error": str(e)}
    if os.path.exists(path):
        return FileResponse(path)
    return {"error": "Sample IFC not generated"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
