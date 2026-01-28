import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Environment, Grid } from '@react-three/drei';
import { IFCLoader } from 'web-ifc-three/IFCLoader';

const IFCModel = ({ url }) => {
  const { scene, camera } = useThree();
  const ifcLoader = useRef(new IFCLoader());
  const modelRef = useRef(null);

  useEffect(() => {
    if (!url) return;

    // Cleanup previous model
    if (modelRef.current) {
      scene.remove(modelRef.current);
      modelRef.current = null;
    }

    // Setup IFC Loader
    ifcLoader.current.ifcManager.setWasmPath('https://unpkg.com/web-ifc@0.0.53/');

    ifcLoader.current.load(
      url,
      (ifcModel) => {
        modelRef.current = ifcModel;
        scene.add(ifcModel);
        
        // Auto-focus camera on the model
        const box = new THREE.Box3().setFromObject(ifcModel);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        
        const maxDim = Math.max(size.x, size.y, size.z);
        const fov = camera.fov * (Math.PI / 180);
        let cameraZ = Math.abs(maxDim / 4 * Math.tan(fov * 2));
        cameraZ *= 3; // zoom out a little

        camera.position.set(center.x + cameraZ, center.y + cameraZ, center.z + cameraZ);
        camera.lookAt(center);
        camera.updateProjectionMatrix();
      },
      (progress) => {
        console.log('Loading:', progress);
      },
      (error) => {
        console.error('Error loading IFC:', error);
      }
    );

    return () => {
      if (modelRef.current) {
        scene.remove(modelRef.current);
      }
    };
  }, [url, scene, camera]);

  return null;
};

const Viewer3D = ({ ifcUrl }) => {
  return (
    <div className="w-full h-full bg-gray-900">
      <Canvas camera={{ position: [10, 10, 10], fov: 50 }}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={1} />
        <Grid infiniteGrid />
        
        {ifcUrl && <IFCModel url={ifcUrl} />}
        
        <OrbitControls makeDefault />
        <Environment preset="city" />
      </Canvas>
    </div>
  );
};

export default Viewer3D;
