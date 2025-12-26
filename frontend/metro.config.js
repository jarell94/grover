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

module.exports = config;
