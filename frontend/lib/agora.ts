// Platform-agnostic Agora exports
// Metro/webpack will automatically resolve to:
// - agora.native.ts on iOS/Android
// - agora.web.tsx on web

// Re-export from the platform-specific file
export * from './agora.web';
