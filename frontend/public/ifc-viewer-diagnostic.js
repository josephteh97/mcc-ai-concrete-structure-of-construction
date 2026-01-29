/**
 * Comprehensive IFC Viewer WASM Diagnostic Script
 * 
 * This script performs multiple diagnostic checks to identify issues
 * with web-ifc WASM loading failures
 */

console.log("========================================");
console.log("IFC VIEWER WASM DIAGNOSTIC TEST");
console.log("========================================\n");

// Test 1: Check if web-ifc is available
console.log("TEST 1: Checking web-ifc availability...");
try {
    const WebIFC = window.WebIFC || require('web-ifc');
    console.log("✓ web-ifc module found");
    console.log("  Version:", WebIFC.VERSION || "Unknown");
} catch (e) {
    console.error("✗ web-ifc module not found:", e.message);
}

// Test 2: Check WASM file paths
console.log("\nTEST 2: Checking WASM file paths...");
const possibleWasmPaths = [
    '/node_modules/web-ifc/web-ifc.wasm',
    '/node_modules/web-ifc/dist/web-ifc.wasm',
    '/web-ifc.wasm',
    '/dist/web-ifc.wasm',
    '/public/web-ifc.wasm',
    './web-ifc.wasm',
    'node_modules/web-ifc/web-ifc.wasm',
];

async function checkWasmPaths() {
    for (const path of possibleWasmPaths) {
        try {
            const response = await fetch(path, { method: 'HEAD' });
            console.log(`✓ Found at ${path}`);
            console.log(`  Status: ${response.status}`);
            console.log(`  Content-Type: ${response.headers.get('content-type')}`);
            console.log(`  Content-Length: ${response.headers.get('content-length')} bytes`);
            
            // Check if MIME type is correct
            const contentType = response.headers.get('content-type');
            if (contentType && !contentType.includes('application/wasm')) {
                console.warn(`  ⚠ WARNING: Incorrect MIME type. Should be 'application/wasm'`);
            }
        } catch (e) {
            console.log(`✗ Not found at ${path}`);
        }
    }
}

// Test 3: Check WASM magic number
console.log("\nTEST 3: Validating WASM magic number...");
async function validateWasmFile(url) {
    try {
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        
        // WASM magic number is: 0x00 0x61 0x73 0x6d (\0asm)
        const magicNumber = [0x00, 0x61, 0x73, 0x6d];
        const fileMagic = Array.from(bytes.slice(0, 4));
        
        console.log(`  Expected magic number: ${magicNumber.map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ')}`);
        console.log(`  Found magic number:    ${fileMagic.map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ')}`);
        
        const isValid = magicNumber.every((byte, i) => byte === fileMagic[i]);
        
        if (isValid) {
            console.log("✓ WASM file is valid (magic number matches)");
            console.log(`  File size: ${bytes.length} bytes`);
        } else {
            console.error("✗ WASM file is INVALID (magic number mismatch)");
            console.log("  First 20 bytes:", Array.from(bytes.slice(0, 20)).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));
            
            // Check if it's base64 encoded
            const first4Chars = String.fromCharCode(...bytes.slice(0, 4));
            if (first4Chars.match(/^[A-Za-z0-9+\/]/)) {
                console.warn("  ⚠ File appears to be base64 encoded!");
            }
            
            // Check if it's HTML
            if (first4Chars === '<!DO' || first4Chars === '<htm') {
                console.warn("  ⚠ File appears to be HTML (404 page?)");
            }
        }
        
        return isValid;
    } catch (e) {
        console.error("✗ Error reading WASM file:", e.message);
        return false;
    }
}

// Test 4: Check WebAssembly support
console.log("\nTEST 4: Checking WebAssembly support...");
if (typeof WebAssembly === 'object') {
    console.log("✓ WebAssembly is supported");
    
    // Check for streaming compilation
    if (typeof WebAssembly.instantiateStreaming === 'function') {
        console.log("✓ WebAssembly.instantiateStreaming is supported");
    } else {
        console.warn("⚠ WebAssembly.instantiateStreaming is NOT supported (will use fallback)");
    }
    
    // Check for multi-threading support
    if (typeof SharedArrayBuffer !== 'undefined') {
        console.log("✓ SharedArrayBuffer is supported (multi-threading possible)");
    } else {
        console.warn("⚠ SharedArrayBuffer is NOT supported (multi-threading disabled)");
    }
} else {
    console.error("✗ WebAssembly is NOT supported in this browser");
}

// Test 5: Check Three.js and IFCLoader setup
console.log("\nTEST 5: Checking Three.js and IFCLoader setup...");
try {
    const THREE = window.THREE;
    if (THREE) {
        console.log("✓ Three.js found");
        console.log(`  Version: ${THREE.REVISION}`);
    } else {
        console.warn("⚠ Three.js not found in global scope");
    }
} catch (e) {
    console.error("✗ Error checking Three.js:", e.message);
}

// Test 6: Network and CORS checks
console.log("\nTEST 6: Checking network and CORS configuration...");
async function checkCORS(url) {
    try {
        const response = await fetch(url);
        const corsHeader = response.headers.get('access-control-allow-origin');
        console.log(`  CORS header: ${corsHeader || 'Not set'}`);
        
        if (!corsHeader && window.location.protocol === 'file:') {
            console.warn("  ⚠ Running from file:// protocol - CORS may cause issues");
        }
    } catch (e) {
        console.error("  ✗ Network error:", e.message);
    }
}

// Test 7: Check package.json versions
console.log("\nTEST 7: Checking package versions...");
async function checkPackageVersions() {
    try {
        const response = await fetch('/package.json');
        const packageJson = await response.json();
        const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
        
        const relevantPackages = [
            'three',
            'web-ifc',
            'web-ifc-three',
            '@thatopen/components',
            '@thatopen/ui'
        ];
        
        console.log("  Installed packages:");
        relevantPackages.forEach(pkg => {
            if (deps[pkg]) {
                console.log(`    ${pkg}: ${deps[pkg]}`);
            }
        });
        
        // Check for version conflicts
        if (deps['web-ifc'] && deps['web-ifc-three']) {
            console.log("\n  Version compatibility check:");
            console.log("    Ensure web-ifc and web-ifc-three versions are compatible");
        }
    } catch (e) {
        console.warn("  ⚠ Could not read package.json:", e.message);
    }
}

// Test 8: Memory and performance checks
console.log("\nTEST 8: Checking browser memory and performance...");
if (performance.memory) {
    console.log("  Memory usage:");
    console.log(`    Total JS Heap: ${(performance.memory.totalJSHeapSize / 1048576).toFixed(2)} MB`);
    console.log(`    Used JS Heap: ${(performance.memory.usedJSHeapSize / 1048576).toFixed(2)} MB`);
    console.log(`    Heap Limit: ${(performance.memory.jsHeapSizeLimit / 1048576).toFixed(2)} MB`);
} else {
    console.log("  ℹ Memory information not available");
}

// Test 9: Browser and environment info
console.log("\nTEST 9: Browser and environment information...");
console.log(`  User Agent: ${navigator.userAgent}`);
console.log(`  Platform: ${navigator.platform}`);
console.log(`  Language: ${navigator.language}`);
console.log(`  Online: ${navigator.onLine}`);
console.log(`  Protocol: ${window.location.protocol}`);
console.log(`  Host: ${window.location.host}`);

// Test 10: Try to instantiate a simple WASM module
console.log("\nTEST 10: Testing basic WASM instantiation...");
async function testBasicWasm() {
    // Minimal valid WASM module (returns 42)
    const wasmCode = new Uint8Array([
        0x00, 0x61, 0x73, 0x6d, // WASM magic number
        0x01, 0x00, 0x00, 0x00, // Version
        0x01, 0x05, 0x01, 0x60, 0x00, 0x01, 0x7f, // Type section
        0x03, 0x02, 0x01, 0x00, // Function section
        0x07, 0x07, 0x01, 0x03, 0x66, 0x6f, 0x6f, 0x00, 0x00, // Export section
        0x0a, 0x06, 0x01, 0x04, 0x00, 0x41, 0x2a, 0x0b // Code section
    ]);
    
    try {
        const module = await WebAssembly.instantiate(wasmCode);
        console.log("✓ Basic WASM instantiation successful");
        console.log(`  Test function returned: ${module.instance.exports.foo()}`);
        return true;
    } catch (e) {
        console.error("✗ Basic WASM instantiation failed:", e.message);
        console.error("  This indicates a fundamental WebAssembly problem");
        return false;
    }
}

// Run all async tests
async function runAllTests() {
    console.log("\n========================================");
    console.log("RUNNING ASYNC TESTS...");
    console.log("========================================\n");
    
    await checkWasmPaths();
    
    // Try to validate the first found WASM file
    const commonPath = '/node_modules/web-ifc/web-ifc.wasm';
    console.log(`\nAttempting to validate WASM at: ${commonPath}`);
    await validateWasmFile(commonPath);
    
    await checkCORS(commonPath);
    await checkPackageVersions();
    await testBasicWasm();
    
    console.log("\n========================================");
    console.log("DIAGNOSTIC COMPLETE");
    console.log("========================================\n");
    
    console.log("RECOMMENDATIONS:");
    console.log("1. Ensure web-ifc.wasm is in the correct location");
    console.log("2. Verify server is serving WASM with 'application/wasm' MIME type");
    console.log("3. Check that WASM file is not corrupted or base64 encoded");
    console.log("4. Ensure package versions are compatible");
    console.log("5. Set correct WASM path using setWasmPath() method");
    console.log("\nExample fix:");
    console.log("  const ifcLoader = new IFCLoader();");
    console.log("  ifcLoader.ifcManager.setWasmPath('/path/to/wasm/');");
}

// Start the diagnostic
runAllTests().catch(console.error);

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        runAllTests,
        validateWasmFile,
        checkWasmPaths
    };
}
