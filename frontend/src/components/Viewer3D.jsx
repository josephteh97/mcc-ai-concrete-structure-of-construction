import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Environment, Grid, Html, Loader } from '@react-three/drei';
import { IFCLoader } from 'web-ifc-three/IFCLoader';

const IFCModel = ({ url, onLoadStart, onLoadComplete, onError, onRetry, onProgress }) => {
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

  useEffect(() => {
    if (!url) return;

    // Initialize loader once
    if (!ifcLoader.current) {
      ifcLoader.current = new IFCLoader();
      // Default: use local package asset path
      const wasmDir = currentWasm;
      ifcLoader.current.ifcManager.setWasmPath(wasmDir);
      if (typeof ifcLoader.current.ifcManager.useWebWorkers === 'function') {
        ifcLoader.current.ifcManager.useWebWorkers(false);
      }
      console.log(`[IFC Viewer] WASM dir: ${wasmDir}`);
    }

    onLoadStart();

    // Cleanup previous model
    if (modelRef.current) {
      scene.remove(modelRef.current);
      modelRef.current = null;
    }

    console.log(`[IFC Viewer] Attempting to load: ${url}`);

    if (watchdog.current) {
      clearTimeout(watchdog.current);
    }
    watchdog.current = setTimeout(async () => {
      try {
        if (ifcLoader.current && url) {
          const retry = await ifcLoader.current.loadAsync(url);
          let ok = false;
          retry.traverse((child) => { if (child.isMesh) ok = true; });
          if (!ok) {
            onError('Timeout fallback: no geometry');
            return;
          }
          modelRef.current = retry;
          scene.add(retry);
          const box = new THREE.Box3().setFromObject(retry);
          const center = box.getCenter(new THREE.Vector3());
          const size = box.getSize(new THREE.Vector3());
          const maxDim = Math.max(size.x, size.y, size.z);
          const fov = camera.fov * (Math.PI / 180);
          let cameraZ = Math.abs(maxDim / 4 * Math.tan(fov * 2));
          cameraZ *= 3;
          camera.position.set(center.x + cameraZ, center.y + cameraZ, center.z + cameraZ);
          camera.lookAt(center);
          camera.updateProjectionMatrix();
          onLoadComplete();
        }
      } catch (e) {
        onError(`Timeout fallback failed: ${e.message || 'Unknown error'}`);
      }
    }, 15000);

    ifcLoader.current.load(
      url,
      (ifcModel) => {
        console.log('[IFC Viewer] Model loaded successfully from server.');
        
        // Validation: Check if model has any meshes
        let hasGeometry = false;
        ifcModel.traverse((child) => {
          if (child.isMesh) hasGeometry = true;
        });

        if (!hasGeometry) {
          console.warn('[IFC Viewer] Warning: Model loaded but no 3D geometry found. The file might be empty or invalid.');
          onError('Model loaded but contains no geometry.');
          return;
        }

        modelRef.current = ifcModel;
        scene.add(ifcModel);
        
        // Auto-focus camera on the model
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
        
        onLoadComplete();
        if (watchdog.current) {
          clearTimeout(watchdog.current);
          watchdog.current = null;
        }
      },
      (progress) => {
        const percent = Math.round((progress.loaded / progress.total) * 100);
        console.log(`[IFC Viewer] Loading progress: ${percent}%`);
        onProgress && onProgress(percent);
      },
      (error) => {
        console.error('[IFC Viewer] Critical Error during loading:', error);
        const msg = `Failed to fetch or parse IFC file: ${error.message || 'Unknown error'}`;
        // Fallback: retry with CDN wasm path once if we hit LinkError
        const isLinkError = String(error).includes('LinkError');
        if (isLinkError) {
          const nextIdx = fallbackIndex.current + 1;
          const altWasmDir = fallbackList.current[nextIdx];
          if (!altWasmDir) {
            onError(msg);
            return;
          }
          didFallback.current = true;
          fallbackIndex.current = nextIdx;
          setCurrentWasm(altWasmDir);
          console.log('[IFC Viewer] LinkError detected. Trying next WASM:', altWasmDir);
          ifcLoader.current.ifcManager.setWasmPath(altWasmDir);
          if (typeof ifcLoader.current.ifcManager.useWebWorkers === 'function') {
            ifcLoader.current.ifcManager.useWebWorkers(false);
          }
          onRetry && onRetry();
          // Retry once
          ifcLoader.current.load(
            url,
            (retryModel) => {
              console.log('[IFC Viewer] Retry succeeded with alternate WASM.');
              // Basic geometry validation
              let hasGeometry = false;
              retryModel.traverse((child) => { if (child.isMesh) hasGeometry = true; });
              if (!hasGeometry) {
                onError('Model loaded but contains no geometry (retry).');
                return;
              }
              modelRef.current = retryModel;
              scene.add(retryModel);
              const box = new THREE.Box3().setFromObject(retryModel);
              const center = box.getCenter(new THREE.Vector3());
              const size = box.getSize(new THREE.Vector3());
              const maxDim = Math.max(size.x, size.y, size.z);
              const fov = camera.fov * (Math.PI / 180);
              let cameraZ = Math.abs(maxDim / 4 * Math.tan(fov * 2));
              cameraZ *= 3;
              camera.position.set(center.x + cameraZ, center.y + cameraZ, center.z + cameraZ);
              camera.lookAt(center);
              camera.updateProjectionMatrix();
              onLoadComplete();
              if (watchdog.current) {
                clearTimeout(watchdog.current);
                watchdog.current = null;
              }
            },
            undefined,
            (retryErr) => {
              console.error('[IFC Viewer] Retry failed:', retryErr);
              const isStillLinkError = String(retryErr).includes('LinkError');
              if (isStillLinkError) {
                // recursively try next option
                const nextIdx2 = fallbackIndex.current + 1;
                const nextWasm = fallbackList.current[nextIdx2];
                if (nextWasm) {
                  fallbackIndex.current = nextIdx2;
                  setCurrentWasm(nextWasm);
                  console.log('[IFC Viewer] Retry failed with current WASM. Trying next:', nextWasm);
                  ifcLoader.current.ifcManager.setWasmPath(nextWasm);
                  ifcLoader.current.ifcManager.useWebWorkers?.(false);
                  ifcLoader.current.load(url,
                    (model2) => {
                      console.log('[IFC Viewer] Retry succeeded with alternate chain.');
                      let ok = false;
                      model2.traverse((child) => { if (child.isMesh) ok = true; });
                      if (!ok) {
                        onError('Model loaded but contains no geometry (retry chain).');
                        return;
                      }
                      modelRef.current = model2;
                      scene.add(model2);
                      const box = new THREE.Box3().setFromObject(model2);
                      const center = box.getCenter(new THREE.Vector3());
                      const size = box.getSize(new THREE.Vector3());
                      const maxDim = Math.max(size.x, size.y, size.z);
                      const fov = camera.fov * (Math.PI / 180);
                      let cameraZ = Math.abs(maxDim / 4 * Math.tan(fov * 2));
                      cameraZ *= 3;
                      camera.position.set(center.x + cameraZ, center.y + cameraZ, center.z + cameraZ);
                      camera.lookAt(center);
                      camera.updateProjectionMatrix();
                      onLoadComplete();
                      if (watchdog.current) {
                        clearTimeout(watchdog.current);
                        watchdog.current = null;
                      }
                    },
                    undefined,
                    (err3) => {
                      console.error('[IFC Viewer] Retry chain failed:', err3);
                      onError(`Retry chain failed: ${err3.message || 'Unknown error'}`);
                    }
                  );
                  return;
                }
              }
              onError(`Retry failed: ${retryErr.message || 'Unknown error'}`);
            }
          );
          return;
        }
        onError(msg);
      }
    );

    return () => {
      if (modelRef.current) {
        scene.remove(modelRef.current);
      }
      if (watchdog.current) {
        clearTimeout(watchdog.current);
        watchdog.current = null;
      }
    };
  }, [url, scene, camera]);

  return null;
};

const Viewer3D = ({ ifcUrl }) => {
  const [loadingStatus, setLoadingStatus] = useState('idle'); // 'idle', 'loading', 'success', 'error'
  const [errorMessage, setErrorMessage] = useState('');
  const [netInfo, setNetInfo] = useState(null);
  const [attempts, setAttempts] = useState(0);
  const [errors, setErrors] = useState(0);
  const [retries, setRetries] = useState(0);
  const [wasmInfo, setWasmInfo] = useState(null);
  const [wasmInfoFallback, setWasmInfoFallback] = useState(null);
  const [progressPct, setProgressPct] = useState(0);
  const watchdog = useRef(null);

  console.log(`[Viewer3D] Current Status: ${loadingStatus}, URL: ${ifcUrl}`);

  useEffect(() => {
    const check = async () => {
      if (!ifcUrl) {
        setNetInfo(null);
        return;
      }
      try {
        const res = await fetch(ifcUrl, { method: 'HEAD' });
        const info = {
          ok: res.ok,
          status: res.status,
          type: res.headers.get('content-type'),
          length: res.headers.get('content-length'),
        };
        setNetInfo(info);
        console.log('[IFC Viewer] Preflight HEAD:', info);
      } catch (e) {
        setNetInfo({ ok: false, status: 0, type: null, length: null });
        console.log('[IFC Viewer] Preflight HEAD failed');
      }
    };
    check();
  }, [ifcUrl]);

  // Probe WASM availability (main)
  useEffect(() => {
    const probeWasm = async () => {
      try {
        const url = 'https://unpkg.com/web-ifc@0.0.47/web-ifc.wasm';
        const res = await fetch(url, { method: 'HEAD' });
        const info = {
          ok: res.ok,
          status: res.status,
          type: res.headers.get('content-type'),
          length: res.headers.get('content-length'),
          url,
        };
        setWasmInfo(info);
        console.log('[IFC Viewer] WASM HEAD(main):', info);
      } catch (e) {
        setWasmInfo({ ok: false, status: 0, type: null, length: null, url: 'N/A' });
        console.log('[IFC Viewer] WASM HEAD(main) failed');
      }
    };
    probeWasm();
  }, []);

  return (
    <div className="w-full h-full bg-black relative border-4 border-blue-900">
      {/* Debug Info Overlay */}
      <div className="absolute top-2 left-2 z-30 text-[10px] text-blue-400 font-mono bg-black bg-opacity-50 p-1 pointer-events-none">
        RENDERER_V1.1 | STATUS: {loadingStatus.toUpperCase()} | ATT: {attempts} ERR: {errors} RETRY: {retries} PROG: {progressPct}% | {netInfo ? `HEAD ${netInfo.status} ${netInfo.ok ? 'OK' : 'ERR'} ${netInfo.type || ''} ${netInfo.length || ''}` : 'HEAD N/A'} | WASM {wasmInfo ? `${wasmInfo.status} ${wasmInfo.ok ? 'OK' : 'ERR'} ${wasmInfo.type || ''} ${wasmInfo.length || ''}` : 'N/A'}
      </div>

      {/* Status Overlay */}
      {loadingStatus === 'loading' && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black bg-opacity-50 text-white">
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <p>Loading 3D Model...</p>
          </div>
        </div>
      )}

      {loadingStatus === 'error' && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black bg-opacity-70 text-red-400 p-4 text-center">
          <div className="flex flex-col items-center gap-4">
            <span className="text-4xl">⚠️</span>
            <p className="font-bold">Rendering Failed</p>
            <p className="text-sm max-w-md">{errorMessage}</p>
            <button 
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
            >
              Reload Application
            </button>
          </div>
        </div>
      )}

      <Canvas camera={{ position: [10, 10, 10], fov: 50 }}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={1} />
        <Grid infiniteGrid />
        
        {ifcUrl && (
          <IFCModel 
            url={ifcUrl} 
            onLoadStart={() => {
              setLoadingStatus('loading');
              setErrorMessage('');
              setAttempts((v) => v + 1);
            }}
            onLoadComplete={() => setLoadingStatus('success')}
            onError={(msg) => {
              setLoadingStatus('error');
              setErrorMessage(msg);
              setErrors((v) => v + 1);
            }}
            onRetry={() => setRetries((v) => v + 1)}
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
