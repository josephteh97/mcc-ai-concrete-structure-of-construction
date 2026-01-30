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

    console.log('[IFC Engine] Starting load process...');
    console.log('[IFC Engine] URL:', url);

    const wasmPath = '/';
    console.log(`[IFC Engine] v2.7 - WASM Path: ${wasmPath}`);

    const loader = new IFCLoader();
    loader.ifcManager.setWasmPath(wasmPath);
    loader.ifcManager.useWebWorkers(false);

    // Add timeout detection
    let loadTimeout;
    let lastProgress = 0;
    let progressStallCount = 0;

    onLoadStart();
    setPhase('INIT_LOCAL_ENGINE');

    if (modelRef.current) {
      scene.remove(modelRef.current);
      modelRef.current = null;
    }

    // Start timeout monitor
    const startTime = Date.now();
    loadTimeout = setInterval(() => {
      const elapsed = Date.now() - startTime;
      console.log(`[IFC Engine] Loading time: ${(elapsed / 1000).toFixed(1)}s`);
      
      if (elapsed > 60000) { // 60 seconds
        clearInterval(loadTimeout);
        console.error('[IFC Engine] Loading timeout - taking too long!');
        onError('Loading timeout - file may be too large or corrupted');
        setPhase('ERROR');
      }
    }, 5000);

    loader.load(
      url,
      // Success callback
      (ifcModel) => {
        clearInterval(loadTimeout);
        const loadTime = ((Date.now() - startTime) / 1000).toFixed(2);
        
        console.log('[IFC Engine] ✓✓✓ SUCCESS - Model Loaded ✓✓✓');
        console.log('[IFC Engine] Load time:', loadTime, 'seconds');
        console.log('[IFC Engine] Model details:', {
          type: ifcModel.type,
          uuid: ifcModel.uuid,
          hasGeometry: !!ifcModel.geometry,
          hasMaterial: !!ifcModel.material,
          children: ifcModel.children?.length || 0,
          position: ifcModel.position,
          rotation: ifcModel.rotation,
          scale: ifcModel.scale
        });

        if (ifcModel.geometry) {
          console.log('[IFC Engine] Geometry info:', {
            vertexCount: ifcModel.geometry.attributes.position?.count || 0,
            hasNormals: !!ifcModel.geometry.attributes.normal,
            hasUVs: !!ifcModel.geometry.attributes.uv,
            boundingBox: ifcModel.geometry.boundingBox,
            boundingSphere: ifcModel.geometry.boundingSphere
          });
        }

        setPhase('SUCCESS');
        onProgress(100);
        
        // Ensure visibility
        ifcModel.traverse((child) => {
          if (child.isMesh) {
            console.log('[IFC Engine] Processing mesh:', child.name);
            
            if (child.material) {
              const materials = Array.isArray(child.material) ? child.material : [child.material];
              materials.forEach(mat => {
                mat.side = THREE.DoubleSide;
                mat.transparent = false;
                mat.opacity = 1;
                if (mat.color) {
                  mat.color.setHex(0xffffff);
                }
              });
            }
          }
        });
        
        modelRef.current = ifcModel;
        scene.add(ifcModel);

        // Calculate bounding box and center camera
        const box = new THREE.Box3().setFromObject(ifcModel);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const distance = maxDim * 3 || 60;

        console.log('[IFC Engine] Bounding box:', {
          center: { x: center.x, y: center.y, z: center.z },
          size: { x: size.x, y: size.y, z: size.z },
          maxDim,
          cameraDistance: distance
        });

        camera.position.set(center.x + distance, center.y + distance, center.z + distance);
        camera.lookAt(center);
        camera.updateProjectionMatrix();

        console.log('[IFC Engine] Camera positioned');
        onLoadComplete();
      },
      
      // Progress callback
      (xhr) => {
        if (xhr.lengthComputable) {
          const percent = Math.floor((xhr.loaded / xhr.total) * 100);
          
          // Detect stalled progress
          if (percent === lastProgress) {
            progressStallCount++;
            if (progressStallCount > 10) {
              console.warn('[IFC Engine] Progress stalled at', percent, '%');
            }
          } else {
            progressStallCount = 0;
          }
          lastProgress = percent;
          
          console.log(`[IFC Engine] Progress: ${percent}% (${xhr.loaded}/${xhr.total} bytes)`);
          onProgress(percent);
          
          if (percent === 100) {
            console.log('[IFC Engine] Download complete, building mesh...');
            setPhase('BUILDING_MESH');
          } else if (percent > 0 && percent < 100) {
            setPhase('LOADING');
          }
        } else {
          console.log(`[IFC Engine] Progress: ${xhr.loaded} bytes (total unknown)`);
          setPhase('LOADING');
        }
      },
      
      // Error callback
      (err) => {
        clearInterval(loadTimeout);
        
        console.error('[IFC Engine] ✗✗✗ ERROR ✗✗✗');
        console.error('[IFC Engine] Error type:', err.name);
        console.error('[IFC Engine] Error message:', err.message);
        console.error('[IFC Engine] Error stack:', err.stack);
        
        setPhase('ERROR');
        
        let msg = err.message || 'Unknown error';
        
        // Categorize errors
        if (msg.includes('WASM') || msg.includes('wasm')) {
          msg = "WASM_ERROR: " + msg;
        } else if (msg.includes('fetch') || msg.includes('network')) {
          msg = "NETWORK_ERROR: Cannot load file - " + msg;
        } else if (msg.includes('parse') || msg.includes('Parse')) {
          msg = "PARSE_ERROR: Invalid IFC file - " + msg;
        } else if (msg.includes('memory') || msg.includes('Memory')) {
          msg = "MEMORY_ERROR: File too large - " + msg;
        } else if (msg.includes('timeout') || msg.includes('Timeout')) {
          msg = "TIMEOUT_ERROR: Loading took too long - " + msg;
        }
        
        onError(msg);
      }
    );

    return () => {
      clearInterval(loadTimeout);
      if (modelRef.current) {
        console.log('[IFC Engine] Cleaning up model');
        scene.remove(modelRef.current);
      }
    };
  }, [url, scene, camera, onLoadStart, onLoadComplete, onError, onProgress, setPhase]);

  return null;
};

const Viewer3D = ({ ifcUrl }) => {
  const [loadingStatus, setLoadingStatus] = useState('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [phase, setPhase] = useState('IDLE');
  const [progressPct, setProgressPct] = useState(0);
  const [loadStartTime, setLoadStartTime] = useState(null);

  useEffect(() => {
    if (phase === 'BUILDING_MESH' && loadStartTime) {
      const elapsed = Date.now() - loadStartTime;
      if (elapsed > 30000) { // 30 seconds in BUILDING_MESH
        console.warn('[Viewer3D] BUILDING_MESH phase taking too long!');
      }
    }
  }, [phase, loadStartTime]);

  return (
    <div className="w-full h-full bg-black relative overflow-hidden">
      {/* HUD Overlay */}
      <div className="absolute top-4 left-4 z-30 font-mono text-[10px] space-y-1 pointer-events-none">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${
            loadingStatus === 'loading' 
              ? 'bg-yellow-500 animate-pulse' 
              : loadingStatus === 'success'
              ? 'bg-green-500 shadow-[0_0_10px_#22c55e]'
              : 'bg-white'
          }`}></div>
          <span className="text-white font-bold tracking-widest uppercase">IFC_ENGINE_CORE_V2.7</span>
        </div>
        <div className="text-white/40 uppercase">Phase: <span className="text-white font-bold">{phase}</span></div>
        <div className="text-white/40 uppercase">Load: <span className="text-white font-bold">{progressPct}%</span></div>
        {phase === 'BUILDING_MESH' && (
          <div className="text-yellow-500 text-[8px] uppercase animate-pulse">
            Processing geometry... This may take a while for large files
          </div>
        )}
      </div>

      {/* Debug info */}
      <div className="absolute top-4 right-4 z-30 font-mono text-[8px] text-white/30 space-y-1 pointer-events-none">
        <div>Status: {loadingStatus}</div>
        <div>URL: {ifcUrl ? 'Set' : 'None'}</div>
        <div>Time: {loadStartTime ? `${((Date.now() - loadStartTime) / 1000).toFixed(1)}s` : '0s'}</div>
      </div>

      {loadingStatus === 'loading' && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/95">
          <div className="relative w-24 h-24">
            <div className="absolute inset-0 border border-white/10 rounded-full animate-ping"></div>
            <div className="w-full h-full border-2 border-white/20 rounded-full flex items-center justify-center">
              <div className="w-12 h-12 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            </div>
          </div>
          <div className="mt-8 text-white font-mono tracking-[1em] animate-pulse text-[9px] uppercase font-bold">
            {phase}
          </div>
          <div className="mt-2 text-white/50 text-[8px]">
            {progressPct}%
          </div>
          {phase === 'BUILDING_MESH' && progressPct === 100 && (
            <div className="mt-4 text-yellow-500 text-[8px] max-w-xs text-center">
              Processing large geometry - please wait...
              <br />
              Check browser console (F12) for progress
            </div>
          )}
        </div>
      )}

      {loadingStatus === 'error' && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black p-12 text-center">
          <div className="max-w-md w-full border border-red-500 p-8">
            <h2 className="text-red-500 font-black text-2xl mb-4 tracking-widest uppercase italic">
              Engine_Failure
            </h2>
            <div className="bg-red-500/10 p-4 font-mono text-[10px] text-red-500 border border-red-500/20 mb-8 leading-relaxed font-bold">
              {errorMessage}
            </div>
            <div className="space-y-2 mb-6 text-white/50 text-[8px] text-left">
              <p>Troubleshooting tips:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Check browser console (F12) for detailed errors</li>
                <li>Try a smaller/simpler IFC file</li>
                <li>Validate IFC file format</li>
                <li>Clear browser cache and reload</li>
              </ul>
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
        
        <Grid 
          infiniteGrid 
          fadeDistance={10000}
          fadeStrength={0}
          cellSize={1} 
          sectionSize={10} 
          sectionThickness={3}
          sectionColor="#ffffff"
          cellColor="#222222"
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
            onLoadStart={() => { 
              setLoadingStatus('loading'); 
              setProgressPct(0); 
              setLoadStartTime(Date.now());
              console.log('[Viewer3D] Load started');
            }}
            onLoadComplete={() => { 
              setLoadingStatus('success'); 
              setProgressPct(100); 
              console.log('[Viewer3D] Load completed');
            }}
            onError={(msg) => { 
              setLoadingStatus('error'); 
              setErrorMessage(msg); 
              console.error('[Viewer3D] Load error:', msg);
            }}
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
