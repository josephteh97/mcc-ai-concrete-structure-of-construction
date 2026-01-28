import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Environment, Grid, Html, Loader } from '@react-three/drei';
import { IFCLoader } from 'web-ifc-three/IFCLoader';
import webIfcWasmUrl from 'web-ifc/web-ifc.wasm?url';

const IFCModel = ({ url, onLoadStart, onLoadComplete, onError }) => {
  const { scene, camera } = useThree();
  const ifcLoader = useRef(null);
  const modelRef = useRef(null);

  useEffect(() => {
    if (!url) return;

    // Initialize loader once
    if (!ifcLoader.current) {
      ifcLoader.current = new IFCLoader();
      const wasmUrl = webIfcWasmUrl;
      const wasmDir = wasmUrl.substring(0, wasmUrl.lastIndexOf('/') + 1);
      ifcLoader.current.ifcManager.setWasmPath(wasmDir);
      if (typeof ifcLoader.current.ifcManager.useWebWorkers === 'function') {
        ifcLoader.current.ifcManager.useWebWorkers(false);
      }
      console.log(`[IFC Viewer] WASM dir: ${wasmDir}`);
    }

    onLoadStart();

    // Cleanup previous model
    if (modelRef.current) {
      scene.remove(modelRef.current);
      modelRef.current = null;
    }

    console.log(`[IFC Viewer] Attempting to load: ${url}`);

    ifcLoader.current.load(
      url,
      (ifcModel) => {
        console.log('[IFC Viewer] Model loaded successfully from server.');
        
        // Validation: Check if model has any meshes
        let hasGeometry = false;
        ifcModel.traverse((child) => {
          if (child.isMesh) hasGeometry = true;
        });

        if (!hasGeometry) {
          console.warn('[IFC Viewer] Warning: Model loaded but no 3D geometry found. The file might be empty or invalid.');
          onError('Model loaded but contains no geometry.');
          return;
        }

        modelRef.current = ifcModel;
        scene.add(ifcModel);
        
        // Auto-focus camera on the model
        const box = new THREE.Box3().setFromObject(ifcModel);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        
        const maxDim = Math.max(size.x, size.y, size.z);
        const fov = camera.fov * (Math.PI / 180);
        let cameraZ = Math.abs(maxDim / 4 * Math.tan(fov * 2));
        cameraZ *= 3;

        camera.position.set(center.x + cameraZ, center.y + cameraZ, center.z + cameraZ);
        camera.lookAt(center);
        camera.updateProjectionMatrix();
        
        onLoadComplete();
      },
      (progress) => {
        const percent = Math.round((progress.loaded / progress.total) * 100);
        console.log(`[IFC Viewer] Loading progress: ${percent}%`);
      },
      (error) => {
        console.error('[IFC Viewer] Critical Error during loading:', error);
        onError(`Failed to fetch or parse IFC file: ${error.message || 'Unknown error'}`);
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
  const [loadingStatus, setLoadingStatus] = useState('idle'); // 'idle', 'loading', 'success', 'error'
  const [errorMessage, setErrorMessage] = useState('');

  console.log(`[Viewer3D] Current Status: ${loadingStatus}, URL: ${ifcUrl}`);

  return (
    <div className="w-full h-full bg-black relative border-4 border-blue-900">
      {/* Debug Info Overlay */}
      <div className="absolute top-2 left-2 z-30 text-[10px] text-blue-400 font-mono bg-black bg-opacity-50 p-1 pointer-events-none">
        RENDERER_V1.1 | STATUS: {loadingStatus.toUpperCase()}
      </div>

      {/* Status Overlay */}
      {loadingStatus === 'loading' && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black bg-opacity-50 text-white">
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <p>Loading 3D Model...</p>
          </div>
        </div>
      )}

      {loadingStatus === 'error' && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black bg-opacity-70 text-red-400 p-4 text-center">
          <div className="flex flex-col items-center gap-4">
            <span className="text-4xl">⚠️</span>
            <p className="font-bold">Rendering Failed</p>
            <p className="text-sm max-w-md">{errorMessage}</p>
            <button 
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
            >
              Reload Application
            </button>
          </div>
        </div>
      )}

      <Canvas camera={{ position: [10, 10, 10], fov: 50 }}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={1} />
        <Grid infiniteGrid />
        
        {ifcUrl && (
          <IFCModel 
            url={ifcUrl} 
            onLoadStart={() => {
              setLoadingStatus('loading');
              setErrorMessage('');
            }}
            onLoadComplete={() => setLoadingStatus('success')}
            onError={(msg) => {
              setLoadingStatus('error');
              setErrorMessage(msg);
            }}
          />
        )}
        
        <OrbitControls makeDefault />
        <Environment preset="city" />
      </Canvas>
    </div>
  );
};

export default Viewer3D;
