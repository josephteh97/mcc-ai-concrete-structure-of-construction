#!/usr/bin/env python3
"""
Backend IFC to GLTF Converter
Add this to your FastAPI backend
"""

# Save this as: backend/ifc_to_gltf_converter.py

import ifcopenshell
import ifcopenshell.geom
import json
import os
from pathlib import Path

def ifc_to_gltf(ifc_file_path, output_gltf_path):
    """
    Convert IFC file to GLTF format
    
    Args:
        ifc_file_path: Path to input IFC file
        output_gltf_path: Path to output GLTF file
    
    Returns:
        dict: Conversion statistics
    """
    print(f"[IFC→GLTF] Opening IFC file: {ifc_file_path}")
    
    # Open IFC file
    ifc_file = ifcopenshell.open(ifc_file_path)
    
    # Create settings for geometry processing
    settings = ifcopenshell.geom.settings()
    settings.set(settings.USE_WORLD_COORDS, True)
    settings.set(settings.WELD_VERTICES, True)
    settings.set(settings.USE_BREP_DATA, False)
    settings.set(settings.SEW_SHELLS, True)
    settings.set(settings.DISABLE_TRIANGULATION, False)
    
    print("[IFC→GLTF] Processing geometry...")
    
    # Collect all geometry
    vertices = []
    faces = []
    vertex_offset = 0
    objects_processed = 0
    
    # Get all products with geometry
    products = ifc_file.by_type('IfcProduct')
    
    for product in products:
        if not product.Representation:
            continue
            
        try:
            shape = ifcopenshell.geom.create_shape(settings, product)
            geometry = shape.geometry
            
            # Get vertices
            verts = geometry.verts
            num_verts = len(verts) // 3
            
            # Add vertices (convert to list of [x, y, z])
            for i in range(0, len(verts), 3):
                vertices.extend([verts[i], verts[i+1], verts[i+2]])
            
            # Get faces (triangles)
            faces_data = geometry.faces
            num_faces = len(faces_data) // 3
            
            # Add faces with offset
            for i in range(0, len(faces_data), 3):
                faces.extend([
                    faces_data[i] + vertex_offset,
                    faces_data[i+1] + vertex_offset,
                    faces_data[i+2] + vertex_offset
                ])
            
            vertex_offset += num_verts
            objects_processed += 1
            
            if objects_processed % 10 == 0:
                print(f"[IFC→GLTF] Processed {objects_processed} objects...")
                
        except Exception as e:
            print(f"[IFC→GLTF] Warning: Could not process {product.is_a()}: {e}")
            continue
    
    print(f"[IFC→GLTF] Total objects processed: {objects_processed}")
    print(f"[IFC→GLTF] Total vertices: {len(vertices) // 3}")
    print(f"[IFC→GLTF] Total faces: {len(faces) // 3}")
    
    # Create GLTF structure
    gltf = {
        "asset": {
            "version": "2.0",
            "generator": "IFC to GLTF Converter"
        },
        "scene": 0,
        "scenes": [
            {
                "nodes": [0]
            }
        ],
        "nodes": [
            {
                "mesh": 0
            }
        ],
        "meshes": [
            {
                "primitives": [
                    {
                        "attributes": {
                            "POSITION": 0
                        },
                        "indices": 1,
                        "material": 0
                    }
                ]
            }
        ],
        "materials": [
            {
                "pbrMetallicRoughness": {
                    "baseColorFactor": [0.8, 0.8, 0.8, 1.0],
                    "metallicFactor": 0.0,
                    "roughnessFactor": 0.9
                }
            }
        ],
        "buffers": [
            {
                "byteLength": 0  # Will be set later
            }
        ],
        "bufferViews": [
            {
                "buffer": 0,
                "byteOffset": 0,
                "byteLength": 0,  # Will be set later
                "target": 34962  # ARRAY_BUFFER
            },
            {
                "buffer": 0,
                "byteOffset": 0,  # Will be set later
                "byteLength": 0,  # Will be set later
                "target": 34963  # ELEMENT_ARRAY_BUFFER
            }
        ],
        "accessors": [
            {
                "bufferView": 0,
                "byteOffset": 0,
                "componentType": 5126,  # FLOAT
                "count": len(vertices) // 3,
                "type": "VEC3",
                "min": [min(vertices[i::3]) for i in range(3)],
                "max": [max(vertices[i::3]) for i in range(3)]
            },
            {
                "bufferView": 1,
                "byteOffset": 0,
                "componentType": 5125,  # UNSIGNED_INT
                "count": len(faces),
                "type": "SCALAR"
            }
        ]
    }
    
    # Create binary buffer
    import struct
    
    # Vertices (float32)
    vertex_buffer = struct.pack(f'{len(vertices)}f', *vertices)
    vertex_size = len(vertex_buffer)
    
    # Align to 4-byte boundary
    padding1 = (4 - (vertex_size % 4)) % 4
    vertex_buffer += b'\x00' * padding1
    
    # Faces (uint32)
    face_buffer = struct.pack(f'{len(faces)}I', *faces)
    face_size = len(face_buffer)
    
    # Combined buffer
    buffer = vertex_buffer + face_buffer
    
    # Update buffer info
    gltf['buffers'][0]['byteLength'] = len(buffer)
    gltf['bufferViews'][0]['byteLength'] = vertex_size + padding1
    gltf['bufferViews'][1]['byteOffset'] = vertex_size + padding1
    gltf['bufferViews'][1]['byteLength'] = face_size
    
    # Write GLTF JSON
    gltf_json = json.dumps(gltf, indent=2)
    
    # Create GLB (binary GLTF)
    # GLB format: header + JSON chunk + BIN chunk
    
    # Header
    magic = b'glTF'
    version = struct.pack('<I', 2)
    
    # JSON chunk
    json_bytes = gltf_json.encode('utf-8')
    json_padding = (4 - (len(json_bytes) % 4)) % 4
    json_bytes += b' ' * json_padding
    json_length = struct.pack('<I', len(json_bytes))
    json_type = struct.pack('<I', 0x4E4F534A)  # JSON
    
    # BIN chunk
    bin_padding = (4 - (len(buffer) % 4)) % 4
    buffer += b'\x00' * bin_padding
    bin_length = struct.pack('<I', len(buffer))
    bin_type = struct.pack('<I', 0x004E4942)  # BIN
    
    # Total length
    total_length = struct.pack('<I', 
        12 +  # header
        8 + len(json_bytes) +  # JSON chunk
        8 + len(buffer)  # BIN chunk
    )
    
    # Write GLB file
    with open(output_gltf_path, 'wb') as f:
        f.write(magic)
        f.write(version)
        f.write(total_length)
        f.write(json_length)
        f.write(json_type)
        f.write(json_bytes)
        f.write(bin_length)
        f.write(bin_type)
        f.write(buffer)
    
    print(f"[IFC→GLTF] ✓ Conversion complete: {output_gltf_path}")
    
    return {
        "objects_processed": objects_processed,
        "vertices": len(vertices) // 3,
        "faces": len(faces) // 3,
        "file_size": os.path.getsize(output_gltf_path)
    }


# FastAPI endpoint to add to your main.py or routes file
"""
from fastapi import FastAPI, UploadFile, HTTPException
from fastapi.responses import FileResponse
from ifc_to_gltf_converter import ifc_to_gltf
import shutil
import uuid

app = FastAPI()

UPLOAD_DIR = Path("uploads")
GLTF_DIR = Path("gltf_output")
UPLOAD_DIR.mkdir(exist_ok=True)
GLTF_DIR.mkdir(exist_ok=True)

@app.post("/api/upload-ifc")
async def upload_ifc(file: UploadFile):
    if not file.filename.endswith('.ifc'):
        raise HTTPException(400, "Only IFC files allowed")
    
    file_id = str(uuid.uuid4())
    ifc_path = UPLOAD_DIR / f"{file_id}.ifc"
    
    with open(ifc_path, "wb") as f:
        shutil.copyfileobj(file.file, f)
    
    return {"file_id": file_id, "filename": file.filename}

@app.post("/api/convert-to-gltf")
async def convert_to_gltf(request: dict):
    file_id = request.get('file_id')
    if not file_id:
        raise HTTPException(400, "file_id required")
    
    ifc_path = UPLOAD_DIR / f"{file_id}.ifc"
    if not ifc_path.exists():
        raise HTTPException(404, "IFC file not found")
    
    gltf_path = GLTF_DIR / f"{file_id}.glb"
    
    try:
        stats = ifc_to_gltf(str(ifc_path), str(gltf_path))
        return {
            "gltf_url": f"/api/models/{file_id}.glb",
            "stats": stats
        }
    except Exception as e:
        raise HTTPException(500, f"Conversion failed: {str(e)}")

@app.get("/api/models/{filename}")
async def get_model(filename: str):
    file_path = GLTF_DIR / filename
    if not file_path.exists():
        raise HTTPException(404, "Model not found")
    
    return FileResponse(
        file_path,
        media_type="model/gltf-binary",
        headers={"Access-Control-Allow-Origin": "*"}
    )
"""

if __name__ == "__main__":
    import sys
    if len(sys.argv) < 3:
        print("Usage: python ifc_to_gltf_converter.py <input.ifc> <output.glb>")
        sys.exit(1)
    
    input_file = sys.argv[1]
    output_file = sys.argv[2]
    
    stats = ifc_to_gltf(input_file, output_file)
    print("\nConversion Statistics:")
    for key, value in stats.items():
        print(f"  {key}: {value}")
