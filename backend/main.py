from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
import shutil
import os
import uuid
from typing import Optional

from processing_unit.vision_model import VisionReasoner
from processing_unit.system_manager import SystemManager
from pydantic import BaseModel

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

@app.get("/")
def read_root():
    return {"message": "Floor Plan AI System Backend is Running (Managed)"}

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
    floor_count: int = Form(None) 
):
    """
    Process an uploaded PDF/Image and generate a 3D IFC model via SystemManager.
    """
    result = await system_manager.process_workflow(
        file=file,
        scale=scale,
        height=height,
        floor_count=floor_count
    )
    
    return result

@app.get("/download/{filename}")
def download_file(filename: str):
    from fastapi.responses import FileResponse
    path = os.path.join(system_manager.output_dir, filename)
    if os.path.exists(path):
        return FileResponse(path)
    return {"error": "File not found"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
