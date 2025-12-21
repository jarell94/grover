// Platform-agnostic Agora exports
// Metro/webpack will automatically resolve to:
// - agora.native.ts on iOS/Android
// - agora.web.ts on web
//
// This file should NOT be used directly - it exists as documentation
// Import from '../utils/agora' and the bundler will pick the right file

// Re-export from the platform-specific file
// Note: This file won't actually be used because .native.ts and .web.ts take precedence
// But having it helps with TypeScript type inference in some cases

export * from './agora.web';
