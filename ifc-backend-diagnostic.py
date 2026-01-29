#!/usr/bin/env python3
"""
IFC Backend Diagnostic Script
Tests IFC file generation and validity
"""

import sys
import os
import struct
from pathlib import Path

def print_header(text):
    """Print formatted header"""
    print("\n" + "=" * 60)
    print(text)
    print("=" * 60 + "\n")

def check_ifc_dependencies():
    """Check if required Python packages are installed"""
    print_header("TEST 1: Checking Python Dependencies")
    
    required_packages = [
        'ifcopenshell',
        'numpy',
        'fastapi',
        'uvicorn',
        'pydantic'
    ]
    
    missing = []
    for package in required_packages:
        try:
            __import__(package)
            print(f"✓ {package} is installed")
        except ImportError:
            print(f"✗ {package} is NOT installed")
            missing.append(package)
    
    if missing:
        print(f"\n⚠ Missing packages: {', '.join(missing)}")
        print("Install with: pip install " + " ".join(missing))
        return False
    
    # Check versions
    try:
        import ifcopenshell
        print(f"\n  IfcOpenShell version: {ifcopenshell.version}")
    except:
        print("  Could not determine IfcOpenShell version")
    
    return True

def validate_ifc_file(filepath):
    """Validate IFC file structure and content"""
    print_header(f"TEST 2: Validating IFC File: {filepath}")
    
    if not os.path.exists(filepath):
        print(f"✗ File not found: {filepath}")
        return False
    
    # Check file size
    file_size = os.path.getsize(filepath)
    print(f"File size: {file_size} bytes ({file_size / 1024:.2f} KB)")
    
    if file_size == 0:
        print("✗ File is empty")
        return False
    
    if file_size < 100:
        print("⚠ File seems too small for a valid IFC file")
    
    # Check IFC header
    try:
        with open(filepath, 'rb') as f:
            # Read first 100 bytes
            header = f.read(100)
            header_str = header.decode('utf-8', errors='ignore')
            
            print(f"\nFirst 100 characters:")
            print(header_str[:100])
            
            # Check for IFC header
            if header_str.startswith('ISO-10303-21'):
                print("\n✓ Valid IFC header found")
            else:
                print("\n✗ Invalid IFC header - should start with 'ISO-10303-21'")
                return False
            
            # Check for HEADER section
            if 'HEADER;' in header_str:
                print("✓ HEADER section found")
            else:
                print("⚠ HEADER section not found in first 100 bytes")
            
    except Exception as e:
        print(f"✗ Error reading file: {e}")
        return False
    
    # Try to parse with ifcopenshell
    try:
        import ifcopenshell
        print("\nAttempting to parse with IfcOpenShell...")
        
        ifc_file = ifcopenshell.open(filepath)
        print(f"✓ Successfully parsed IFC file")
        
        # Get schema
        schema = ifc_file.schema
        print(f"  Schema: {schema}")
        
        # Count entities
        entities = {}
        for entity_type in ['IfcProject', 'IfcSite', 'IfcBuilding', 
                           'IfcBuildingStorey', 'IfcWall', 'IfcSlab', 
                           'IfcColumn', 'IfcBeam']:
            try:
                count = len(ifc_file.by_type(entity_type))
                if count > 0:
                    entities[entity_type] = count
                    print(f"  {entity_type}: {count}")
            except:
                pass
        
        if not entities:
            print("⚠ No building elements found in IFC file")
        
        # Check for geometry
        all_products = ifc_file.by_type('IfcProduct')
        products_with_geometry = [p for p in all_products 
                                 if hasattr(p, 'Representation') 
                                 and p.Representation is not None]
        
        print(f"\n  Total products: {len(all_products)}")
        print(f"  Products with geometry: {len(products_with_geometry)}")
        
        if len(products_with_geometry) == 0:
            print("⚠ No products with geometry found")
        
        return True
        
    except Exception as e:
        print(f"✗ Error parsing IFC file: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_ifc_generation():
    """Test basic IFC file generation"""
    print_header("TEST 3: Testing IFC File Generation")
    
    try:
        import ifcopenshell
        import ifcopenshell.api
        import time
        
        print("Creating test IFC file...")
        
        # Create a minimal IFC file
        model = ifcopenshell.api.run("project.create_file")
        
        # Create project
        project = ifcopenshell.api.run("root.create_entity", model, 
                                      ifc_class="IfcProject", 
                                      name="Test Project")
        
        # Create site
        site = ifcopenshell.api.run("root.create_entity", model, 
                                   ifc_class="IfcSite", 
                                   name="Test Site")
        
        ifcopenshell.api.run("aggregate.assign_object", model,
                           relating_object=project, 
                           product=site)
        
        # Save to temp file
        test_file = "/tmp/test_diagnostic.ifc"
        model.write(test_file)
        
        print(f"✓ Generated test IFC file: {test_file}")
        
        # Validate the generated file
        if os.path.exists(test_file):
            size = os.path.getsize(test_file)
            print(f"  File size: {size} bytes")
            
            # Try to re-open it
            test_model = ifcopenshell.open(test_file)
            print("✓ Successfully re-opened generated file")
            
            return True
        else:
            print("✗ Generated file not found")
            return False
            
    except Exception as e:
        print(f"✗ Error generating IFC file: {e}")
        import traceback
        traceback.print_exc()
        return False

def check_backend_api():
    """Check if backend API is accessible"""
    print_header("TEST 4: Checking Backend API")
    
    try:
        import requests
    except ImportError:
        print("⚠ requests library not installed, skipping API check")
        return
    
    backend_urls = [
        'http://localhost:8000',
        'http://localhost:5000',
        'http://127.0.0.1:8000',
    ]
    
    for url in backend_urls:
        try:
            response = requests.get(f"{url}/docs", timeout=2)
            if response.status_code == 200:
                print(f"✓ Backend accessible at {url}")
                print(f"  Status: {response.status_code}")
                return True
        except:
            print(f"✗ Backend not accessible at {url}")
    
    print("\n⚠ Backend API is not running")
    print("Start with: uvicorn main:app --reload")

def check_file_system_structure():
    """Check if required directories and files exist"""
    print_header("TEST 5: Checking File System Structure")
    
    required_paths = [
        'backend',
        'backend/processing_unit',
        'backend/generating_unit',
        'frontend',
        'frontend/src',
        'frontend/public',
    ]
    
    for path in required_paths:
        if os.path.exists(path):
            print(f"✓ {path}")
        else:
            print(f"✗ {path} (not found)")
    
    # Check for generated IFC files
    ifc_dirs = [
        'backend/output',
        'backend/generated',
        'frontend/public',
        'uploads',
    ]
    
    print("\nLooking for IFC files...")
    ifc_files_found = []
    
    for dir_path in ifc_dirs:
        if os.path.exists(dir_path):
            for root, dirs, files in os.walk(dir_path):
                for file in files:
                    if file.endswith('.ifc'):
                        full_path = os.path.join(root, file)
                        ifc_files_found.append(full_path)
                        print(f"  Found: {full_path}")
    
    if not ifc_files_found:
        print("  No IFC files found in common directories")
    
    return ifc_files_found

def check_wasm_files():
    """Check if WASM files are present in node_modules"""
    print_header("TEST 6: Checking WASM Files in Frontend")
    
    wasm_locations = [
        'frontend/node_modules/web-ifc/web-ifc.wasm',
        'frontend/node_modules/web-ifc/dist/web-ifc.wasm',
        'frontend/node_modules/web-ifc/web-ifc-mt.wasm',
        'frontend/public/web-ifc.wasm',
        'frontend/dist/web-ifc.wasm',
    ]
    
    found = False
    for location in wasm_locations:
        if os.path.exists(location):
            size = os.path.getsize(location)
            print(f"✓ Found: {location} ({size / 1024:.2f} KB)")
            
            # Validate WASM magic number
            try:
                with open(location, 'rb') as f:
                    magic = f.read(4)
                    expected = b'\x00asm'
                    if magic == expected:
                        print(f"  ✓ Valid WASM magic number")
                    else:
                        print(f"  ✗ Invalid WASM magic number: {magic.hex()}")
                        print(f"    Expected: {expected.hex()}")
            except Exception as e:
                print(f"  ✗ Error reading WASM file: {e}")
            
            found = True
    
    if not found:
        print("✗ No WASM files found")
        print("\nPossible fixes:")
        print("1. Run: cd frontend && npm install")
        print("2. Copy WASM files to frontend/public/")
        print("3. Configure vite.config.js to copy WASM files")

def run_all_diagnostics():
    """Run all diagnostic tests"""
    print("\n" + "=" * 60)
    print("IFC BACKEND DIAGNOSTIC SUITE")
    print("=" * 60)
    
    results = {
        'dependencies': check_ifc_dependencies(),
        'generation': test_ifc_generation(),
    }
    
    # Check file system
    ifc_files = check_file_system_structure()
    
    # Validate existing IFC files
    if ifc_files:
        for ifc_file in ifc_files[:3]:  # Validate first 3 files
            results[f'validation_{ifc_file}'] = validate_ifc_file(ifc_file)
    
    check_wasm_files()
    check_backend_api()
    
    # Summary
    print_header("DIAGNOSTIC SUMMARY")
    
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    
    print(f"Tests passed: {passed}/{total}")
    
    if passed == total:
        print("\n✓ All tests passed!")
    else:
        print("\n⚠ Some tests failed. Review output above for details.")
    
    print("\nRECOMMENDATIONS:")
    print("1. Ensure all dependencies are installed")
    print("2. Validate generated IFC files using IfcOpenShell")
    print("3. Check that WASM files are properly deployed")
    print("4. Verify server MIME type configuration")
    print("5. Test IFC file loading in frontend")

if __name__ == "__main__":
    # Check if a specific IFC file was provided
    if len(sys.argv) > 1:
        ifc_file = sys.argv[1]
        validate_ifc_file(ifc_file)
    else:
        run_all_diagnostics()
