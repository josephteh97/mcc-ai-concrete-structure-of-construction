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

    // USE JSDELIVR - Much more reliable for WASM content-types than unpkg
    // Hard-locked to 0.0.47 to match package.json
    const wasmUrl = 'https://cdn.jsdelivr.net/npm/web-ifc@0.0.47/';
    console.log(`[IFC Engine] Booting with JSDelivr: ${wasmUrl}`);

    const loader = new IFCLoader();
    loader.ifcManager.setWasmPath(wasmUrl);
    loader.ifcManager.useWebWorkers(false); // Forced stable single-thread

    onLoadStart();
    setPhase('INIT');

    if (modelRef.current) {
      scene.remove(modelRef.current);
      modelRef.current = null;
    }

    const abortController = new AbortController();
    const timeout = setTimeout(() => {
      setPhase('HANG_DETECTED');
      console.warn('[IFC Engine] Parsing is taking too long. Check console for WASM errors.');
    }, 15000);

    (async () => {
      try {
        setPhase('FETCHING');
        const model = await loader.loadAsync(url, (xhr) => {
          if (xhr.lengthComputable) {
            const pct = Math.floor((xhr.loaded / xhr.total) * 100);
            onProgress(pct);
            if (pct === 100) setPhase('PARSING_GEOMETRY');
          }
        });

        clearTimeout(timeout);

        if (model) {
          console.log('[IFC Engine] SUCCESS: Model added to scene');
          setPhase('FINALIZING');
          
          modelRef.current = model;
          scene.add(model);

          // Advanced Auto-Focus
          const box = new THREE.Box3().setFromObject(model);
          const center = new THREE.Vector3();
          box.getCenter(center);
          const size = new THREE.Vector3();
          box.getSize(size);
          
          const maxDim = Math.max(size.x, size.y, size.z) || 10;
          const dist = maxDim * 3;
          
          camera.position.set(center.x + dist, center.y + dist, center.z + dist);
          camera.lookAt(center);
          camera.updateProjectionMatrix();

          onProgress(100);
          setPhase('READY');
          onLoadComplete();
        }
      } catch (err) {
        clearTimeout(timeout);
        console.error('[IFC Engine] CRITICAL:', err);
        setPhase('CRASHED');
        
        let msg = err.message || 'Engine Crash';
        if (msg.includes('LinkError') || msg.includes('import object')) {
          msg = "WASM BINARY MISMATCH (LinkError). Please HARD REFRESH (Ctrl+F5).";
        }
        onError(msg);
      }
    })();

    return () => {
      clearTimeout(timeout);
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
    <div className="w-full h-full bg-[#050505] relative overflow-hidden">
      {/* PROFESSIONAL DIAGNOSTIC HUD */}
      <div className="absolute top-6 left-6 z-30 font-mono text-[10px] space-y-2 pointer-events-none">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${loadingStatus === 'loading' ? 'bg-blue-500 animate-pulse shadow-[0_0_15px_#3b82f6]' : 'bg-green-500 shadow-[0_0_15px_#22c55e]'}`}></div>
          <span className="text-white font-black tracking-widest uppercase">IFC_ENGINE_v1.7</span>
        </div>
        <div className="flex gap-6">
          <div className="text-blue-500/40">STATE: <span className="text-blue-400 font-bold">{phase}</span></div>
          <div className="text-blue-500/40">BUFFER: <span className="text-blue-400 font-bold">{progressPct}%</span></div>
        </div>
      </div>

      {loadingStatus === 'loading' && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/80 backdrop-blur-xl">
          <div className="relative w-32 h-32">
            {/* Pulsing Core */}
            <div className="absolute inset-0 bg-blue-600/30 rounded-full animate-ping"></div>
            <div className="absolute inset-4 bg-blue-500/20 rounded-full animate-pulse blur-md"></div>
            
            {/* Main Spinner */}
            <svg className="w-full h-full rotate-[-90deg]">
              <circle
                cx="64" cy="64" r="60"
                stroke="currentColor" strokeWidth="4" fill="transparent"
                className="text-blue-900/30"
              />
              <circle
                cx="64" cy="64" r="60"
                stroke="currentColor" strokeWidth="4" fill="transparent"
                strokeDasharray={377}
                strokeDashoffset={377 - (377 * progressPct) / 100}
                className="text-blue-500 transition-all duration-500 ease-out"
              />
            </svg>
            
            <div className="absolute inset-0 flex items-center justify-center text-white font-black text-2xl tracking-tighter">
              {progressPct}%
            </div>
          </div>
          <div className="mt-12 text-center space-y-2">
            <div className="text-blue-400 font-mono tracking-[0.6em] text-[10px] uppercase animate-pulse">{phase}</div>
            <div className="text-white/20 font-mono text-[8px] uppercase">Processing_Geometric_Vertices</div>
          </div>
        </div>
      )}

      {loadingStatus === 'error' && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-red-950/40 backdrop-blur-2xl">
          <div className="bg-black border-t-4 border-red-600 p-12 shadow-[0_30px_100px_rgba(0,0,0,1)] max-w-md w-full">
            <h2 className="text-red-600 font-black text-3xl mb-2 tracking-tighter uppercase italic">Engine_Failure</h2>
            <div className="h-1 w-20 bg-red-600 mb-6"></div>
            <div className="bg-red-600/5 p-6 font-mono text-[11px] text-red-400 border border-red-600/20 mb-10 uppercase leading-relaxed">
              {errorMessage}
            </div>
            <button 
              onClick={() => window.location.reload()} 
              className="w-full py-5 bg-red-600 hover:bg-red-700 text-white font-black text-xs tracking-[0.3em] transition-all active:scale-95"
            >
              RESTART_HARDWARE_INSTANCE
            </button>
          </div>
        </div>
      )}

      <Canvas shadows camera={{ position: [50, 50, 50], fov: 45 }}>
        <color attach="background" args={['#050505']} />
        
        <ambientLight intensity={1.2} />
        <pointLight position={[100, 100, 100]} intensity={2} />
        <spotLight position={[-100, 200, 100]} angle={0.3} intensity={4} penumbra={1} castShadow />
        
        {/* MAXIMUM VISIBILITY AESTHETIC GRID */}
        <Grid 
          infiniteGrid 
          fadeDistance={600} // VISIBLE TO THE HORIZON
          fadeStrength={0.5}   // ALMOST NO FADE AT BACK
          cellSize={1} 
          sectionSize={10} 
          sectionThickness={3}
          sectionColor="#3b82f6" // Electric Blue
          cellColor="#1e3a8a"    // Deep Navy
          cellThickness={1.5}
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
        
        <OrbitControls makeDefault minDistance={1} maxDistance={2000} />
        <Environment preset="city" />
      </Canvas>
    </div>
  );
};

export default Viewer3D;
