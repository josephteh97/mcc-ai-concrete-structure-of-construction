import React, { useState } from 'react';
import axios from 'axios';

function App() {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [viewerUrl, setViewerUrl] = useState(null);
  const [ifcFileUrl, setIfcFileUrl] = useState(null);
  const [error, setError] = useState('');

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a file');
      return;
    }

    setUploading(true);
    setError('');

    try {
      // Upload to backend
      const formData = new FormData();
      formData.append('file', file);
      formData.append('scale', '1.0');
      formData.append('height', '3.0');
      formData.append('floor_count', '1');

      console.log('[Upload] Processing file...');
      const response = await axios.post('http://localhost:8000/process', formData);
      
      console.log('[Upload] Response:', response.data);

      if (response.data.ifc_file) {
        // Get the IFC file URL from backend
        const ifcUrl = `http://localhost:8000/download/${response.data.ifc_file}`;
        setIfcFileUrl(ifcUrl);

        // Create Flinker viewer URL
        // Flinker accepts a URL parameter with the IFC file location
        const flinkerUrl = `https://viewer.flinker.app/?url=${encodeURIComponent(ifcUrl)}`;
        setViewerUrl(flinkerUrl);
        
        console.log('[Viewer] Flinker URL:', flinkerUrl);
      } else {
        setError('No IFC file generated');
      }
    } catch (err) {
      console.error('[Error]', err);
      setError(err.response?.data?.detail || err.message || 'Processing failed');
    } finally {
      setUploading(false);
    }
  };

  const reset = () => {
    setFile(null);
    setViewerUrl(null);
    setIfcFileUrl(null);
    setError('');
  };

  return (
    <div className="w-screen h-screen">
      {!viewerUrl ? (
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-600 to-purple-600">
          <div className="bg-white rounded-xl shadow-2xl p-8 max-w-lg w-full">
            <div className="text-center mb-6">
              <h1 className="text-3xl font-bold text-gray-800 mb-2">
                🏗️ Construction AI
              </h1>
              <p className="text-gray-600">
                Upload floor plans and generate 3D IFC models
              </p>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Upload Floor Plan
              </label>
              <input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.ifc"
                onChange={(e) => setFile(e.target.files[0])}
                disabled={uploading}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50 cursor-pointer"
              />
            </div>

            {error && (
              <div className="mb-4 p-4 bg-red-50 border-l-4 border-red-500 text-red-700">
                <p className="font-semibold">Error</p>
                <p className="text-sm">{error}</p>
              </div>
            )}

            <button
              onClick={handleUpload}
              disabled={!file || uploading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-3 rounded-lg transition-colors duration-200"
            >
              {uploading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processing...
                </span>
              ) : (
                'Generate & View 3D Model'
              )}
            </button>

            {uploading && (
              <div className="mt-4 p-3 bg-blue-50 rounded text-center text-sm text-blue-700">
                <p>Processing your floor plan...</p>
                <p className="text-xs mt-1">This may take 30-60 seconds</p>
              </div>
            )}

            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <p className="text-xs font-semibold text-gray-700 mb-2">
                ✨ Features:
              </p>
              <ul className="text-xs text-gray-600 space-y-1">
                <li>• AI-powered floor plan analysis</li>
                <li>• Automatic IFC generation</li>
                <li>• Interactive 3D viewer (Flinker)</li>
                <li>• Industry-standard BIM format</li>
              </ul>
            </div>
          </div>
        </div>
      ) : (
        <div className="relative w-full h-full">
          {/* Flinker Viewer in iframe */}
          <iframe
            src={viewerUrl}
            className="w-full h-full border-0"
            title="IFC 3D Viewer"
            allow="fullscreen"
          />

          {/* Controls overlay */}
          <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm rounded-lg shadow-lg p-3 z-10">
            <p className="text-sm font-semibold text-gray-800 mb-1">
              📄 Model Loaded
            </p>
            <p className="text-xs text-gray-600">
              {file?.name}
            </p>
          </div>

          {/* Action buttons */}
          <div className="absolute top-4 right-4 flex gap-2 z-10">
            <a
              href={ifcFileUrl}
              download
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition shadow-lg"
            >
              📥 Download IFC
            </a>
            <button
              onClick={reset}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition shadow-lg"
            >
              ↻ New File
            </button>
          </div>

          {/* Info banner */}
          <div className="absolute bottom-4 left-4 right-4 bg-blue-600/90 backdrop-blur-sm text-white px-4 py-3 rounded-lg text-sm z-10">
            <p className="font-semibold mb-1">🎯 Viewer Controls:</p>
            <p className="text-xs">
              • <strong>Rotate:</strong> Left click + drag
              • <strong>Pan:</strong> Right click + drag
              • <strong>Zoom:</strong> Mouse wheel
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
