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

    // To fix LinkError 'ja'/'ja': We MUST match the exact version in package.json (0.0.47)
    // and we MUST ensure the path is absolute and ends with a slash.
    const wasmUrl = 'https://unpkg.com/web-ifc@0.0.47/';
    console.log(`[IFC Viewer] Loading with EXACT package version: ${wasmUrl}`);

    const loader = new IFCLoader();
    loader.ifcManager.setWasmPath(wasmUrl);
    
    // IMPORTANT: Disable web workers if hitting LinkErrors, as workers often load different versions
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
          if (percent === 100) setPhase('PARSING');
          else setPhase('FETCHING');
        }
      },
      (error) => {
        console.error('[IFC Viewer] Error:', error);
        setPhase('ERROR');
        onError(error.message || 'Engine LinkError');
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
    <div className="w-full h-full bg-[#050505] relative overflow-hidden">
      {/* High-Visibility HUD */}
      <div className="absolute top-6 left-6 z-30 font-mono text-xs space-y-2 pointer-events-none">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${loadingStatus === 'loading' ? 'bg-blue-500 animate-pulse' : 'bg-green-500 shadow-[0_0_10px_#22c55e]'}`}></div>
          <span className="text-white font-black tracking-tighter text-sm uppercase">SYSTEM_CORE_V1.6</span>
        </div>
        <div className="flex gap-4">
          <div className="text-blue-500/50">PHASE: <span className="text-blue-400">{phase}</span></div>
          <div className="text-blue-500/50">LOAD: <span className="text-blue-400">{progressPct}%</span></div>
        </div>
      </div>

      {loadingStatus === 'loading' && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md">
          <div className="relative">
            <div className="absolute inset-[-20px] bg-blue-600/20 rounded-full animate-pulse blur-xl"></div>
            <div className="w-24 h-24 border-t-4 border-blue-500 rounded-full animate-spin"></div>
            <div className="absolute inset-0 flex items-center justify-center text-white font-black text-xl">
              {progressPct}%
            </div>
          </div>
          <div className="mt-10 text-blue-400 font-mono tracking-[0.5em] animate-pulse text-sm">INITIALIZING_3D_GRID</div>
        </div>
      )}

      {loadingStatus === 'error' && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-red-950/40 backdrop-blur-xl">
          <div className="bg-black border-2 border-red-600 p-10 rounded-none shadow-[0_0_50px_rgba(220,38,38,0.3)] max-w-md w-full">
            <h2 className="text-red-600 font-black text-2xl mb-4 tracking-tighter italic">CORE_DUMP_DETECTED</h2>
            <div className="bg-red-600/10 p-4 font-mono text-[10px] text-red-400 border border-red-600/20 mb-8 uppercase leading-relaxed">
              {errorMessage}
            </div>
            <button 
              onClick={() => window.location.reload()} 
              className="w-full py-4 bg-red-600 hover:bg-red-700 text-white font-black text-sm tracking-widest transition-all"
            >
              RELOAD_SYSTEM_INSTANCE
            </button>
          </div>
        </div>
      )}

      <Canvas camera={{ position: [40, 40, 40], fov: 45 }}>
        <color attach="background" args={['#050505']} />
        
        <ambientLight intensity={1} />
        <pointLight position={[50, 50, 50]} intensity={2} />
        <spotLight position={[-50, 100, 50]} angle={0.3} intensity={3} penumbra={1} castShadow />
        
        {/* ULTRA-AESTHETIC HIGH-VISIBILITY GRID */}
        <Grid 
          infiniteGrid 
          fadeDistance={500} 
          fadeStrength={0.5}    
          cellSize={1} 
          sectionSize={5} 
          sectionThickness={2.5}
          sectionColor="#3b82f6" // Electric Blue
          cellColor="#1e3a8a"    // Deep Navy
          cellThickness={1.2}
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
        
        <OrbitControls makeDefault minDistance={5} maxDistance={1000} />
        <Environment preset="city" />
      </Canvas>
    </div>
  );
};

export default Viewer3D;
