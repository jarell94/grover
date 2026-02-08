// metro.config.js
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");
const { FileStore } = require("metro-cache");

const config = getDefaultConfig(__dirname);

// Stable on-disk cache
const root = process.env.METRO_CACHE_ROOT || path.join(__dirname, ".metro-cache");
config.cacheStores = [new FileStore({ root: path.join(root, "metro") })];

// Optional: reset cache via env flag
config.resetCache = process.env.RESET_METRO_CACHE === "1";

// Worker tuning
config.maxWorkers = Number(process.env.METRO_MAX_WORKERS || 2);

// Fix React 19 + Metro ESM interop issues
// Disable package exports for problematic ESM packages
config.resolver.unstable_enablePackageExports = false;

// Force CJS resolution for packages with ESM interop issues
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Packages known to have ESM interop issues with React 19
  const problematicPackages = ['zustand', 'socket.io-client', 'engine.io-client'];
  
  for (const pkg of problematicPackages) {
    if (moduleName === pkg || moduleName.startsWith(`${pkg}/`)) {
      // Force resolution through standard Node resolution
      return context.resolveRequest(context, moduleName, platform);
    }
  }
  
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
