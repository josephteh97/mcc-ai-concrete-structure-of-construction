import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Environment, Grid, Html, Loader } from '@react-three/drei';
import { IFCLoader } from 'web-ifc-three/IFCLoader';

const IFCModel = ({ url, onLoadStart, onLoadComplete, onError, onRetry, onProgress, setPhase }) => {
  const { scene, camera } = useThree();
  const ifcLoader = useRef(null);
  const modelRef = useRef(null);
  const didFallback = useRef(false);
  const fallbackIndex = useRef(0);
  const fallbackList = useRef([
    'https://unpkg.com/web-ifc@0.0.47/',
    'https://unpkg.com/web-ifc@0.0.53/',
    'https://unpkg.com/web-ifc@0.0.36/',
  ]);
  const [currentWasm, setCurrentWasm] = useState('https://unpkg.com/web-ifc@0.0.47/');
  const watchdog = useRef(null);
  const finalized = useRef(false);

  useEffect(() => {
    if (!url) return;

    // Initialize loader once
    if (!ifcLoader.current) {
      ifcLoader.current = new IFCLoader();
      const wasmDir = currentWasm;
      ifcLoader.current.ifcManager.setWasmPath(wasmDir);
      if (typeof ifcLoader.current.ifcManager.useWebWorkers === 'function') {
        ifcLoader.current.ifcManager.useWebWorkers(false);
      }
      console.log(`[IFC Viewer] WASM dir: ${wasmDir}`);
    }

    onLoadStart();
    setPhase('FETCHING');

    // Cleanup previous model
    if (modelRef.current) {
      scene.remove(modelRef.current);
      modelRef.current = null;
    }

    console.log(`[IFC Viewer] Attempting to load: ${url}`);

    if (watchdog.current) {
      clearTimeout(watchdog.current);
    }
    
    // Fallback watchdog
    watchdog.current = setTimeout(async () => {
      if (!finalized.current) {
        console.warn('[IFC Viewer] Watchdog triggered - attempt direct loadAsync');
        setPhase('TIMEOUT_RETRY');
        try {
          const retry = await ifcLoader.current.loadAsync(url);
          if (retry) {
            finalized.current = true;
            modelRef.current = retry;
            scene.add(retry);
            onLoadComplete();
          }
        } catch (e) {
          onError(`Timeout fallback failed: ${e.message}`);
        }
      }
    }, 10000);

    (async () => {
      try {
        // Step 1: Fetch
        setPhase('FETCHING');
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const buf = await res.arrayBuffer();
        
        // Step 2: Parse
        setPhase('PARSING');
        onProgress(50);
        const ifcModel = await ifcLoader.current.parse(new Uint8Array(buf));
        
        // Step 3: Render
        setPhase('RENDERING');
        onProgress(90);
        
        let hasGeometry = false;
        ifcModel.traverse((child) => {
          if (child.isMesh) hasGeometry = true;
        });
        
        if (!hasGeometry) {
          onError('Parsed model has no geometry');
          return;
        }

        finalized.current = true;
        modelRef.current = ifcModel;
        scene.add(ifcModel);
        
        // Auto-center camera
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
        
        onProgress(100);
        onLoadComplete();
        setPhase('SUCCESS');
        
        if (watchdog.current) {
          clearTimeout(watchdog.current);
          watchdog.current = null;
        }
      } catch (error) {
        console.error('[IFC Viewer] Critical Error:', error);
        setPhase('ERROR');
        
        if (String(error).includes('LinkError')) {
          const nextIdx = fallbackIndex.current + 1;
          const altWasm = fallbackList.current[nextIdx];
          if (altWasm) {
            fallbackIndex.current = nextIdx;
            setCurrentWasm(altWasm);
            onRetry();
            return;
          }
        }
        onError(error.message || 'Unknown error');
      }
    })();

    return () => {
      if (modelRef.current) scene.remove(modelRef.current);
      if (watchdog.current) clearTimeout(watchdog.current);
      finalized.current = false;
    };
  }, [url, scene, camera, currentWasm]);

  return null;
};

const Viewer3D = ({ ifcUrl }) => {
  const [loadingStatus, setLoadingStatus] = useState('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [phase, setPhase] = useState('IDLE');
  const [progressPct, setProgressPct] = useState(0);
  const [netInfo, setNetInfo] = useState(null);
  const [wasmInfo, setWasmInfo] = useState(null);

  useEffect(() => {
    if (!ifcUrl) return;
    fetch(ifcUrl, { method: 'HEAD' }).then(res => {
      setNetInfo({ status: res.status, type: res.headers.get('content-type'), size: res.headers.get('content-length') });
    }).catch(() => setNetInfo({ status: 'ERR' }));
  }, [ifcUrl]);

  return (
    <div className="w-full h-full bg-black relative border-4 border-blue-900">
      {/* Granular Debug Overlay */}
      <div className="absolute top-2 left-2 z-30 text-[10px] text-blue-400 font-mono bg-black/60 p-2 rounded pointer-events-none">
        <div>3D_VIEWER_PRO | PHASE: {phase} | PROG: {progressPct}%</div>
        {netInfo && <div>FILE: {netInfo.status} | {netInfo.type} | {netInfo.size} bytes</div>}
        {ifcUrl && <div className="truncate w-64 text-blue-200">URL: {ifcUrl}</div>}
      </div>

      {loadingStatus === 'loading' && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/50 text-white">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <div className="text-lg font-bold">[{phase}] {progressPct}%</div>
            <div className="text-xs text-blue-300">Processing 3D Data...</div>
          </div>
        </div>
      )}

      {loadingStatus === 'error' && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/80 text-red-400 p-6 text-center">
          <div className="flex flex-col items-center gap-4">
            <span className="text-5xl">❌</span>
            <div className="text-xl font-bold">Rendering Error</div>
            <div className="text-sm bg-red-900/20 p-3 rounded border border-red-900/50 max-w-md">{errorMessage}</div>
            <button onClick={() => window.location.reload()} className="px-6 py-2 bg-red-600 text-white rounded hover:bg-red-700">Retry App</button>
          </div>
        </div>
      )}

      <Canvas camera={{ position: [15, 15, 15], fov: 45 }}>
        <ambientLight intensity={0.7} />
        <directionalLight position={[10, 20, 10]} intensity={1.2} />
        <Grid infiniteGrid />
        
        {ifcUrl && (
          <IFCModel 
            url={ifcUrl} 
            setPhase={setPhase}
            onLoadStart={() => { setLoadingStatus('loading'); setProgressPct(0); }}
            onLoadComplete={() => { setLoadingStatus('success'); setProgressPct(100); }}
            onError={(msg) => { setLoadingStatus('error'); setErrorMessage(msg); }}
            onRetry={() => setProgressPct(0)}
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
