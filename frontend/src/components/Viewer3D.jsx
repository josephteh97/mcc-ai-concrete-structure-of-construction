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

    // THE DEFINITIVE FIX FOR 'JA' LINKERROR:
    // web-ifc-three@0.0.126 depends on web-ifc@^0.0.39.
    // Version 0.0.36 is the "Golden Version" that works with the 0.0.39 glue code 
    // and avoids the 'JA' minification error.
    const wasmUrl = 'https://cdn.jsdelivr.net/npm/web-ifc@0.0.36/';
    console.log(`[IFC Engine] v2.5 - FORCING STABLE_36: ${wasmUrl}`);

    const loader = new IFCLoader();
    loader.ifcManager.setWasmPath(wasmUrl);
    loader.ifcManager.useWebWorkers(false);

    onLoadStart();
    setPhase('INIT_STABLE_ENGINE');

    if (modelRef.current) {
      scene.remove(modelRef.current);
      modelRef.current = null;
    }

    loader.load(
      url,
      (ifcModel) => {
        console.log('[IFC Engine] SUCCESS: Model Loaded');
        setPhase('SUCCESS');
        onProgress(100);
        
        // Force bright visibility
        ifcModel.material.forEach(mat => {
          mat.side = THREE.DoubleSide;
          mat.transparent = false;
          mat.opacity = 1;
          mat.color.setHex(0xffffff); 
        });
        
        modelRef.current = ifcModel;
        scene.add(ifcModel);

        const box = new THREE.Box3().setFromObject(ifcModel);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const distance = maxDim * 3 || 60;

        camera.position.set(center.x + distance, center.y + distance, center.z + distance);
        camera.lookAt(center);
        camera.updateProjectionMatrix();

        onLoadComplete();
      },
      (xhr) => {
        if (xhr.lengthComputable) {
          const percent = Math.floor((xhr.loaded / xhr.total) * 100);
          onProgress(percent);
          if (percent === 100) setPhase('BUILDING_MESH');
          else setPhase('LOADING');
        }
      },
      (err) => {
        console.error('[IFC Engine] Error:', err);
        setPhase('ERROR');
        onError(err.message || 'Engine Crash');
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
    <div className="w-full h-full bg-black relative overflow-hidden">
      {/* HUD Overlay */}
      <div className="absolute top-4 left-4 z-30 font-mono text-[10px] space-y-1 pointer-events-none">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${loadingStatus === 'loading' ? 'bg-white animate-pulse' : 'bg-green-500 shadow-[0_0_10px_#22c55e]'}`}></div>
          <span className="text-white font-bold tracking-widest uppercase">IFC_ENGINE_CORE_V2.5</span>
        </div>
        <div className="text-white/40 uppercase">Phase: <span className="text-white font-bold">{phase}</span></div>
        <div className="text-white/40 uppercase">Load: <span className="text-white font-bold">{progressPct}%</span></div>
      </div>

      {loadingStatus === 'loading' && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/95">
          <div className="relative w-24 h-24">
            <div className="absolute inset-0 border border-white/10 rounded-full animate-ping"></div>
            <div className="w-full h-full border-2 border-white/20 rounded-full flex items-center justify-center">
              <div className="w-12 h-12 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            </div>
          </div>
          <div className="mt-8 text-white font-mono tracking-[1em] animate-pulse text-[9px] uppercase font-bold">{phase}</div>
        </div>
      )}

      {loadingStatus === 'error' && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black p-12 text-center">
          <div className="max-w-md w-full border border-red-500 p-8">
            <h2 className="text-red-500 font-black text-2xl mb-4 tracking-widest uppercase italic">Engine_Failure</h2>
            <div className="bg-red-500/10 p-4 font-mono text-[10px] text-red-500 border border-red-500/20 mb-8 uppercase leading-relaxed font-bold">
              {errorMessage}
            </div>
            <button 
              onClick={() => window.location.reload()} 
              className="w-full py-4 bg-red-600 hover:bg-red-700 text-white font-black text-xs tracking-widest transition-all"
            >
              RESTART_SYSTEM
            </button>
          </div>
        </div>
      )}

      <Canvas camera={{ position: [60, 60, 60], fov: 45 }}>
        <color attach="background" args={['#000000']} />
        
        <ambientLight intensity={2} />
        <pointLight position={[100, 100, 100]} intensity={3} />
        <directionalLight position={[-100, 100, -100]} intensity={2} />
        
        {/* THE BRIGHTEST GRID POSSIBLE - WHITE ON BLACK */}
        <Grid 
          infiniteGrid 
          fadeDistance={10000} // VISIBLE TO THE EDGE OF THE UNIVERSE
          fadeStrength={0}     // NO FADE
          cellSize={1} 
          sectionSize={10} 
          sectionThickness={3}
          sectionColor="#ffffff" // PURE WHITE
          cellColor="#222222"    // DARK GRAY
          cellThickness={1.5}
        />
        
        {/* Helper Cube */}
        <mesh position={[0, 0.5, 0]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="#ffffff" wireframe />
        </mesh>
        
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
        
        <OrbitControls makeDefault minDistance={1} maxDistance={50000} />
        <Environment preset="city" />
      </Canvas>
    </div>
  );
};

export default Viewer3D;
