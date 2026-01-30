import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Environment, Grid, PerspectiveCamera } from '@react-three/drei';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';

const GLTFModel = ({ url, onLoadStart, onLoadComplete, onError, onProgress }) => {
  const { scene, camera } = useThree();
  const modelRef = useRef(null);

  useEffect(() => {
    if (!url) return;

    console.log('[GLTF] Loading model from:', url);
    
    const loader = new GLTFLoader();
    onLoadStart();

    if (modelRef.current) {
      scene.remove(modelRef.current);
      modelRef.current = null;
    }

    loader.load(
      url,
      (gltf) => {
        console.log('[GLTF] ✓ Model loaded successfully');
        
        const model = gltf.scene;
        modelRef.current = model;
        scene.add(model);

        // Center and scale model
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        
        // Move model to origin
        model.position.sub(center);
        
        // Calculate camera distance
        const maxDim = Math.max(size.x, size.y, size.z);
        const distance = maxDim * 2;
        
        camera.position.set(distance, distance, distance);
        camera.lookAt(0, 0, 0);
        camera.updateProjectionMatrix();

        console.log('[GLTF] Model centered, camera positioned');
        onLoadComplete();
      },
      (xhr) => {
        const progress = xhr.lengthComputable 
          ? Math.floor((xhr.loaded / xhr.total) * 100) 
          : 0;
        onProgress(progress);
        
        if (progress % 20 === 0) {
          console.log(`[GLTF] Loading: ${progress}%`);
        }
      },
      (error) => {
        console.error('[GLTF] Load error:', error);
        onError(error.message || 'Failed to load model');
      }
    );

    return () => {
      if (modelRef.current) {
        scene.remove(modelRef.current);
      }
    };
  }, [url, scene, camera, onLoadStart, onLoadComplete, onError, onProgress]);

  return null;
};

const GLTFViewer = ({ modelUrl }) => {
  const [loadingStatus, setLoadingStatus] = useState('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');

  return (
    <div className="w-full h-full bg-gradient-to-br from-gray-900 to-black relative">
      {/* HUD */}
      <div className="absolute top-4 left-4 z-10 bg-black/50 backdrop-blur-sm px-4 py-2 rounded-lg">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${
            loadingStatus === 'loading' ? 'bg-yellow-400 animate-pulse' :
            loadingStatus === 'success' ? 'bg-green-400' :
            loadingStatus === 'error' ? 'bg-red-400' :
            'bg-gray-400'
          }`} />
          <span className="text-white font-mono text-sm">
            Construction AI Viewer
          </span>
        </div>
        {loadingStatus === 'loading' && (
          <div className="mt-2 text-white/70 text-xs">
            Loading: {progress}%
          </div>
        )}
      </div>

      {/* Loading overlay */}
      {loadingStatus === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-20">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-white/20 border-t-white rounded-full animate-spin mb-4 mx-auto" />
            <p className="text-white text-lg">Loading Model...</p>
            <p className="text-white/50 text-sm mt-2">{progress}%</p>
          </div>
        </div>
      )}

      {/* Error overlay */}
      {loadingStatus === 'error' && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/90 z-20 p-8">
          <div className="max-w-md bg-red-900/20 border border-red-500 p-6 rounded-lg">
            <h2 className="text-red-400 text-xl font-bold mb-3">Error</h2>
            <p className="text-red-200 text-sm mb-4">{error}</p>
            <button 
              onClick={() => window.location.reload()}
              className="w-full bg-red-600 hover:bg-red-700 text-white py-2 rounded transition"
            >
              Reload Page
            </button>
          </div>
        </div>
      )}

      {/* 3D Canvas */}
      <Canvas>
        <color attach="background" args={['#0a0a0a']} />
        
        <PerspectiveCamera makeDefault position={[50, 50, 50]} fov={50} />
        
        {/* Lighting */}
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={1} castShadow />
        <directionalLight position={[-10, 10, -5]} intensity={0.5} />
        <pointLight position={[0, 10, 0]} intensity={0.5} />
        
        {/* Grid */}
        <Grid 
          infiniteGrid 
          cellSize={1} 
          sectionSize={10}
          fadeDistance={100}
          sectionColor="#3b82f6"
          cellColor="#1e293b"
        />
        
        {/* Reference cube */}
        <mesh position={[0, 0.5, 0]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="#fff" wireframe />
        </mesh>
        
        {/* Load model */}
        {modelUrl && (
          <GLTFModel 
            url={modelUrl}
            onLoadStart={() => { setLoadingStatus('loading'); setProgress(0); }}
            onLoadComplete={() => { setLoadingStatus('success'); setProgress(100); }}
            onError={(msg) => { setLoadingStatus('error'); setError(msg); }}
            onProgress={(p) => setProgress(p)}
          />
        )}
        
        <OrbitControls makeDefault enableDamping dampingFactor={0.05} />
        <Environment preset="city" />
      </Canvas>
    </div>
  );
};

export default GLTFViewer;
