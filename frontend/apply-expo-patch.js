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
    // Remove the entire releaseLevel block and the super.init call with releaseLevel
    const oldBlock = `  // TODO: Remove check when react-native-macos 0.81 is released
  #if !os(macOS)
  @objc public override init(delegate: any RCTReactNativeFactoryDelegate) {
    let releaseLevel = (Bundle.main.object(forInfoDictionaryKey: "ReactNativeReleaseLevel") as? String)
      .flatMap { [
        "canary": RCTReleaseLevel.Canary,
        "experimental": RCTReleaseLevel.Experimental,
        "stable": RCTReleaseLevel.Stable
      ][$0.lowercased()]
      }
    ?? RCTReleaseLevel.Stable

    super.init(delegate: delegate, releaseLevel: releaseLevel)
  }
  #endif`;

    const newBlock = `  // PATCHED: RCTReleaseLevel removed for compatibility
  #if !os(macOS)
  @objc public override init(delegate: any RCTReactNativeFactoryDelegate) {
    super.init(delegate: delegate)
  }
  #endif`;

    if (content.includes('let releaseLevel = (Bundle.main')) {
      content = content.replace(oldBlock, newBlock);
      
      // If the exact block didn't match, try a more aggressive approach
      if (content.includes('releaseLevel: releaseLevel')) {
        // Replace the init method more aggressively
        content = content.replace(
          /@objc public override init\(delegate: any RCTReactNativeFactoryDelegate\) \{[\s\S]*?super\.init\(delegate: delegate, releaseLevel: releaseLevel\)[\s\S]*?\}/,
          `@objc public override init(delegate: any RCTReactNativeFactoryDelegate) {
    // PATCHED: RCTReleaseLevel removed for compatibility
    super.init(delegate: delegate)
  }`
        );
      }
    }
    
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
