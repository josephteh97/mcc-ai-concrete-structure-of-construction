import React, { useState } from 'react';
import axios from 'axios';

const FileUploader = ({ onModelReady }) => {
  const [uploading, setUploading] = useState(false);
  const [converting, setConverting] = useState(false);
  const [error, setError] = useState('');

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.name.endsWith('.ifc')) {
      setError('Please upload an IFC file');
      return;
    }

    setError('');
    setUploading(true);

    try {
      // Upload IFC file
      const formData = new FormData();
      formData.append('file', file);

      console.log('[Upload] Uploading IFC file...');
      const uploadResponse = await axios.post('/api/upload-ifc', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      const fileId = uploadResponse.data.file_id;
      console.log('[Upload] ✓ Uploaded, file ID:', fileId);

      setUploading(false);
      setConverting(true);

      // Convert to GLTF
      console.log('[Convert] Converting IFC to GLTF...');
      const convertResponse = await axios.post('/api/convert-to-gltf', { file_id: fileId });
      
      const gltfUrl = convertResponse.data.gltf_url;
      console.log('[Convert] ✓ Conversion complete');

      setConverting(false);
      onModelReady(gltfUrl);

    } catch (err) {
      console.error('[Error]', err);
      setError(err.response?.data?.detail || err.message || 'Upload failed');
      setUploading(false);
      setConverting(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">
        Construction AI Viewer
      </h1>

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Upload IFC File
        </label>
        <input
          type="file"
          accept=".ifc"
          onChange={handleFileUpload}
          disabled={uploading || converting}
          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50"
        />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {uploading && (
        <div className="text-center py-4">
          <div className="inline-block w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-2" />
          <p className="text-gray-600">Uploading...</p>
        </div>
      )}

      {converting && (
        <div className="text-center py-4">
          <div className="inline-block w-8 h-8 border-4 border-green-200 border-t-green-600 rounded-full animate-spin mb-2" />
          <p className="text-gray-600">Converting to 3D model...</p>
        </div>
      )}

      <div className="mt-6 p-4 bg-gray-50 rounded text-sm text-gray-600">
        <p className="font-semibold mb-2">✓ Features:</p>
        <ul className="space-y-1">
          <li>• Upload IFC files</li>
          <li>• Auto-convert to GLTF</li>
          <li>• Interactive 3D viewer</li>
          <li>• Fast & reliable rendering</li>
        </ul>
      </div>
    </div>
  );
};

export default FileUploader;
