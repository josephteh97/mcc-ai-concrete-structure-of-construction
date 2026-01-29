import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Environment, Grid, Html, Loader } from '@react-three/drei';
import { IFCLoader } from 'web-ifc-three/IFCLoader';

const IFCModel = ({ url, onLoadStart, onLoadComplete, onError, onRetry, onProgress, setPhase }) => {
  const { scene, camera } = useThree();
  const ifcLoader = useRef(null);
  const modelRef = useRef(null);
  const finalized = useRef(false);

  useEffect(() => {
    if (!url) return;

    // Initialize loader
    if (!ifcLoader.current) {
      ifcLoader.current = new IFCLoader();
      // Use 0.0.36 as default - often more stable with web-ifc-three
      ifcLoader.current.ifcManager.setWasmPath('https://unpkg.com/web-ifc@0.0.36/');
      ifcLoader.current.ifcManager.useWebWorkers(false);
    }

    onLoadStart();
    setPhase('LOADING');

    // Cleanup previous model
    if (modelRef.current) {
      scene.remove(modelRef.current);
      modelRef.current = null;
    }

    const loadModel = async () => {
      try {
        setPhase('LOADING');
        onProgress(10);
        
        console.log(`[IFC Viewer] Loading via loadAsync: ${url}`);
        
        // Use loadAsync directly
        const ifcModel = await ifcLoader.current.loadAsync(
          url,
          (xhr) => {
            if (xhr.lengthComputable) {
              const percent = Math.floor((xhr.loaded / xhr.total) * 100);
              onProgress(percent);
            }
          }
        );

        setPhase('RENDERING');
        onProgress(90);

        if (ifcModel) {
          finalized.current = true;
          modelRef.current = ifcModel;
          scene.add(ifcModel);

          // Center and zoom
          const box = new THREE.Box3().setFromObject(ifcModel);
          const center = box.getCenter(new THREE.Vector3());
          const size = box.getSize(new THREE.Vector3());
          const maxDim = Math.max(size.x, size.y, size.z);
          
          // Move camera to a good distance
          const distance = maxDim * 2;
          camera.position.set(center.x + distance, center.y + distance, center.z + distance);
          camera.lookAt(center);
          camera.updateProjectionMatrix();

          onProgress(100);
          onLoadComplete();
          setPhase('SUCCESS');
        } else {
          throw new Error("Model loaded but is empty");
        }
      } catch (error) {
        console.error('[IFC Viewer] Load Error:', error);
        setPhase('ERROR');
        onError(error.message || 'Failed to load 3D model');
      }
    };

    loadModel();

    return () => {
      if (modelRef.current) scene.remove(modelRef.current);
      finalized.current = false;
    };
  }, [url, scene, camera]);

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

      <Canvas shadows camera={{ position: [20, 20, 20], fov: 45 }}>
        <color attach="background" args={['#0a0a0f']} />
        <fog attach="fog" args={['#0a0a0f', 50, 150]} />
        
        <ambientLight intensity={0.8} />
        <pointLight position={[10, 10, 10]} intensity={1.5} castShadow />
        <spotLight position={[-10, 20, 10]} angle={0.15} penumbra={1} intensity={2} castShadow />
        
        <Grid 
          infiniteGrid 
          fadeDistance={100} 
          fadeStrength={5} 
          cellSize={1} 
          sectionSize={5} 
          sectionColor="#1e293b" 
          cellColor="#0f172a" 
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
        
        <OrbitControls makeDefault minDistance={2} maxDistance={100} />
        <Environment preset="night" />
      </Canvas>
    </div>
  );
};

export default Viewer3D;
