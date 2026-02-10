const fs = require('fs');
const path = require('path');

console.log('Applying RCTReleaseLevel patches...');

// Patch ExpoReactNativeFactory.swift to remove RCTReleaseLevel references
const swiftFilePath = path.join(
  __dirname,
  'node_modules/expo/ios/AppDelegates/ExpoReactNativeFactory.swift'
);

if (fs.existsSync(swiftFilePath)) {
  console.log('Patching ExpoReactNativeFactory.swift...');
  let content = fs.readFileSync(swiftFilePath, 'utf8');
  
  // Check if already patched
  if (content.includes('// PATCHED: RCTReleaseLevel removed')) {
    console.log('  ExpoReactNativeFactory.swift already patched');
  } else {
    // Remove releaseLevel parameter from createReactHost call
    // Pattern 1: releaseLevel: RCTReleaseLevel.debug
    content = content.replace(
      /,\s*releaseLevel:\s*RCTReleaseLevel\.\w+/g,
      ''
    );
    
    // Pattern 2: releaseLevel: .debug or similar
    content = content.replace(
      /,\s*releaseLevel:\s*\.\w+/g,
      ''
    );
    
    // Pattern 3: Remove RCTReleaseLevel type references
    content = content.replace(
      /let releaseLevel.*RCTReleaseLevel.*\n/g,
      '// PATCHED: RCTReleaseLevel removed\n'
    );
    
    // Pattern 4: Remove releaseLevel variable declaration
    content = content.replace(
      /var releaseLevel.*=.*\n/g,
      '// PATCHED: releaseLevel removed\n'
    );
    
    fs.writeFileSync(swiftFilePath, content);
    console.log('  ExpoReactNativeFactory.swift patched');
  }
} else {
  console.log('  ExpoReactNativeFactory.swift not found');
}

// Also check EXDevLauncherController.m for similar issues
const objcFilePath = path.join(
  __dirname,
  'node_modules/expo-dev-launcher/ios/EXDevLauncherController.m'
);

if (fs.existsSync(objcFilePath)) {
  console.log('Patching EXDevLauncherController.m...');
  let content = fs.readFileSync(objcFilePath, 'utf8');
  
  if (content.includes('// PATCHED')) {
    console.log('  EXDevLauncherController.m already patched');
  } else {
    // Remove releaseLevel references in Objective-C
    content = content.replace(
      /releaseLevel:\s*RCTReleaseLevel\w*/g,
      ''
    );
    fs.writeFileSync(objcFilePath, content);
    console.log('  EXDevLauncherController.m patched');
  }
} else {
  console.log('  EXDevLauncherController.m not found');
}

console.log('All patches applied successfully');
