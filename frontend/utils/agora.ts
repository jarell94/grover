// Platform-agnostic Agora barrel
// .native.ts / .web.tsx will override this file at runtime
// This file exists for TypeScript and as fallback

export {};

// Re-export from web as default (Metro will pick platform-specific)
export * from './agora.web';
