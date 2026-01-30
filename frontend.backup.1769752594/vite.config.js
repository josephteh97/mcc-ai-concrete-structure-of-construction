import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  
  // Exclude web-ifc from optimization - it needs special handling
  optimizeDeps: {
    exclude: ['web-ifc']
  },
  
  // Configure server headers for WASM support
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp'
    },
    // Allow access to node_modules for WASM files
    fs: {
      allow: ['..']
    }
  },
  
  // Ensure WASM files are treated as assets
  assetsInclude: ['**/*.wasm'],
  
  // Build configuration for WASM
  build: {
    target: 'esnext',
    rollupOptions: {
      output: {
        // Keep WASM files separate (don't inline them)
        assetFileNames: (assetInfo) => {
          if (assetInfo.name.endsWith('.wasm')) {
            return 'assets/[name][extname]'
          }
          return 'assets/[name]-[hash][extname]'
        }
      }
    }
  },
  
  // Worker configuration (for multi-threaded WASM)
  worker: {
    format: 'es'
  }
})
