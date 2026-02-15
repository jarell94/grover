const fs = require('fs');
const path = require('path');

// Regex to locate ExpoReactNativeFactory init that references RCTReleaseLevel and passes releaseLevel to super.init
const INIT_SIGNATURE = '@objc public override init\\(delegate: any RCTReactNativeFactoryDelegate\\)';
const RELEASE_LEVEL_INIT_PATTERN = new RegExp(
  [
    '^(\\s*)', // capture indentation to preserve formatting
    INIT_SIGNATURE,
    '\\s*\\{',
    '[\\s\\S]*?RCTReleaseLevel', // match release level enum usage
    '[\\s\\S]*?super\\.init\\(delegate:\\s*delegate,\\s*releaseLevel:[^)]+\\)', // match releaseLevel call
    '[\\s\\S]*?\\n\\s*\\}', // end of init method
  ].join(''),
  'm'
);

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
  } else {
    // Match the ExpoReactNativeFactory init that:
    // - Declares @objc public override init(delegate: any RCTReactNativeFactoryDelegate)
    // - References RCTReleaseLevel in the body
    // - Calls super.init(delegate: delegate, releaseLevel: ...)
    const updatedContent = content.replace(RELEASE_LEVEL_INIT_PATTERN, (match, indent) => (
      `${indent}@objc public override init(delegate: any RCTReactNativeFactoryDelegate) {\n` +
      `${indent}  ${patchMarker}\n` +
      `${indent}  super.init(delegate: delegate)\n` +
      `${indent}}`
    ));
    if (updatedContent !== content) {
      content = updatedContent;
      fs.writeFileSync(swiftFilePath, content);
      console.log('  ExpoReactNativeFactory.swift patched');
    } else {
      console.warn('  releaseLevel init not found in ExpoReactNativeFactory.swift; verify file if build errors persist');
    }
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
