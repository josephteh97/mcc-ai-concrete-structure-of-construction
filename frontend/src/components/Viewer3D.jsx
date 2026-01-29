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

    // Use 0.0.36 - the most robust version that usually avoids Ja/Ja LinkErrors
    const wasmUrl = 'https://unpkg.com/web-ifc@0.0.36/';
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

    // Use standard load with better phase tracking
    loader.load(
      url,
      (ifcModel) => {
        console.log('[IFC Viewer] Parse Success');
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
          if (percent === 100) {
            setPhase('PARSING');
          } else if (percent > 0) {
            setPhase('FETCHING');
          }
        } else {
          setPhase('FETCHING');
        }
      },
      (error) => {
        console.error('[IFC Viewer] Error:', error);
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
    <div className="w-full h-full bg-[#0a0a0f] relative overflow-hidden">
      {/* HUD Overlay */}
      <div className="absolute top-4 left-4 z-30 font-mono text-[10px] space-y-1 pointer-events-none">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${loadingStatus === 'loading' ? 'bg-blue-500 animate-pulse' : 'bg-green-500'}`}></div>
          <span className="text-blue-400 font-bold tracking-widest uppercase">IFC_ENGINE_CORE_v1.5</span>
        </div>
        <div className="text-slate-500">SYSTEM_PHASE: <span className="text-blue-200">{phase}</span></div>
        <div className="text-slate-500">DATA_FLOW: <span className="text-blue-200">{progressPct}%</span></div>
      </div>

      {loadingStatus === 'loading' && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="relative">
            {/* The "Flashing Blue Light" Pulse Effect */}
            <div className="absolute inset-0 w-24 h-24 bg-blue-500/20 rounded-full animate-ping"></div>
            <div className="relative w-24 h-24 flex items-center justify-center border-4 border-blue-500/30 rounded-full">
              <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          </div>
          <div className="mt-8 flex flex-col items-center gap-1">
            <div className="text-blue-400 font-mono text-sm tracking-[0.3em] uppercase animate-pulse">{phase}</div>
            <div className="text-white font-black text-4xl">{progressPct}%</div>
          </div>
        </div>
      )}

      {loadingStatus === 'error' && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-red-950/20 backdrop-blur-md p-6">
          <div className="bg-black/80 border border-red-500/50 p-8 rounded-lg max-w-md w-full flex flex-col items-center gap-6">
            <div className="text-red-500 text-5xl">⚠</div>
            <div className="text-center">
              <h3 className="text-white font-bold text-xl mb-2">CRITICAL_SYSTEM_ERROR</h3>
              <p className="text-red-400 text-sm font-mono">{errorMessage}</p>
            </div>
            <button 
              onClick={() => window.location.reload()} 
              className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-md transition-all active:scale-95"
            >
              REBOOT_ENGINE
            </button>
          </div>
        </div>
      )}

      <Canvas camera={{ position: [30, 30, 30], fov: 45 }}>
        <color attach="background" args={['#0a0a0f']} />
        
        <ambientLight intensity={0.8} />
        <pointLight position={[20, 20, 20]} intensity={1.5} />
        <spotLight position={[-20, 50, 20]} angle={0.2} intensity={2} penumbra={1} castShadow />
        
        {/* Bright, High-Aesthetic Indigo Grid */}
        <Grid 
          infiniteGrid 
          fadeDistance={250} 
          fadeStrength={1}    
          cellSize={1} 
          sectionSize={5} 
          sectionThickness={2}
          sectionColor="#4f46e5" 
          cellColor="#1e1b4b"    
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
        
        <OrbitControls makeDefault minDistance={2} maxDistance={500} />
        <Environment preset="city" />
      </Canvas>
    </div>
  );
};

export default Viewer3D;
