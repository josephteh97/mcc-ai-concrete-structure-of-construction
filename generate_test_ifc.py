import ifcopenshell
import ifcopenshell.api
import os

def generate_test_ifc(output_path="test_manual.ifc"):
    print(f"Generating minimal valid IFC at {output_path}...")
    
    # 1. Create a new IFC4 file
    model = ifcopenshell.api.run("project.create_file", version="IFC4")
    
    # 2. Project setup
    project = ifcopenshell.api.run("root.create_entity", model, ifc_class="IfcProject", name="Manual Test Project")
    
    # 3. Units setup
    ifcopenshell.api.run("unit.assign_unit", model, length={"is_metric": True, "raw": "METERS"})
    
    # 4. Context setup
    context = ifcopenshell.api.run("context.add_context", model, context_type="Model")
    body = ifcopenshell.api.run("context.add_context", model,
                               context_type="Model",
                               context_identifier="Body",
                               target_view="MODEL_VIEW",
                               parent=context)
    
    # 5. Spatial hierarchy
    site = ifcopenshell.api.run("root.create_entity", model, ifc_class="IfcSite", name="Test Site")
    ifcopenshell.api.run("aggregate.assign_object", model, relating_object=project, products=[site])
    
    building = ifcopenshell.api.run("root.create_entity", model, ifc_class="IfcBuilding", name="Test Building")
    ifcopenshell.api.run("aggregate.assign_object", model, relating_object=site, products=[building])
    
    storey = ifcopenshell.api.run("root.create_entity", model, ifc_class="IfcBuildingStorey", name="Test Storey")
    ifcopenshell.api.run("aggregate.assign_object", model, relating_object=building, products=[storey])
    
    # 6. Create a Column with Geometry
    column = ifcopenshell.api.run("root.create_entity", model, ifc_class="IfcColumn", name="Test Column")
    ifcopenshell.api.run("spatial.assign_container", model, relating_structure=storey, products=[column])
    
    # Profile (0.5m x 0.5m)
    profile = model.createIfcRectangleProfileDef(ProfileType="AREA", XDim=0.5, YDim=0.5)
    
    # Representation (3m high extrusion)
    representation = ifcopenshell.api.run("geometry.add_profile_representation", model, 
                                          context=body, profile=profile, depth=3.0)
    
    ifcopenshell.api.run("geometry.assign_representation", model, product=column, representation=representation)
    
    # Placement (at 0,0,0)
    matrix = [
        [1.0, 0.0, 0.0, 0.0],
        [0.0, 1.0, 0.0, 0.0],
        [0.0, 0.0, 1.0, 0.0],
        [0.0, 0.0, 0.0, 1.0]
    ]
    ifcopenshell.api.run("geometry.edit_object_placement", model, product=column, matrix=matrix)
    
    # 7. Save
    model.write(output_path)
    print(f"Success! File saved to {os.path.abspath(output_path)}")
    print("You can now upload this file directly to the 3D Viewer in the frontend.")

if __name__ == "__main__":
    generate_test_ifc()
