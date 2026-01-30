import React, { useState } from 'react';
import FileUploader from './components/FileUploader';
import GLTFViewer from './components/GLTFViewer';

function App() {
  const [modelUrl, setModelUrl] = useState(null);

  return (
    <div className="w-screen h-screen">
      {modelUrl ? (
        <div className="relative w-full h-full">
          <GLTFViewer modelUrl={modelUrl} />
          
          {/* Reset button */}
          <button
            onClick={() => setModelUrl(null)}
            className="absolute top-4 right-4 z-10 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg shadow-lg transition"
          >
            Upload New File
          </button>
        </div>
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-50 to-gray-100">
          <FileUploader onModelReady={setModelUrl} />
        </div>
      )}
    </div>
  );
}

export default App;
