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

    // LOCAL FIX: Point to the public folder. This eliminates CDN version mismatches.
    const wasmUrl = window.location.origin + '/'; 
    console.log(`[IFC Engine] v1.9 - Using LOCAL_WASM from: ${wasmUrl}`);

    const loader = new IFCLoader();
    loader.ifcManager.setWasmPath(wasmUrl);
    loader.ifcManager.useWebWorkers(false);

    onLoadStart();
    setPhase('INITIALIZING_LOCAL_ENGINE');

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
        const distance = maxDim * 3 || 30;

        camera.position.set(center.x + distance, center.y + distance, center.z + distance);
        camera.lookAt(center);
        camera.updateProjectionMatrix();

        onLoadComplete();
      },
      (xhr) => {
        if (xhr.lengthComputable) {
          const percent = Math.floor((xhr.loaded / xhr.total) * 100);
          onProgress(percent);
          if (percent === 100) setPhase('BUILDING_SCENE');
          else setPhase('DOWNLOADING');
        }
      },
      (err) => {
        console.error('[IFC Engine] Error:', err);
        setPhase('ENGINE_CRASH');
        onError(err.message || 'WASM Load Error');
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
    <div className="w-full h-full bg-[#08080a] relative overflow-hidden rounded-md border border-slate-800">
      {/* PROFESSIONAL DIAGNOSTIC HUD */}
      <div className="absolute top-4 left-4 z-30 font-mono text-[9px] text-blue-400/80 space-y-1 pointer-events-none">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${loadingStatus === 'loading' ? 'bg-blue-500 animate-pulse' : 'bg-green-500 shadow-[0_0_8px_#22c55e]'}`}></div>
          <span className="font-bold tracking-widest">3D_ENGINE_CORE_V1.8</span>
        </div>
        <div>PHASE: <span className="text-white">{phase}</span></div>
        <div>BUFFER: <span className="text-white">{progressPct}%</span></div>
      </div>

      {loadingStatus === 'loading' && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/70 backdrop-blur-md">
          <div className="relative w-20 h-20">
            {/* The "Flashing Blue Light" Pulse */}
            <div className="absolute inset-0 bg-blue-500/20 rounded-full animate-ping"></div>
            <div className="relative w-full h-full border-2 border-blue-500/20 rounded-full flex items-center justify-center">
              <div className="w-12 h-12 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          </div>
          <div className="mt-6 flex flex-col items-center gap-1">
            <div className="text-blue-400 font-mono text-[10px] tracking-[0.4em] uppercase animate-pulse">{phase}</div>
            <div className="text-white font-bold text-3xl">{progressPct}%</div>
          </div>
        </div>
      )}

      {loadingStatus === 'error' && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/90 p-8 text-center">
          <div className="flex flex-col items-center gap-4 max-w-sm">
            <div className="text-red-500 text-4xl animate-bounce">!</div>
            <div className="text-white font-bold tracking-tighter text-xl">SYSTEM_FAILURE_DETECTED</div>
            <div className="text-red-400/80 font-mono text-[10px] bg-red-950/20 p-4 rounded border border-red-900/50">
              {errorMessage}
            </div>
            <button 
              onClick={() => window.location.reload()} 
              className="mt-4 px-8 py-3 bg-red-600 hover:bg-red-700 text-white font-black text-xs tracking-widest uppercase transition-all"
            >
              Force Reboot
            </button>
          </div>
        </div>
      )}

      <Canvas camera={{ position: [30, 30, 30], fov: 45 }}>
        <color attach="background" args={['#08080a']} />
        
        <ambientLight intensity={1.0} />
        <pointLight position={[20, 30, 20]} intensity={1.5} />
        <directionalLight position={[-20, 40, 20]} intensity={0.8} />
        
        {/* ULTRA-AESTHETIC HIGH-VISIBILITY PRO GRID */}
        <Grid 
          infiniteGrid 
          fadeDistance={400} 
          fadeStrength={0.3}    
          cellSize={1} 
          sectionSize={5} 
          sectionThickness={2}
          sectionColor="#4f46e5" // Vivid Indigo
          cellColor="#1e1b4b"    // Deep Navy
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
        
        <OrbitControls makeDefault minDistance={2} maxDistance={1000} />
        <Environment preset="night" />
      </Canvas>
    </div>
  );
};

export default Viewer3D;
