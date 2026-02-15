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
  const patchMarker = '// PATCHED: RCTReleaseLevel removed for compatibility';
  if (content.includes(patchMarker)) {
    console.log('  ExpoReactNativeFactory.swift already patched');
  } else if (content.includes('RCTReleaseLevel') || content.includes('releaseLevel:')) {
    const initPattern = /@objc public override init\(delegate: any RCTReactNativeFactoryDelegate\)\s*\{[\s\S]*?\}/;
    const replacement = `@objc public override init(delegate: any RCTReactNativeFactoryDelegate) {
    ${patchMarker}
    super.init(delegate: delegate)
  }`;

    if (initPattern.test(content)) {
      content = content.replace(initPattern, replacement);
    }

    content = content.replace(
      /super\.init\(delegate:\s*delegate,\s*releaseLevel:\s*[^)]+\)/g,
      'super.init(delegate: delegate)'
    );
    content = content.replace(/RCTReleaseLevel\.[A-Za-z]+/g, '');
    content = content.replace(/releaseLevel:\s*RCTReleaseLevel\w*/g, '');

    fs.writeFileSync(swiftFilePath, content);
    console.log('  ExpoReactNativeFactory.swift patched');
  } else {
    console.log('  ExpoReactNativeFactory.swift releaseLevel not found');
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
