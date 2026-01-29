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

    // THE ABSOLUTE FINAL FIX FOR MAGIC NUMBER & LINK ERROR:
    // We use a specific, reliable CDN version that matches the expected WASM magic number.
    // 0.0.36 is the most stable version of web-ifc for three-ifc-loader.
    const wasmUrl = 'https://cdn.jsdelivr.net/npm/web-ifc@0.0.36/';
    console.log(`[IFC Engine] BOOTING v2.3 - STABLE_CDN: ${wasmUrl}`);

    const loader = new IFCLoader();
    loader.ifcManager.setWasmPath(wasmUrl);
    loader.ifcManager.useWebWorkers(false);

    onLoadStart();
    setPhase('INIT_ENGINE');

    if (modelRef.current) {
      scene.remove(modelRef.current);
      modelRef.current = null;
    }

    loader.load(
      url,
      (ifcModel) => {
        console.log('[IFC Engine] Model loaded successfully');
        setPhase('SUCCESS');
        onProgress(100);
        
        // Ensure visibility
        ifcModel.material.forEach(mat => {
          mat.side = THREE.DoubleSide;
          mat.transparent = false;
          mat.opacity = 1;
        });
        
        modelRef.current = ifcModel;
        scene.add(ifcModel);

        const box = new THREE.Box3().setFromObject(ifcModel);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const distance = maxDim * 3 || 50;

        camera.position.set(center.x + distance, center.y + distance, center.z + distance);
        camera.lookAt(center);
        camera.updateProjectionMatrix();

        onLoadComplete();
      },
      (xhr) => {
        if (xhr.lengthComputable) {
          const percent = Math.floor((xhr.loaded / xhr.total) * 100);
          onProgress(percent);
          if (percent === 100) setPhase('RENDERING_GEOMETRY');
          else setPhase('LOADING_DATA');
        }
      },
      (err) => {
        console.error('[IFC Engine] Error:', err);
        setPhase('ENGINE_CRASH');
        onError(err.message || 'WASM Magic Number Error');
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
    <div className="w-full h-full bg-[#020205] relative overflow-hidden">
      {/* HUD Overlay */}
      <div className="absolute top-4 left-4 z-30 font-mono text-[10px] space-y-1 pointer-events-none">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${loadingStatus === 'loading' ? 'bg-cyan-400 animate-pulse shadow-[0_0_10px_#22d3ee]' : 'bg-green-500 shadow-[0_0_10px_#22c55e]'}`}></div>
          <span className="text-white font-bold tracking-widest uppercase">IFC_ENGINE_CORE_V2.3</span>
        </div>
        <div className="text-slate-500">PHASE: <span className="text-cyan-400 font-bold">{phase}</span></div>
        <div className="text-slate-500">STATUS: <span className="text-cyan-400 font-bold">{progressPct}%</span></div>
      </div>

      {loadingStatus === 'loading' && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md">
          <div className="relative w-32 h-32">
            <div className="absolute inset-0 bg-cyan-500/20 rounded-full animate-ping"></div>
            <div className="relative w-full h-full border-4 border-cyan-500/30 rounded-full flex items-center justify-center">
              <div className="w-20 h-20 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
            </div>
            <div className="absolute inset-0 flex items-center justify-center text-white font-black text-xl">
              {progressPct}%
            </div>
          </div>
          <div className="mt-8 text-cyan-400 font-mono tracking-[0.5em] animate-pulse text-xs uppercase font-bold">{phase}</div>
        </div>
      )}

      {loadingStatus === 'error' && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-red-950/60 backdrop-blur-xl">
          <div className="bg-black border-2 border-red-600 p-10 rounded-none shadow-[0_0_80px_rgba(220,38,38,0.5)] max-w-md w-full text-center">
            <h2 className="text-red-600 font-black text-2xl mb-4 tracking-tighter italic">ENGINE_FATAL_ERROR</h2>
            <div className="bg-red-600/10 p-6 font-mono text-[11px] text-red-400 border border-red-600/30 mb-8 uppercase leading-relaxed font-bold">
              {errorMessage}
            </div>
            <button 
              onClick={() => window.location.reload()} 
              className="w-full py-5 bg-red-600 hover:bg-red-700 text-white font-black text-sm tracking-widest transition-all active:scale-95"
            >
              FORCE_ENGINE_REBOOT
            </button>
          </div>
        </div>
      )}

      <Canvas shadows camera={{ position: [50, 50, 50], fov: 45 }}>
        <color attach="background" args={['#020205']} />
        
        <ambientLight intensity={2} />
        <pointLight position={[50, 50, 50]} intensity={3} />
        <spotLight position={[-50, 100, 50]} angle={0.3} intensity={5} penumbra={1} castShadow />
        
        {/* ULTRA-BRIGHT INFINITE GRID */}
        <Grid 
          infiniteGrid 
          fadeDistance={2500} // VISIBLE FOREVER
          fadeStrength={0}    // NO FADING
          cellSize={1} 
          sectionSize={10} 
          sectionThickness={3}
          sectionColor="#00f2ff" // Electric Cyan
          cellColor="#003b44"    // Matrix Teal
          cellThickness={1.5}
        />
        
        {/* Helper Box to confirm rendering is alive */}
        <mesh position={[0, 0.5, 0]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="#00f2ff" wireframe opacity={0.3} transparent />
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
        
        <OrbitControls makeDefault minDistance={2} maxDistance={10000} />
        <Environment preset="city" />
      </Canvas>
    </div>
  );
};

export default Viewer3D;
