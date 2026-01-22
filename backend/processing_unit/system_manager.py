import uuid
import os
import shutil
from enum import Enum
from typing import Dict, Any, List, Optional
import time

# Import actual processing classes
from processing_unit.object_detection import ObjectDetector
from processing_unit.ocr_extraction import OCRExtractor
from generating_unit.ifc_generator import IfcGenerator

class SystemStatus(Enum):
    IDLE = "idle"
    PROCESSING = "processing"
    ERROR = "error"
    COMPLETED = "completed"
    PAUSED = "paused" # For intervention

class SystemManager:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(SystemManager, cls).__new__(cls)
            cls._instance.initialize()
        return cls._instance

    def initialize(self):
        self.status = SystemStatus.IDLE
        self.logs = []
        self.current_job = {}
        self.last_job_context = {} # Store context for retry/resume
        self.config = {
            "scale": 0.05,
            "height": 3.0,
            "floor_count": 1,
            "conf_threshold": 0.25 # Added confidence threshold
        }
        
        # Load Models
        # Check for custom trained model in project root or default
        model_path = "../yolo26n.pt" if os.path.exists("../yolo26n.pt") else "yolo11n.pt"
        self.detector = ObjectDetector(model_path=model_path)
        self.ocr = OCRExtractor()
        
        self.upload_dir = "uploads"
        self.output_dir = "outputs"
        os.makedirs(self.upload_dir, exist_ok=True)
        os.makedirs(self.output_dir, exist_ok=True)
        self.log("System Initialized. Models Loaded.")

    def log(self, message: str, level: str = "INFO"):
        entry = f"[{time.strftime('%H:%M:%S')}] [{level}] {message}"
        self.logs.append(entry)
        print(entry)

    def update_config(self, key: str, value: Any):
        self.config[key] = value
        self.log(f"Config updated: {key} = {value}")

    async def resume_workflow(self):
        """
        Resumes the workflow using the last job context.
        """
        if not self.last_job_context or "file_path" not in self.last_job_context:
            self.log("No job context to resume.", "ERROR")
            return {"status": "error", "message": "No job context to resume."}
        
        self.log("Resuming workflow with updated configuration...")
        # Re-run detection and generation
        return await self._execute_processing(
            self.last_job_context["file_path"],
            self.last_job_context["job_id"]
        )

    async def process_workflow(self, file, scale=None, height=None, floor_count=None):
        self.status = SystemStatus.PROCESSING
        job_id = str(uuid.uuid4())
        self.current_job = {"id": job_id, "step": "init"}
        
        # Save File First
        self.current_job["step"] = "saving_file"
        file_path = os.path.join(self.upload_dir, f"{job_id}_{file.filename}")
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        self.log(f"File saved: {file_path}")

        # Store context for potential retry
        self.last_job_context = {
            "file_path": file_path,
            "job_id": job_id,
            "original_filename": file.filename
        }
        
        return await self._execute_processing(file_path, job_id)

    async def _execute_processing(self, file_path: str, job_id: str):
        """
        Internal method to execute the core processing logic.
        """
        try:
            # Step 2: Detection
            self.current_job["step"] = "detection"
            self.log(f"Starting Object Detection with conf={self.config['conf_threshold']}...")
            
            det_results = self.detector.predict(file_path, conf_threshold=self.config['conf_threshold'])
            
            # Monitoring / Intervention Point
            if det_results['count'] == 0:
                self.status = SystemStatus.PAUSED
                self.log("Warning: No objects detected. Pausing for agent intervention.", "WARN")
                return {
                    "status": "paused", 
                    "reason": "no_objects_detected", 
                    "job_id": job_id,
                    "message": "No objects were detected. Please check the image or adjust parameters (e.g. threshold)."
                }

            self.log(f"Detected {det_results['count']} objects.")

            # Step 3: IFC Gen
            self.current_job["step"] = "ifc_generation"
            self.log("Generating IFC Model...")
            ifc_gen = IfcGenerator(project_name=f"Project_{job_id}")
            
            # Use current config
            scale = self.config["scale"]
            height = self.config["height"]
            floor_count = self.config["floor_count"]
            
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
                
                if cls == 'column' or cls == 'person': 
                    # Generate column for each floor
                    for i in range(floor_count):
                        elevation = i * height
                        ifc_gen.create_column(cx, cy, width, depth, height, elevation=elevation)
            
            output_filename = f"{job_id}.ifc"
            output_path = os.path.join(self.output_dir, output_filename)
            ifc_gen.save(output_path)
            
            self.status = SystemStatus.COMPLETED
            self.log(f"Job completed. Output: {output_filename}")
            
            return {
                "status": "success",
                "file_id": job_id,
                "detections": det_results['count'],
                "ifc_url": f"/download/{output_filename}"
            }

        except Exception as e:
            self.status = SystemStatus.ERROR
            self.log(f"Error: {str(e)}", "ERROR")
            return {"status": "error", "message": str(e)}
        finally:
            if self.status != SystemStatus.PAUSED:
                self.status = SystemStatus.IDLE
