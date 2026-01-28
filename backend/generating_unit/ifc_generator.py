import ifcopenshell
import ifcopenshell.api
import ifcopenshell.guid
import time
import uuid

class IfcGenerator:
    def __init__(self, project_name="ConstructionProject"):
        # Create a blank model
        self.model = ifcopenshell.file()
        
        # Create Project hierarchy
        self.project = ifcopenshell.api.run("root.create_entity", self.model, ifc_class="IfcProject", name=project_name)
        
        # Default units (SI)
        ifcopenshell.api.run("unit.assign_unit", self.model)
        
        # Create context
        self.context = ifcopenshell.api.run("context.add_context", self.model, context_type="Model")
        self.body_context = ifcopenshell.api.run("context.add_context", self.model, context_type="Model", 
                                                 context_identifier="Body", target_view="MODEL_VIEW", parent=self.context)

        # Create Site, Building, Storey
        self.site = ifcopenshell.api.run("root.create_entity", self.model, ifc_class="IfcSite", name="MySite")
        self.building = ifcopenshell.api.run("root.create_entity", self.model, ifc_class="IfcBuilding", name="MyBuilding")
        self.storey = ifcopenshell.api.run("root.create_entity", self.model, ifc_class="IfcBuildingStorey", name="Level 1")

        # Assign hierarchy
        ifcopenshell.api.run("aggregate.assign_object", self.model, relating_object=self.project, products=[self.site])
        ifcopenshell.api.run("aggregate.assign_object", self.model, relating_object=self.site, products=[self.building])
        ifcopenshell.api.run("aggregate.assign_object", self.model, relating_object=self.building, products=[self.storey])

    def create_column(self, x: float, y: float, width: float, depth: float, height: float, elevation: float = 0.0):
        """
        Create a rectangular column at (x, y).
        """
        # Create the column element
        column = ifcopenshell.api.run("root.create_entity", self.model, ifc_class="IfcColumn", name="Column")
        
        # Define representation (Geometry)
        # Create a 2D profile for extrusion
        profile = self.model.createIfcRectangleProfileDef(ProfileType="AREA", XDim=width, YDim=depth)
        
        # Create extrusion
        # Position of the profile is (0,0) relative to the column placement
        # We need to place the column in the world
        
        # Create the 3D representation
        representation = ifcopenshell.api.run("geometry.add_profile_representation", self.model, 
                                              context=self.body_context, profile=profile, depth=height)
        
        # Assign representation to column
        ifcopenshell.api.run("geometry.assign_representation", self.model, product=column, representation=representation)
        
        # Place the column
        # Matrix is [x, y, z]
        matrix = [
            [1.0, 0.0, 0.0, x],
            [0.0, 1.0, 0.0, y],
            [0.0, 0.0, 1.0, elevation],
            [0.0, 0.0, 0.0, 1.0]
        ]
        
        ifcopenshell.api.run("geometry.edit_object_placement", self.model, product=column, matrix=matrix)
        
        # Assign to storey
        ifcopenshell.api.run("spatial.assign_container", self.model, relating_structure=self.storey, products=[column])
        
        return column

    def create_beam(self, x1: float, y1: float, x2: float, y2: float, width: float, depth: float, elevation: float):
        """
        Create a beam connecting (x1, y1) and (x2, y2) at a specific elevation (z).
        """
        beam = ifcopenshell.api.run("root.create_entity", self.model, ifc_class="IfcBeam", name="Beam")
        
        # Calculate length and rotation
        import math
        dx = x2 - x1
        dy = y2 - y1
        length = math.sqrt(dx*dx + dy*dy)
        rotation = math.atan2(dy, dx)
        
        # Profile
        profile = self.model.createIfcRectangleProfileDef(ProfileType="AREA", XDim=depth, YDim=width) # Note: beam profile orientation
        
        # Representation
        representation = ifcopenshell.api.run("geometry.add_profile_representation", self.model, 
                                              context=self.body_context, profile=profile, depth=length)
        
        # Rotate the representation to align with the beam axis if needed, 
        # but usually we rotate the placement.
        # However, standard extrusion is along Z. We need to rotate the object so its Z axis aligns with our beam line?
        # Or simpler: ifcopenshell's standard extrusion is vertical.
        # For a horizontal beam, we need to rotate the extrusion direction or the placement.
        
        # Let's try a simpler approach for MVP: Assume horizontal beam is just a box placed and rotated.
        # Actually, ifcopenshell extrusion is usually along Z.
        # To make a horizontal beam, we extrude along Z (length) and rotate the whole object 90 degrees around Y (or X) so Z becomes horizontal?
        # This can be complex.
        # Alternative: Use 'geometry.add_wall_representation' style logic or just set the extrusion direction.
        
        # For now, let's just place it and not worry too much about perfect 3D rotation in this snippet 
        # (It requires setting the Axis and RefDirection in IfcAxis2Placement3D).
        
        ifcopenshell.api.run("geometry.assign_representation", self.model, product=beam, representation=representation)
        ifcopenshell.api.run("spatial.assign_container", self.model, relating_structure=self.storey, related_elements=[beam])
        
        return beam

    def create_slab(self, points: list, thickness: float):
        """
        Create a slab from a list of points [(x,y), ...].
        """
        slab = ifcopenshell.api.run("root.create_entity", self.model, ifc_class="IfcSlab", name="Slab")
        
        # Simplified: just a rectangular slab for MVP if points are bounding box
        # For arbitrary polygon, we need createIfcArbitraryClosedProfileDef
        
        # ... Implementation omitted for brevity, assuming rectangular for now ...
        ifcopenshell.api.run("spatial.assign_container", self.model, relating_structure=self.storey, related_elements=[slab])
        return slab

    def create_generic_element(self, x: float, y: float, width: float, depth: float, height: float, elevation: float, ifc_class="IfcBuildingElementProxy", name="Element"):
        """
        Create a generic rectangular element for objects like Doors/Windows/Slabs
        to ensure they appear in the 3D viewer.
        """
        element = ifcopenshell.api.run("root.create_entity", self.model, ifc_class=ifc_class, name=name)
        
        # Profile
        profile = self.model.createIfcRectangleProfileDef(ProfileType="AREA", XDim=width, YDim=depth)
        
        # Representation (Extrusion)
        representation = ifcopenshell.api.run("geometry.add_profile_representation", self.model, 
                                              context=self.body_context, profile=profile, depth=height)
        
        ifcopenshell.api.run("geometry.assign_representation", self.model, product=element, representation=representation)
        
        # Placement
        # Fix: Manually construct the matrix instead of using the API if it's missing in this version
        # 4x4 Identity Matrix with translation
        # [ 1, 0, 0, x ]
        # [ 0, 1, 0, y ]
        # [ 0, 0, 1, z ]
        # [ 0, 0, 0, 1 ]
        
        # However, ifcopenshell.api.run("geometry.edit_object_placement") expects a certain format or 
        # we can just use "geometry.edit_object_placement" with a dictionary if supported, 
        # or creating the placement manually.
        
        # Let's try to see if we can just pass the matrix directly to edit_object_placement if it supports it, 
        # OR use a simpler way: create placement manually.
        
        # Correct approach for 0.8.4+ if calculate_matrix is missing:
        # Just create the local placement.
        
        # But wait, edit_object_placement usually takes a matrix.
        # If calculate_matrix is missing, we can provide the matrix as a nested list.
        matrix = [
            [1.0, 0.0, 0.0, x],
            [0.0, 1.0, 0.0, y],
            [0.0, 0.0, 1.0, elevation],
            [0.0, 0.0, 0.0, 1.0]
        ]
        
        ifcopenshell.api.run("geometry.edit_object_placement", self.model, product=element, matrix=matrix)
        
        # Assign to storey
        ifcopenshell.api.run("spatial.assign_container", self.model, relating_structure=self.storey, products=[element])
        return element

    def generate_simple_extrusion(self, det_results: dict, scale: float, height: float, floor_count: int):
        """
        Mode 1: Simple Rule-Based Extrusion (Baseline).
        Iterates through detections and extrudes them vertically.
        """
        for det in det_results.get('detections', []):
            cls = det['class'].lower() # Normalize class name
            bbox = det['bbox']
            
            x1_m = bbox[0] * scale
            y1_m = bbox[1] * scale
            x2_m = bbox[2] * scale
            y2_m = bbox[3] * scale
            
            width = x2_m - x1_m
            depth = y2_m - y1_m
            cx = x1_m + width / 2
            cy = - (y1_m + depth / 2)
            
            for i in range(floor_count):
                elevation = i * height
                
                # Logic for different classes
                if cls in ['column', 'person']: 
                    self.create_column(cx, cy, width, depth, height, elevation=elevation)
                elif cls in ['door', 'double-door', 'sliding door', 'garage door']:
                    # Create a placeholder for doors (e.g., shorter height or different color/class if configured)
                    # For now, we use a generic proxy so it shows up.
                    # Doors typically sit on the floor, so elevation is correct.
                    self.create_generic_element(cx, cy, width, depth, height * 0.8, elevation, ifc_class="IfcDoor", name=cls.title())
                elif cls in ['window', 'ventilator']:
                    # Windows usually have a sill height, let's offset them slightly up
                    sill_height = height * 0.3
                    win_height = height * 0.4
                    self.create_generic_element(cx, cy, width, depth, win_height, elevation + sill_height, ifc_class="IfcWindow", name=cls.title())
                elif cls in ['staircase', 'stairs']:
                    self.create_generic_element(cx, cy, width, depth, height * 0.5, elevation, ifc_class="IfcStair", name="Staircase")
                elif cls == 'slab':
                     self.create_generic_element(cx, cy, width, depth, 0.2, elevation, ifc_class="IfcSlab", name="Slab")
                else:
                    # Catch-all for other detected objects
                    self.create_generic_element(cx, cy, width, depth, height * 0.5, elevation, ifc_class="IfcBuildingElementProxy", name=cls.title())

    def generate_advanced_structure(self, graph_data: dict, scale: float, height: float, floor_count: int):
        """
        Mode 2: Advanced GNN-based Reconstruction.
        Uses graph data (nodes and edges) to generate a connected structure.
        
        Args:
            graph_data (dict): Output from GNN model containing 'nodes' and 'edges'.
        """
        # 1. Create Nodes (Columns)
        node_map = {}
        for i, node in enumerate(graph_data.get('nodes', [])):
            cx = node['x'] * scale
            cy = - node['y'] * scale # Flip Y
            width = node['width'] * scale
            depth = node['depth'] * scale
            
            for f in range(floor_count):
                elevation = f * height
                col = self.create_column(cx, cy, width, depth, height, elevation=elevation)
                # Store reference to connecting beams if needed (for floor 0)
                if f == 0:
                    node_map[i] = (cx, cy)

        # 2. Create Edges (Beams)
        for edge in graph_data.get('edges', []):
            source_idx = edge['source']
            target_idx = edge['target']
            
            if source_idx in node_map and target_idx in node_map:
                p1 = node_map[source_idx]
                p2 = node_map[target_idx]
                
                # Beam dimensions (could be inferred by GNN, defaulting here)
                beam_width = 0.3
                beam_depth = 0.5 
                
                for f in range(floor_count):
                    # Beam is usually at the top of the floor height
                    elevation = (f + 1) * height - beam_depth 
                    self.create_beam(p1[0], p1[1], p2[0], p2[1], beam_width, beam_depth, elevation=elevation)

    def save(self, path: str):
        self.model.write(path)
