import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Environment, Grid, Html, Loader } from '@react-three/drei';
import { IFCLoader } from 'web-ifc-three/IFCLoader';

const IFCModel = ({ url, onLoadStart, onLoadComplete, onError, onProgress, setPhase }) => {
  const { scene, camera } = useThree();
  const ifcLoader = useRef(null);
  const modelRef = useRef(null);
  const finalized = useRef(false);
  const [retryCount, setRetryCount] = useState(0);

  // WASM Versions to try in order
  const wasmVersions = [
    'https://unpkg.com/web-ifc@0.0.47/', // Matches package.json
    'https://unpkg.com/web-ifc@0.0.44/', // Stable fallback
    'https://unpkg.com/web-ifc@0.0.36/', // Legacy stable
  ];

  useEffect(() => {
    if (!url) return;

    const currentWasm = wasmVersions[retryCount % wasmVersions.length];
    console.log(`[IFC Viewer] Initializing loader with WASM: ${currentWasm}`);

    // Re-initialize loader on retry to clear internal WASM state
    ifcLoader.current = new IFCLoader();
    ifcLoader.current.ifcManager.setWasmPath(currentWasm);
    ifcLoader.current.ifcManager.useWebWorkers(false);

    onLoadStart();
    setPhase('LOADING');

    if (modelRef.current) {
      scene.remove(modelRef.current);
      modelRef.current = null;
    }

    const loadModel = async () => {
      try {
        const ifcModel = await ifcLoader.current.loadAsync(
          url,
          (xhr) => {
            if (xhr.lengthComputable) {
              const percent = Math.floor((xhr.loaded / xhr.total) * 100);
              onProgress(percent);
            }
          }
        );

        if (ifcModel) {
          finalized.current = true;
          modelRef.current = ifcModel;
          scene.add(ifcModel);

          const box = new THREE.Box3().setFromObject(ifcModel);
          const center = box.getCenter(new THREE.Vector3());
          const size = box.getSize(new THREE.Vector3());
          const maxDim = Math.max(size.x, size.y, size.z);
          const distance = maxDim * 2 || 15;
          
          camera.position.set(center.x + distance, center.y + distance, center.z + distance);
          camera.lookAt(center);
          camera.updateProjectionMatrix();

          onProgress(100);
          onLoadComplete();
          setPhase('SUCCESS');
        }
      } catch (error) {
        console.error('[IFC Viewer] Error:', error);
        
        // If it's a LinkError or version mismatch, try next WASM version
        if (String(error).includes('LinkError') || String(error).includes('import object')) {
          if (retryCount < wasmVersions.length - 1) {
            console.warn(`[IFC Viewer] WASM LinkError. Retrying with different version... (${retryCount + 1})`);
            setPhase(`RETRYING_WASM_${retryCount + 1}`);
            setRetryCount(prev => prev + 1);
            return;
          }
        }
        
        setPhase('ERROR');
        onError(error.message || 'Failed to load 3D model');
      }
    };

    loadModel();

    return () => {
      if (modelRef.current) scene.remove(modelRef.current);
      finalized.current = false;
    };
  }, [url, retryCount]); // Only re-run if URL or retryCount changes

  return null;
};

const Viewer3D = ({ ifcUrl }) => {
  const [loadingStatus, setLoadingStatus] = useState('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [phase, setPhase] = useState('IDLE');
  const [progressPct, setProgressPct] = useState(0);
  const [fileSize, setFileSize] = useState(null);

  useEffect(() => {
    if (!ifcUrl) {
      setLoadingStatus('idle');
      return;
    }
    
    // Only fetch HEAD for non-blob URLs
    if (ifcUrl.startsWith('http')) {
      fetch(ifcUrl, { method: 'HEAD' })
        .then(res => {
          const size = res.headers.get('content-length');
          if (size) setFileSize((parseInt(size) / 1024).toFixed(1) + ' KB');
        })
        .catch(() => {});
    } else {
      setFileSize('Local Blob');
    }
  }, [ifcUrl]);

  return (
    <div className="w-full h-full bg-[#0a0a0f] relative overflow-hidden">
      {/* HUD Style Overlay */}
      <div className="absolute top-4 left-4 z-30 font-mono text-[10px] space-y-1 pointer-events-none">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${loadingStatus === 'loading' ? 'bg-blue-500 animate-pulse' : 'bg-green-500'}`}></div>
          <span className="text-blue-400 font-bold">SYSTEM_3D_VIEWER v1.2</span>
        </div>
        <div className="text-slate-500">PHASE: <span className="text-slate-200">{phase}</span></div>
        <div className="text-slate-500">PROG: <span className="text-slate-200">{progressPct}%</span></div>
        <div className="text-slate-500">FILE: <span className="text-slate-200">{fileSize || 'Detecting...'}</span></div>
      </div>

      {loadingStatus === 'loading' && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4">
            <div className="relative w-16 h-16">
              <div className="absolute inset-0 border-4 border-blue-500/20 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
            <div className="flex flex-col items-center">
              <div className="text-blue-400 font-mono text-sm tracking-widest uppercase">{phase}...</div>
              <div className="text-white font-bold text-2xl">{progressPct}%</div>
            </div>
          </div>
        </div>
      )}

      {loadingStatus === 'error' && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-red-950/20 backdrop-blur-md p-6">
          <div className="bg-black/80 border border-red-500/50 p-8 rounded-lg max-w-md w-full flex flex-col items-center gap-6 shadow-2xl">
            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center">
              <span className="text-red-500 text-3xl">!</span>
            </div>
            <div className="text-center">
              <h3 className="text-white font-bold text-xl mb-2">Visualization Failed</h3>
              <p className="text-red-400 text-sm font-mono leading-relaxed">{errorMessage}</p>
            </div>
            <button 
              onClick={() => window.location.reload()} 
              className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-md transition-all active:scale-95"
            >
              RESET ENGINE
            </button>
          </div>
        </div>
      )}

      <Canvas shadows camera={{ position: [20, 20, 20], fov: 45 }} gl={{ antialias: true, alpha: true }}>
        <color attach="background" args={['#0a0a0f']} />
        
        <ambientLight intensity={0.8} />
        <pointLight position={[10, 10, 10]} intensity={1.5} />
        
        <Grid 
          infiniteGrid 
          fadeDistance={100} 
          fadeStrength={5} 
          cellSize={1} 
          sectionSize={5} 
          sectionColor="#334155" 
          cellColor="#1e293b" 
        />
        
        {ifcUrl && (
          <React.Suspense fallback={null}>
            <IFCModel 
              url={ifcUrl} 
              setPhase={setPhase}
              onLoadStart={() => { setLoadingStatus('loading'); setProgressPct(0); }}
              onLoadComplete={() => { setLoadingStatus('success'); setProgressPct(100); }}
              onError={(msg) => { setLoadingStatus('error'); setErrorMessage(msg); }}
              onProgress={(p) => setProgressPct(p)}
            />
          </React.Suspense>
        )}
        
        <OrbitControls makeDefault minDistance={2} maxDistance={200} />
        <Environment preset="night" />
      </Canvas>
    </div>
  );
};

export default Viewer3D;
