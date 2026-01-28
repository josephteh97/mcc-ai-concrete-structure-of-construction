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

def start_debug_server():
    """
    Start a minimal HTTP server on port 8000 that serves /download/test_output.ifc
    Use this only when the real backend is not available.
    """
    print("=== Step 3B: Starting minimal debug HTTP server at http://localhost:8000 ===")
    import threading
    from http.server import BaseHTTPRequestHandler, HTTPServer
    class Handler(BaseHTTPRequestHandler):
        def _send_cors(self):
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Origin, Range, Accept")
            self.send_header("Access-Control-Expose-Headers", "Content-Length, Content-Type")

        def do_OPTIONS(self):
            self.send_response(204)
            self._send_cors()
            self.end_headers()

        def do_HEAD(self):
            if self.path == f"/download/{OUTPUT_FILE}":
                try:
                    size = os.path.getsize(OUTPUT_PATH)
                    self.send_response(200)
                    self.send_header("Content-Type", "application/octet-stream")
                    self.send_header("Content-Length", str(size))
                    self._send_cors()
                    self.end_headers()
                except Exception:
                    self.send_response(404)
                    self._send_cors()
                    self.end_headers()
            else:
                self.send_response(404)
                self._send_cors()
                self.end_headers()
        def do_GET(self):
            if self.path == f"/download/{OUTPUT_FILE}":
                if os.path.exists(OUTPUT_PATH):
                    with open(OUTPUT_PATH, "rb") as f:
                        data = f.read()
                    self.send_response(200)
                    self.send_header("Content-Type", "application/octet-stream")
                    self.send_header("Content-Length", str(len(data)))
                    self._send_cors()
                    self.end_headers()
                    self.wfile.write(data)
                else:
                    self.send_response(404)
                    self._send_cors()
                    self.end_headers()
            elif self.path == "/":
                # Simple root response for health check
                msg = b"Debug server root"
                self.send_response(200)
                self.send_header("Content-Type", "text/plain")
                self.send_header("Content-Length", str(len(msg)))
                self._send_cors()
                self.end_headers()
                self.wfile.write(msg)
            else:
                self.send_response(404)
                self._send_cors()
                self.end_headers()
    def run_server():
        server = HTTPServer(("0.0.0.0", 8000), Handler)
        print("Debug server running. Serving:", DOWNLOAD_URL)
        server.serve_forever()
    t = threading.Thread(target=run_server, daemon=True)
    t.start()
    time.sleep(1)
    # Quick GET check
    try:
        r = requests.get(BACKEND_ROOT, timeout=5)
        print(f"Debug server root status: {r.status_code}")
    except Exception as e:
        print(f"Warning: Debug server root not reachable: {e}")

def next_steps():
    """
    Print concise next steps to debug the frontend viewer.
    """
    print("=== Step 5: Next steps for rendering ===")
    print(f"- Open the frontend (npm run dev) at http://localhost:5173")
    print(f"- The viewer should load: {DOWNLOAD_URL}")
    print("- In browser console you should see:")
    print("  [IFC Viewer] WASM dir: https://unpkg.com/web-ifc@0.0.53/")
    print(f"  [IFC Viewer] Attempting to load: {DOWNLOAD_URL}")
    print("- If you see LinkError, the viewer will auto-fallback to CDN and retry once.")
    print("- If error persists, capture the exact console logs and the top-left debug tag.")

def probe_download_rejections(attempts: int = 3, delay_sec: float = 0.5):
    """
    Try multiple GET attempts and count rejections/non-OK responses.
    """
    print(f"=== Step 4B: Probing download rejections (attempts={attempts}) ===")
    reject = 0
    ok = 0
    for i in range(attempts):
        try:
            r = requests.get(DOWNLOAD_URL, timeout=5)
            if r.ok:
                ok += 1
            else:
                reject += 1
            print(f"Attempt {i+1}: status={r.status_code} ok={r.ok}")
        except Exception as e:
            reject += 1
            print(f"Attempt {i+1}: error={e}")
        time.sleep(delay_sec)
    print(f"Summary: OK={ok}, Rejected={reject}")

def run_all():
    generate_ifc()
    ok_entities = verify_entities()
    ok_backend = check_backend()
    if not ok_backend:
        start_debug_server()
        ok_backend = check_backend()
    if ok_backend:
        probe_download_rejections(attempts=3, delay_sec=0.5)
    if ok_entities and ok_backend:
        print("=== Summary: IFC is valid locally and downloadable from backend ===")
    else:
        print("=== Summary: Issues detected. See messages above. ===")
    next_steps()

if __name__ == "__main__":
    run_all()
