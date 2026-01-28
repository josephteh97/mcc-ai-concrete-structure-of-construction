import os
import sys
import time
import requests

# ============================================================
# Purpose: Generate a minimal IFC file and verify end-to-end
#          downloadability from the backend for the frontend viewer.
#
# What this script does:
# 1) Creates a small IFC (column + door) using IfcOpenShell API
# 2) Writes to backend/outputs/test_output.ifc (served by /download)
# 3) Verifies entity counts locally
# 4) Checks backend availability and attempts HTTP GET
# 5) Prints concise next-step instructions
# ============================================================

# Add backend to path so we can import generating code
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from generating_unit.ifc_generator import IfcGenerator

OUTPUT_DIR = os.path.join("backend", "outputs")
OUTPUT_FILE = "test_output.ifc"
OUTPUT_PATH = os.path.join(OUTPUT_DIR, OUTPUT_FILE)
DOWNLOAD_URL = f"http://localhost:8000/download/{OUTPUT_FILE}"
BACKEND_ROOT = "http://localhost:8000/"

def generate_ifc():
    """
    Generate a minimal IFC with one column and one door and save it to outputs.
    """
    print("=== Step 1: Generating IFC locally ===")
    gen = IfcGenerator("TestProject")
    gen.create_column(0, 0, 0.5, 0.5, 3.0)
    gen.create_generic_element(2, 2, 1.0, 1.0, 2.0, 0, ifc_class="IfcDoor", name="TestDoor")
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    gen.save(OUTPUT_PATH)
    print(f"Saved IFC to: {OUTPUT_PATH}")

def verify_entities():
    """
    Read the IFC file and check for expected entities (sanity check).
    """
    print("=== Step 2: Verifying IFC contents ===")
    if not os.path.exists(OUTPUT_PATH):
        print("Error: IFC file not found. Did generation fail?")
        return False
    with open(OUTPUT_PATH, "r") as f:
        content = f.read()
    size = len(content)
    print(f"File size: {size} bytes")
    entities = ["IFCCOLUMN", "IFCDOOR", "IFCSITE", "IFCBUILDING", "IFCBUILDINGSTOREY", "IFCRECTANGLEPROFILEDEF"]
    ok = True
    for ent in entities:
        count = content.count(ent)
        print(f"Found {ent}: {count}")
        if count == 0 and ent in ["IFCSITE", "IFCBUILDING", "IFCBUILDINGSTOREY"]:
            ok = False
    return ok

def check_backend():
    """
    Confirm backend is reachable and file can be fetched by the frontend.
    """
    print("=== Step 3: Checking backend availability ===")
    try:
        r = requests.get(BACKEND_ROOT, timeout=5)
        print(f"Backend root status: {r.status_code}")
    except Exception as e:
        print(f"Warning: Backend root not reachable: {e}")
        return False

    print("=== Step 4: Attempting HTTP GET for generated IFC ===")
    try:
        r = requests.get(DOWNLOAD_URL, timeout=10, stream=True)
        ct = r.headers.get("content-type")
        cl = r.headers.get("content-length")
        print(f"GET {DOWNLOAD_URL} -> {r.status_code}, content-type={ct}, content-length={cl}")
        if r.ok:
            # Peek first bytes to ensure file is non-empty
            chunk = next(r.iter_content(chunk_size=256), b"")
            if chunk:
                print("Download check: received initial data chunk")
            else:
                print("Warning: No data chunk received (file may be empty?)")
        else:
            print("Error: Backend did not return OK for the IFC download")
            return False
    except Exception as e:
        print(f"Error: HTTP GET failed: {e}")
        return False
    return True

def next_steps():
    """
    Print concise next steps to debug the frontend viewer.
    """
    print("=== Step 5: Next steps for rendering ===")
    print(f"- Open the frontend (npm run dev) at http://localhost:5173")
    print(f"- The viewer should load: {DOWNLOAD_URL}")
    print("- In browser console you should see:")
    print("  [IFC Viewer] WASM dir: https://unpkg.com/web-ifc@0.0.53/")
    print("  [IFC Viewer] Attempting to load: http://localhost:8000/download/test_output.ifc")
    print("- If you see LinkError, the viewer will auto-fallback to CDN and retry once.")
    print("- If error persists, capture the exact console logs and the top-left debug tag.")

def run_all():
    generate_ifc()
    ok_entities = verify_entities()
    ok_backend = check_backend()
    if ok_entities and ok_backend:
        print("=== Summary: IFC is valid locally and downloadable from backend ===")
    else:
        print("=== Summary: Issues detected. See messages above. ===")
    next_steps()

if __name__ == "__main__":
    run_all()
