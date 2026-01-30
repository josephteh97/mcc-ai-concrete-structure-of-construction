import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Environment, Grid } from '@react-three/drei';
import { IFCLoader } from 'web-ifc-three/IFCLoader';

const IFCModel = ({ url, onLoadStart, onLoadComplete, onError, onProgress, setPhase }) => {
  const { scene, camera } = useThree();
  const modelRef = useRef(null);

  useEffect(() => {
    if (!url) return;

    console.log('[IFC] Starting load...');
    
    const loader = new IFCLoader();
    loader.ifcManager.setWasmPath('/');
    
    // Let workers load if they exist, disable if needed
    loader.ifcManager.useWebWorkers(false);
    
    console.log('[IFC] Configuration complete');

    onLoadStart();
    setPhase('LOADING');

    if (modelRef.current) {
      scene.remove(modelRef.current);
      modelRef.current = null;
    }

    const timeout = setTimeout(() => {
      console.error('[IFC] Timeout after 2 minutes');
      onError('Loading timeout');
      setPhase('ERROR');
    }, 120000);

    console.log('[IFC] Loading:', url);

    loader.load(
      url,
      (ifcModel) => {
        clearTimeout(timeout);
        console.log('[IFC] ✓ LOADED SUCCESSFULLY');
        
        setPhase('SUCCESS');
        onProgress(100);
        
        let meshCount = 0;
        ifcModel.traverse((child) => {
          if (child.isMesh) {
            meshCount++;
            if (child.material) {
              const mats = Array.isArray(child.material) ? child.material : [child.material];
              mats.forEach(m => {
                m.side = THREE.DoubleSide;
                m.transparent = false;
                m.opacity = 1;
              });
            }
          }
        });
        
        console.log('[IFC] Processed', meshCount, 'meshes');
        
        modelRef.current = ifcModel;
        scene.add(ifcModel);

        try {
          const box = new THREE.Box3().setFromObject(ifcModel);
          const center = box.getCenter(new THREE.Vector3());
          const size = box.getSize(new THREE.Vector3());
          const dist = Math.max(size.x, size.y, size.z) * 2.5 || 50;
          
          camera.position.set(center.x + dist, center.y + dist, center.z + dist);
          camera.lookAt(center);
          camera.updateProjectionMatrix();
          
          console.log('[IFC] Camera positioned');
        } catch (e) {
          console.warn('[IFC] Camera positioning failed');
        }

        onLoadComplete();
      },
      (xhr) => {
        if (xhr.lengthComputable) {
          const p = Math.floor((xhr.loaded / xhr.total) * 100);
          if (p % 10 === 0) console.log(`[IFC] ${p}%`);
          onProgress(p);
          setPhase(p === 100 ? 'PROCESSING' : 'LOADING');
        }
      },
      (err) => {
        clearTimeout(timeout);
        console.error('[IFC] LOAD ERROR:', err);
        setPhase('ERROR');
        onError(err.message || 'Failed to load IFC file');
      }
    );

    return () => {
      clearTimeout(timeout);
      if (modelRef.current) scene.remove(modelRef.current);
    };
  }, [url, scene, camera, onLoadStart, onLoadComplete, onError, onProgress, setPhase]);

  return null;
};

const Viewer3D = ({ ifcUrl }) => {
  const [loadingStatus, setLoadingStatus] = useState('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [phase, setPhase] = useState('IDLE');
  const [progressPct, setProgressPct] = useState(0);

  return (
    <div className="w-full h-full bg-black relative overflow-hidden">
      <div className="absolute top-4 left-4 z-30 font-mono text-xs text-white space-y-1">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${
            loadingStatus === 'loading' ? 'bg-yellow-400 animate-pulse' : 
            loadingStatus === 'success' ? 'bg-green-400' : 
            loadingStatus === 'error' ? 'bg-red-400' : 'bg-gray-400'
          }`}></div>
          <span>IFC Viewer</span>
        </div>
        <div className="text-white/50">{phase} - {progressPct}%</div>
      </div>

      {loadingStatus === 'loading' && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/90">
          <div className="w-12 h-12 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
          <div className="mt-4 text-white text-sm">{phase}</div>
          <div className="text-white/50 text-xs">{progressPct}%</div>
        </div>
      )}

      {loadingStatus === 'error' && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black p-8">
          <div className="max-w-md border border-red-500 p-6 bg-black">
            <h2 className="text-red-500 text-lg font-bold mb-4">Load Error</h2>
            <p className="text-red-400 text-sm mb-4 break-words">{errorMessage}</p>
            <button 
              onClick={() => window.location.reload()} 
              className="w-full py-2 bg-red-600 hover:bg-red-700 text-white"
            >
              Reload
            </button>
          </div>
        </div>
      )}

      <Canvas camera={{ position: [40, 40, 40], fov: 50 }}>
        <color attach="background" args={['#000']} />
        <ambientLight intensity={1.5} />
        <pointLight position={[50, 50, 50]} intensity={2} />
        <directionalLight position={[-50, 50, -50]} intensity={1.5} />
        
        <Grid infiniteGrid cellSize={1} sectionSize={10} sectionColor="#fff" cellColor="#222" />
        
        <mesh position={[0, 0.5, 0]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="#fff" wireframe />
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
        
        <OrbitControls />
        <Environment preset="city" />
      </Canvas>
    </div>
  );
};

export default Viewer3D;
