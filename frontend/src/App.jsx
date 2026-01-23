import React, { useState } from 'react';
import axios from 'axios';
import Viewer3D from './components/Viewer3D';
import ChatWidget from './components/ChatWidget';

function App() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [ifcUrl, setIfcUrl] = useState(null);
  const [stats, setStats] = useState(null);
  const [constructionParams, setConstructionParams] = useState({
    floor_count: 1,
    scale: 0.05,
    height: 3.0
  });

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleParamsUpdate = (newParams) => {
    setConstructionParams(prev => ({ ...prev, ...newParams }));
    alert(`Parameters updated: ${JSON.stringify(newParams)}`);
  };

  const handleUpload = async (mode = 'simple') => {
    if (!file) return;

    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('scale', constructionParams.scale);
    formData.append('height', constructionParams.height);
    formData.append('floor_count', constructionParams.floor_count);
    formData.append('generation_mode', mode);

    try {
      // Adjust URL to your backend
      const response = await axios.post('http://localhost:8000/process', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.data.status === 'success') {
        // Construct full URL for download
        const url = `http://localhost:8000${response.data.ifc_url}`;
        setIfcUrl(url);
        setStats(response.data);
      }
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Error processing file');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen w-screen flex-col md:flex-row">
      <ChatWidget onParamsUpdate={handleParamsUpdate} />
      {/* Sidebar / Control Panel */}
      <div className="w-full md:w-80 bg-white p-6 shadow-lg z-10 flex flex-col gap-6 overflow-y-auto">
        <h1 className="text-2xl font-bold text-blue-600">MCC AI Construction</h1>
        
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-gray-700">Upload Floor Plan (Image/PDF)</label>
          <input 
            type="file" 
            onChange={handleFileChange} 
            className="block w-full text-sm text-gray-500
              file:mr-4 file:py-2 file:px-4
              file:rounded-full file:border-0
              file:text-sm file:font-semibold
              file:bg-blue-50 file:text-blue-700
              hover:file:bg-blue-100"
          />
        </div>

        {/* Floor Count Input */}
        <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-700">Number of Floors</label>
            <input 
                type="number" 
                min="1"
                value={constructionParams.floor_count}
                onChange={(e) => setConstructionParams(prev => ({ ...prev, floor_count: parseInt(e.target.value) || 1 }))}
                className="block w-full p-2 text-sm border border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
        </div>

        <div className="flex flex-col gap-3">
            <button
              onClick={() => handleUpload('simple')}
              disabled={!file || loading}
              className={`w-full py-2 px-4 rounded-md text-white font-medium transition-colors
                ${!file || loading 
                  ? 'bg-gray-400 cursor-not-allowed' 
                  : 'bg-green-600 hover:bg-green-700'}`}
            >
              {loading ? 'Processing...' : 'Simple Task (Rule-based)'}
            </button>

            <button
              onClick={() => handleUpload('advanced')}
              disabled={!file || loading}
              className={`w-full py-2 px-4 rounded-md text-white font-medium transition-colors
                ${!file || loading 
                  ? 'bg-gray-400 cursor-not-allowed' 
                  : 'bg-purple-600 hover:bg-purple-700'}`}
            >
              {loading ? 'Processing...' : 'Advanced Task (GNN Agent)'}
            </button>
        </div>

        {stats && (
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <h3 className="font-semibold mb-2">Results</h3>
            <p className="text-sm">Elements Detected: {stats.detections}</p>
            <p className="text-sm truncate" title={stats.file_id}>ID: {stats.file_id}</p>
          </div>
        )}
        
        <div className="mt-auto text-xs text-gray-400">
          MCC Engineering &copy; 2026
        </div>
      </div>

      {/* 3D Viewer Area */}
      <div className="flex-1 relative bg-gray-900">
        <Viewer3D ifcUrl={ifcUrl} />
        {!ifcUrl && (
          <div className="absolute inset-0 flex items-center justify-center text-gray-500 pointer-events-none">
            <p>Upload a drawing to generate 3D model</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
