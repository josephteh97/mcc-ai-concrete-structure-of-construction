import React, { useState } from 'react';
import axios from 'axios';

function App() {
  const [file, setFile] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [viewerUrl, setViewerUrl] = useState(null);
  const [ifcFileUrl, setIfcFileUrl] = useState(null);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setFileName(selectedFile.name);
      setError('');
    }
  };

  const handleProcess = async () => {
    if (!file) {
      setError('Please select a file first');
      return;
    }

    setProcessing(true);
    setError('');

    try {
      console.log('[Upload] Uploading file to backend...');
      
      const formData = new FormData();
      formData.append('file', file);
      formData.append('scale', '1.0');
      formData.append('height', '3.0');
      formData.append('floor_count', '1');

      const response = await axios.post('http://localhost:8000/process', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 300000, // 5 minutes
      });

      console.log('[Upload] Backend response:', response.data);

      if (response.data.ifc_file) {
        // Construct full URL to IFC file
        const ifcUrl = `http://localhost:8000/download/${response.data.ifc_file}`;
        setIfcFileUrl(ifcUrl);

        // Create Flinker viewer URL
        const flinkerUrl = `https://viewer.flinker.app/?url=${encodeURIComponent(ifcUrl)}`;
        setViewerUrl(flinkerUrl);

        console.log('[Success] IFC file available at:', ifcUrl);
        console.log('[Success] Flinker viewer URL:', flinkerUrl);
      } else {
        throw new Error('No IFC file was generated');
      }
    } catch (err) {
      console.error('[Error]', err);
      setError(
        err.response?.data?.detail || 
        err.message || 
        'Processing failed. Please check backend logs.'
      );
    } finally {
      setProcessing(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setFileName('');
    setViewerUrl(null);
    setIfcFileUrl(null);
    setError('');
    setProcessing(false);
  };

  // Upload screen
  if (!viewerUrl) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800">
        <div className="bg-white rounded-2xl shadow-2xl p-10 max-w-xl w-full mx-4">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-100 rounded-full mb-4">
              <span className="text-4xl">🏗️</span>
            </div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              Construction AI
            </h1>
            <p className="text-gray-600 text-lg">
              Transform floor plans into 3D BIM models
            </p>
          </div>

          {/* File upload */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              Upload Floor Plan
            </label>
            <div className="relative">
              <input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.ifc"
                onChange={handleFileSelect}
                disabled={processing}
                className="block w-full text-sm text-gray-500
                  file:mr-4 file:py-3 file:px-6
                  file:rounded-lg file:border-0
                  file:text-sm file:font-semibold
                  file:bg-blue-50 file:text-blue-700
                  hover:file:bg-blue-100
                  disabled:opacity-50 disabled:cursor-not-allowed
                  cursor-pointer transition"
              />
            </div>
            {fileName && (
              <p className="mt-2 text-sm text-gray-600 flex items-center">
                <span className="mr-2">📄</span>
                {fileName}
              </p>
            )}
          </div>

          {/* Error message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded">
              <div className="flex items-start">
                <span className="text-red-500 mr-2">⚠️</span>
                <div>
                  <p className="font-semibold text-red-700">Error</p>
                  <p className="text-sm text-red-600 mt-1">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Process button */}
          <button
            onClick={handleProcess}
            disabled={!file || processing}
            className="w-full bg-blue-600 hover:bg-blue-700 
              disabled:bg-gray-400 disabled:cursor-not-allowed
              text-white font-bold py-4 rounded-xl
              transition-all duration-200 transform hover:scale-[1.02]
              shadow-lg hover:shadow-xl"
          >
            {processing ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Processing... Please wait
              </span>
            ) : (
              <span className="flex items-center justify-center">
                <span className="mr-2">🚀</span>
                Generate 3D Model
              </span>
            )}
          </button>

          {/* Processing info */}
          {processing && (
            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800 font-medium">
                ⏳ Processing your floor plan...
              </p>
              <p className="text-xs text-blue-600 mt-1">
                This typically takes 30-90 seconds
              </p>
            </div>
          )}

          {/* Features */}
          <div className="mt-8 p-6 bg-gray-50 rounded-xl">
            <p className="text-xs font-bold text-gray-700 mb-3 uppercase tracking-wide">
              ✨ What We Do
            </p>
            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex items-start">
                <span className="mr-2">🤖</span>
                <span>AI-powered floor plan analysis</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">🏗️</span>
                <span>Automatic 3D BIM model generation</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">📐</span>
                <span>Industry-standard IFC format</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">👁️</span>
                <span>Interactive 3D viewer (powered by Flinker)</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  // Viewer screen
  return (
    <div className="relative w-full h-full">
      {/* Flinker Viewer iframe */}
      <iframe
        src={viewerUrl}
        className="w-full h-full border-0"
        title="IFC 3D Viewer"
        allow="fullscreen"
      />

      {/* Top left info */}
      <div className="absolute top-4 left-4 bg-white/95 backdrop-blur-sm rounded-lg shadow-xl p-4 z-10 max-w-xs">
        <p className="text-sm font-bold text-gray-800 mb-1">
          ✅ Model Loaded
        </p>
        <p className="text-xs text-gray-600 break-words">
          {fileName}
        </p>
      </div>

      {/* Top right actions */}
      <div className="absolute top-4 right-4 flex gap-3 z-10">
        <a
          href={ifcFileUrl}
          download
          className="flex items-center gap-2 bg-green-600 hover:bg-green-700 
            text-white px-5 py-3 rounded-lg font-semibold 
            transition-all shadow-lg hover:shadow-xl transform hover:scale-105"
        >
          <span>📥</span>
          <span>Download IFC</span>
        </a>
        <button
          onClick={handleReset}
          className="flex items-center gap-2 bg-red-600 hover:bg-red-700 
            text-white px-5 py-3 rounded-lg font-semibold 
            transition-all shadow-lg hover:shadow-xl transform hover:scale-105"
        >
          <span>↻</span>
          <span>New File</span>
        </button>
      </div>

      {/* Bottom controls info */}
      <div className="absolute bottom-4 left-4 right-4 bg-indigo-600/95 backdrop-blur-sm text-white px-5 py-4 rounded-lg shadow-xl z-10">
        <p className="font-bold mb-2 flex items-center">
          <span className="mr-2">🎮</span>
          Viewer Controls
        </p>
        <div className="text-sm space-y-1">
          <p><strong>Rotate:</strong> Left click + drag</p>
          <p><strong>Pan:</strong> Right click + drag</p>
          <p><strong>Zoom:</strong> Mouse wheel or pinch</p>
        </div>
      </div>
    </div>
  );
}

export default App;
