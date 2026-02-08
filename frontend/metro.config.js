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

// Worker tuning for better performance
config.maxWorkers = Number(process.env.METRO_MAX_WORKERS || 4);

// Fix React 19 + Metro ESM interop issues
config.resolver.unstable_enablePackageExports = false;

// Force CJS resolution for packages with ESM interop issues
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Packages known to have ESM interop issues with React 19
  const problematicPackages = ['zustand', 'socket.io-client', 'engine.io-client'];
  
  for (const pkg of problematicPackages) {
    if (moduleName === pkg || moduleName.startsWith(`${pkg}/`)) {
      return context.resolveRequest(context, moduleName, platform);
    }
  }
  
  return context.resolveRequest(context, moduleName, platform);
};

// Performance optimizations
config.transformer = {
  ...config.transformer,
  minifierConfig: {
    keep_classnames: false,
    keep_fnames: false,
    mangle: true,
    toplevel: false,
  },
};

module.exports = config;
