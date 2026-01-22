from ultralytics import YOLO
import cv2
import numpy as np
from typing import List, Dict, Any

class ObjectDetector:
    def __init__(self, model_path: str = "yolo26n.pt"):
        """
        Initialize the YOLOv11 detector.
        
        Args:
            model_path (str): Path to the trained .pt file. 
                              Defaults to standard pre-trained weights if custom model not available.
        """
        self.model = YOLO(model_path)
        self.class_names = self.model.names

    def predict(self, image_path: str, conf_threshold: float = 0.25) -> Dict[str, Any]:
        """
        Run inference on an image.
        
        Args:
            image_path (str): Path to the input image.
            conf_threshold (float): Confidence threshold for detections.
            
        Returns:
            Dict containing detections and metadata.
        """
        results = self.model.predict(image_path, conf=conf_threshold)
        result = results[0] # We process one image at a time
        
        detections = []
        for box in result.boxes:
            cls_id = int(box.cls[0])
            class_name = self.class_names[cls_id]
            confidence = float(box.conf[0])
            xyxy = box.xyxy[0].tolist() # [x1, y1, x2, y2]
            
            detections.append({
                "class": class_name,
                "confidence": confidence,
                "bbox": xyxy
            })
            
        return {
            "file": image_path,
            "count": len(detections),
            "detections": detections
        }

    def visualize(self, image_path: str, output_path: str):
        """
        Visualize detections and save the image.
        """
        results = self.model.predict(image_path)
        result = results[0]
        result.save(filename=output_path)  # save to disk
