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

    // Version 0.0.44 is widely considered the most stable 'LinkError-free' version
    const wasmUrl = 'https://unpkg.com/web-ifc@0.0.44/';
    console.log(`[IFC Viewer] Loading with STABLE WASM: ${wasmUrl}`);

    const loader = new IFCLoader();
    loader.ifcManager.setWasmPath(wasmUrl);
    loader.ifcManager.useWebWorkers(false);

    onLoadStart();
    setPhase('INITIALIZING');

    if (modelRef.current) {
      scene.remove(modelRef.current);
      modelRef.current = null;
    }

    loader.load(
      url,
      (ifcModel) => {
        setPhase('SUCCESS');
        onProgress(100);
        
        modelRef.current = ifcModel;
        scene.add(ifcModel);

        const box = new THREE.Box3().setFromObject(ifcModel);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const distance = maxDim * 2.5 || 25;

        camera.position.set(center.x + distance, center.y + distance, center.z + distance);
        camera.lookAt(center);
        camera.updateProjectionMatrix();

        onLoadComplete();
      },
      (xhr) => {
        if (xhr.lengthComputable) {
          const percent = Math.floor((xhr.loaded / xhr.total) * 100);
          onProgress(percent);
          if (percent > 0) setPhase('FETCHING');
        }
      },
      (error) => {
        console.error('[IFC Viewer] Error:', error);
        setPhase('ERROR');
        // Explicitly catch the LinkError/import object error
        if (error.message && (error.message.includes('LinkError') || error.message.includes('import object'))) {
          onError("WASM Engine Mismatch (LinkError). Please refresh or try another file.");
        } else {
          onError(error.message || 'Error loading IFC model');
        }
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
    <div className="w-full h-full bg-[#111115] relative overflow-hidden">
      {/* HUD */}
      <div className="absolute top-4 left-4 z-30 font-mono text-[10px] text-blue-400/60 pointer-events-none">
        ENGINE: WEB-IFC-STABLE | PHASE: {phase}
      </div>

      {loadingStatus === 'loading' && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40">
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <div className="text-white text-xs font-bold">{progressPct}%</div>
          </div>
        </div>
      )}

      {loadingStatus === 'error' && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/80 p-6 text-center">
          <div className="max-w-xs">
            <p className="text-red-500 font-bold mb-2">ENGINE_CRITICAL_FAILURE</p>
            <p className="text-gray-400 text-[10px] mb-4 font-mono">{errorMessage}</p>
            <button 
              onClick={() => window.location.reload()} 
              className="px-4 py-2 bg-blue-600 text-white text-[10px] font-bold rounded hover:bg-blue-700"
            >
              REBOOT SYSTEM
            </button>
          </div>
        </div>
      )}

      <Canvas camera={{ position: [30, 30, 30], fov: 45 }}>
        <color attach="background" args={['#111115']} />
        
        <ambientLight intensity={0.8} />
        <pointLight position={[20, 20, 20]} intensity={1.5} />
        <directionalLight position={[-20, 20, -20]} intensity={0.5} />
        
        {/* Aesthetic High-Visibility Grid */}
        <Grid 
          infiniteGrid 
          fadeDistance={300} // Increased significantly to see the back
          fadeStrength={1}    // Reduced fade to keep it bright
          cellSize={1} 
          sectionSize={5} 
          sectionThickness={2}
          sectionColor="#4f46e5" // Bright Indigo
          cellColor="#312e81"    // Dark Indigo
          cellThickness={1}
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
