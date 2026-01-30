/**
 * IFC Loader Configuration
 * Forces single-threaded mode and prevents worker loading
 */

import { IFCLoader } from 'web-ifc-three/IFCLoader';

/**
 * Create a properly configured IFC Loader
 * @returns {IFCLoader} Configured loader instance
 */
export function createIFCLoader() {
  const loader = new IFCLoader();
  
  // Set WASM path
  loader.ifcManager.setWasmPath('/');
  
  // CRITICAL: Force disable web workers at multiple levels
  loader.ifcManager.useWebWorkers(false);
  
  // Patch the worker initialization at a lower level
  if (loader.ifcManager.state) {
    loader.ifcManager.state.useWebWorkers = false;
    loader.ifcManager.state.worker = null;
  }
  
  // Prevent the API from trying to use workers
  if (loader.ifcManager.state && loader.ifcManager.state.api) {
    const originalInit = loader.ifcManager.state.api.Init;
    if (originalInit) {
      loader.ifcManager.state.api.Init = function() {
        // Call original but force single-threaded
        const result = originalInit.apply(this, arguments);
        this.useWebWorkers = false;
        return result;
      };
    }
  }
  
  console.log('[IFCLoaderConfig] Loader configured with workers DISABLED');
  
  return loader;
}

/**
 * Initialize web-ifc API directly (bypass workers)
 */
export async function initWebIfcAPI() {
  try {
    const WebIFC = await import('web-ifc');
    const api = new WebIFC.IfcAPI();
    
    // Initialize without workers
    await api.Init();
    
    console.log('[IFCLoaderConfig] web-ifc API initialized successfully');
    return api;
  } catch (error) {
    console.error('[IFCLoaderConfig] Failed to initialize web-ifc API:', error);
    throw error;
  }
}
