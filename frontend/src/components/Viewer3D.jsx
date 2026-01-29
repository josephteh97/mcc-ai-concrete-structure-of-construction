import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Environment, Grid, Html, Loader } from '@react-three/drei';
import { IFCLoader } from 'web-ifc-three/IFCLoader';

const IFCModel = ({ url, onLoadStart, onLoadComplete, onError, onProgress, setPhase }) => {
  const { scene, camera } = useThree();
  const modelRef = useRef(null);

  useEffect(() => {
    if (!url) return;

    const loader = new IFCLoader();
    // Use a single, most compatible version. 0.0.36 is very widely compatible.
    loader.ifcManager.setWasmPath('https://unpkg.com/web-ifc@0.0.36/');
    loader.ifcManager.useWebWorkers(false);

    onLoadStart();
    setPhase('LOADING');

    if (modelRef.current) {
      scene.remove(modelRef.current);
      modelRef.current = null;
    }

    loader.load(
      url,
      (ifcModel) => {
        console.log('[IFC Viewer] Model loaded');
        setPhase('RENDERING');
        onProgress(100);
        
        modelRef.current = ifcModel;
        scene.add(ifcModel);

        // Zoom to fit
        const box = new THREE.Box3().setFromObject(ifcModel);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const distance = maxDim * 2.2 || 20;

        camera.position.set(center.x + distance, center.y + distance, center.z + distance);
        camera.lookAt(center);
        camera.updateProjectionMatrix();

        onLoadComplete();
        setPhase('SUCCESS');
      },
      (xhr) => {
        if (xhr.lengthComputable) {
          const percent = Math.floor((xhr.loaded / xhr.total) * 100);
          onProgress(percent);
        }
      },
      (error) => {
        console.error('[IFC Viewer] Load error:', error);
        setPhase('ERROR');
        onError(error.message || 'Error loading IFC model');
      }
    );

    return () => {
      if (modelRef.current) scene.remove(modelRef.current);
    };
  }, [url]);

  return null;
};

const Viewer3D = ({ ifcUrl }) => {
  const [loadingStatus, setLoadingStatus] = useState('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [phase, setPhase] = useState('IDLE');
  const [progressPct, setProgressPct] = useState(0);

  return (
    <div className="w-full h-full bg-[#1e1e24] relative overflow-hidden rounded-lg shadow-inner">
      {/* Minimal HUD */}
      <div className="absolute bottom-4 right-4 z-30 font-mono text-[10px] text-white/30 pointer-events-none">
        IFC_ENGINE_V1.4 | {phase}
      </div>

      {loadingStatus === 'loading' && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-2 border-white/10 border-t-white rounded-full animate-spin"></div>
            <div className="text-white font-medium text-sm tracking-widest">{progressPct}%</div>
          </div>
        </div>
      )}

      {loadingStatus === 'error' && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-red-900/10 backdrop-blur-sm p-6">
          <div className="bg-white p-6 rounded-lg shadow-2xl max-w-sm text-center">
            <p className="text-red-600 font-bold mb-2">Visualization Error</p>
            <p className="text-gray-600 text-xs mb-4">{errorMessage}</p>
            <button 
              onClick={() => window.location.reload()} 
              className="px-4 py-2 bg-gray-900 text-white rounded text-xs font-bold hover:bg-black"
            >
              RETRY
            </button>
          </div>
        </div>
      )}

      <Canvas camera={{ position: [20, 20, 20], fov: 45 }}>
        <color attach="background" args={['#1e1e24']} />
        
        <ambientLight intensity={0.7} />
        <pointLight position={[10, 10, 10]} intensity={1} />
        <spotLight position={[-20, 50, 10]} angle={0.15} penumbra={1} intensity={1.5} />
        
        {/* Aesthetic Pro Grid */}
        <Grid 
          infiniteGrid 
          fadeDistance={100} 
          fadeStrength={5} 
          cellSize={1} 
          sectionSize={5} 
          sectionThickness={1.5}
          sectionColor="#3b82f6" 
          cellColor="#334155" 
          cellThickness={0.8}
        />
        
        {ifcUrl && (
          <IFCModel 
            url={ifcUrl} 
            setPhase={setPhase}
            onLoadStart={() => { setLoadingStatus('loading'); setProgressPct(0); }}
            onLoadComplete={() => { setLoadingStatus('success'); setProgressPct(100); }}
            onError={(msg) => { setLoadingStatus('error'); setErrorMessage(msg); }}
            onProgress={(p) => setProgressPct(p)}
          />
        )}
        
        <OrbitControls makeDefault />
        <Environment preset="city" />
      </Canvas>
    </div>
  );
};

export default Viewer3D;
