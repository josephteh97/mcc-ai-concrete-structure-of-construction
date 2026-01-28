import os
import sys
 
# Add backend to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))
 
from generating_unit.ifc_generator import IfcGenerator
 
def test_gen():
    gen = IfcGenerator("TestProject")
    # Create one column
    gen.create_column(0, 0, 0.5, 0.5, 3.0)
    # Create one generic element
    gen.create_generic_element(2, 2, 1.0, 1.0, 2.0, 0, ifc_class="IfcDoor", name="TestDoor")
    
    # Write directly to backend/outputs so frontend can fetch via /download
    output_dir = os.path.join("backend", "outputs")
    os.makedirs(output_dir, exist_ok=True)
    output_path = os.path.join(output_dir, "test_output.ifc")
    gen.save(output_path)
    print(f"Saved to {output_path}")
    
    # Read the file to check for entities
    with open(output_path, 'r') as f:
        content = f.read()
        print(f"File size: {len(content)} bytes")
        entities = ['IFCCOLUMN', 'IFCDOOR', 'IFCSITE', 'IFCBUILDING', 'IFCBUILDINGSTOREY', 'IFCRECTANGLEPROFILEDEF']
        for ent in entities:
            count = content.count(ent)
            print(f"Found {ent}: {count}")
 
if __name__ == "__main__":
    test_gen()
