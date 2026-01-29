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
  const [wasmVersion, setWasmVersion] = useState('0.0.47');

  useEffect(() => {
    if (!url) return;

    // Cleanup previous
    if (modelRef.current) {
      scene.remove(modelRef.current);
      modelRef.current = null;
    }

    const loadModel = async () => {
      try {
        console.log(`[IFC Viewer] Initializing loader with WASM ${wasmVersion}`);
        const loader = new IFCLoader();
        loader.ifcManager.setWasmPath(`https://unpkg.com/web-ifc@${wasmVersion}/`);
        ifcLoader.current = loader;

        onLoadStart();
        setPhase('FETCHING');
        onProgress(10);

        // Load model
        const model = await loader.loadAsync(url, (xhr) => {
          if (xhr.lengthComputable) {
            const pct = Math.floor((xhr.loaded / xhr.total) * 90); // 0-90% for fetch/load
            onProgress(pct);
          }
        });

        if (model) {
          console.log('[IFC Viewer] Model loaded successfully');
          setPhase('RENDERING');
          onProgress(95);

          modelRef.current = model;
          scene.add(model);

          // Zoom to fit
          const box = new THREE.Box3().setFromObject(model);
          const center = box.getCenter(new THREE.Vector3());
          const size = box.getSize(new THREE.Vector3());
          const maxDim = Math.max(size.x, size.y, size.z);
          const fov = camera.fov * (Math.PI / 180);
          let cameraZ = Math.abs(maxDim / 2 * Math.tan(fov * 2));
          cameraZ *= 2.5; 

          camera.position.set(center.x + cameraZ, center.y + cameraZ, center.z + cameraZ);
          camera.lookAt(center);
          camera.updateProjectionMatrix();

          onProgress(100);
          setPhase('SUCCESS');
          onLoadComplete();
          finalized.current = true;
        }
      } catch (error) {
        console.error('[IFC Viewer] Error details:', error);
        
        // Handle version mismatch (LinkError)
        if (String(error).includes('LinkError') || String(error).includes('import object')) {
          if (wasmVersion === '0.0.47') {
            console.warn('[IFC Viewer] Version mismatch detected. Falling back to 0.0.36...');
            setWasmVersion('0.0.36');
            return;
          }
        }
        
        setPhase('ERROR');
        onError(error.message || 'Failed to initialize 3D engine');
      }
    };

    loadModel();

    return () => {
      if (modelRef.current) scene.remove(modelRef.current);
      finalized.current = false;
    };
  }, [url, wasmVersion]);

  return null;
};

const Viewer3D = ({ ifcUrl }) => {
  const [loadingStatus, setLoadingStatus] = useState('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [phase, setPhase] = useState('IDLE');
  const [progressPct, setProgressPct] = useState(0);

  return (
    <div className="w-full h-full bg-[#111] relative overflow-hidden">
      {/* Simple Debug Text */}
      <div className="absolute top-2 left-2 z-30 text-[9px] text-blue-400 font-mono pointer-events-none opacity-50">
        3D_VIEWER_V1.3 | PHASE: {phase} | PROG: {progressPct}%
      </div>

      {loadingStatus === 'loading' && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black bg-opacity-40">
          <div className="flex flex-col items-center gap-3 bg-black bg-opacity-80 p-6 rounded-xl border border-blue-900/50">
            <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <div className="text-white font-bold tracking-tight">Loading 3D Structure...</div>
            <div className="text-blue-400 font-mono text-xs">{progressPct}% Complete</div>
          </div>
        </div>
      )}

      {loadingStatus === 'error' && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black bg-opacity-70 p-6">
          <div className="bg-red-900 bg-opacity-20 border border-red-500 p-6 rounded-lg max-w-sm text-center">
            <p className="text-red-400 font-bold mb-4">Rendering Error</p>
            <p className="text-white text-xs mb-6 opacity-80">{errorMessage}</p>
            <button 
              onClick={() => window.location.reload()} 
              className="px-4 py-2 bg-red-600 text-white rounded text-sm hover:bg-red-700 transition-colors"
            >
              Reset Engine
            </button>
          </div>
        </div>
      )}

      <Canvas camera={{ position: [15, 15, 15], fov: 50 }}>
        <color attach="background" args={['#111']} />
        <ambientLight intensity={0.6} />
        <pointLight position={[10, 10, 10]} intensity={1} />
        <directionalLight position={[-10, 20, 10]} intensity={0.8} />
        
        <Grid infiniteGrid fadeDistance={50} fadeStrength={5} sectionColor="#444" cellColor="#222" />
        
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
