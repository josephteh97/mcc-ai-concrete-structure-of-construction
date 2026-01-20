from roboflow import Roboflow
import os
import sys

def download_dataset(api_key: str):
    """
    Download the 'columns-fncne' dataset from Roboflow Universe.
    
    Args:
        api_key (str): Your private Roboflow API Key.
    """
    rf = Roboflow(api_key=api_key)
    # Based on the URL: https://universe.roboflow.com/columns-and-ducts/columns-fncne
    # Workspace: columns-and-ducts
    # Project: columns-fncne
    
    print("Accessing Roboflow Workspace...")
    project = rf.workspace("columns-and-ducts").project("columns-fncne")
    
    print("Downloading dataset (yolov11 format)...")
    # We download version 1 (or latest) in yolov11 format
    # YOLOv8 format is compatible with YOLOv11 in Ultralytics
    dataset = project.version(1).download("yolov8") 
    
    print(f"Dataset downloaded to: {dataset.location}")
    return dataset.location

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python download_data.py <ROBOFLOW_API_KEY>")
        print("Or set ROBOFLOW_API_KEY environment variable.")
        api_key = os.getenv("ROBOFLOW_API_KEY")
    else:
        api_key = sys.argv[1]
        
    if not api_key:
        print("Error: No API Key provided.")
        sys.exit(1)
        
    download_dataset(api_key)
