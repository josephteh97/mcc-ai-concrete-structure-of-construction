import React, { useEffect, useRef } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Environment, Grid } from '@react-three/drei';
import { IFCLoader } from 'web-ifc-three/IFCLoader';

const IFCModel = ({ url }) => {
  const { scene } = useThree();
  const ifcLoader = useRef(new IFCLoader());

  useEffect(() => {
    if (!url) return;

    // Setup IFC Loader (requires wasm path configuration in a real app)
    // For this demo, we assume the wasm files are served correctly or we just try standard load
    ifcLoader.current.ifcManager.setWasmPath('https://unpkg.com/web-ifc@0.0.53/');

    ifcLoader.current.load(
      url,
      (ifcModel) => {
        scene.add(ifcModel);
      },
      (progress) => {
        console.log('Loading:', progress);
      },
      (error) => {
        console.error('Error loading IFC:', error);
      }
    );

    return () => {
      // Cleanup if needed
    };
  }, [url, scene]);

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
