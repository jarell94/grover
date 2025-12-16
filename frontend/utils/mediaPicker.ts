import * as ImagePicker from 'expo-image-picker';
import { Platform, Alert } from 'react-native';

export interface MediaPickerResult {
  uri: string;
  type?: string;
  base64?: string;
  width?: number;
  height?: number;
}

export interface MediaPickerOptions {
  mediaTypes?: 'Images' | 'Videos' | 'All';
  allowsEditing?: boolean;
  quality?: number;
  base64?: boolean;
  allowsMultipleSelection?: boolean;
}

/**
 * Pick media (image or video) with proper web/mobile handling
 */
export async function pickMedia(
  options: MediaPickerOptions = {}
): Promise<MediaPickerResult | null> {
  try {
    // Default options
    const {
      mediaTypes = 'All',
      allowsEditing = true,
      quality = 0.8,
      base64 = true,
      allowsMultipleSelection = false,
    } = options;

    // Request permissions (returns true on web)
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert(
        'Permission Required',
        'Please grant camera roll permissions to upload media.',
        [{ text: 'OK' }]
      );
      return null;
    }

    // Map media types
    let mediaTypeOption: ImagePicker.MediaTypeOptions;
    if (mediaTypes === 'Images') {
      mediaTypeOption = ImagePicker.MediaTypeOptions.Images;
    } else if (mediaTypes === 'Videos') {
      mediaTypeOption = ImagePicker.MediaTypeOptions.Videos;
    } else {
      mediaTypeOption = ImagePicker.MediaTypeOptions.All;
    }

    // On web, base64 conversion can be problematic, so disable it
    const shouldUseBase64 = Platform.OS !== 'web' && base64;

    // Launch image picker
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: mediaTypeOption,
      allowsEditing: Platform.OS !== 'web' && allowsEditing, // Editing can be problematic on web
      quality,
      base64: shouldUseBase64,
      allowsMultipleSelection,
    });

    // Check if user cancelled
    if (result.canceled || !result.assets || result.assets.length === 0) {
      return null;
    }

    // Return the first selected asset
    const asset = result.assets[0];
    
    return {
      uri: asset.uri,
      type: asset.type,
      base64: asset.base64,
      width: asset.width,
      height: asset.height,
    };
  } catch (error) {
    console.error('Media picker error:', error);
    
    // Show user-friendly error
    Alert.alert(
      'Upload Error',
      'Failed to pick media. Please try again.',
      [{ text: 'OK' }]
    );
    
    return null;
  }
}

/**
 * Pick image only with proper web/mobile handling
 */
export async function pickImage(
  options: Omit<MediaPickerOptions, 'mediaTypes'> = {}
): Promise<MediaPickerResult | null> {
  return pickMedia({ ...options, mediaTypes: 'Images' });
}

/**
 * Pick video only with proper web/mobile handling
 */
export async function pickVideo(
  options: Omit<MediaPickerOptions, 'mediaTypes'> = {}
): Promise<MediaPickerResult | null> {
  return pickMedia({ ...options, mediaTypes: 'Videos' });
}

/**
 * Take a photo with camera
 */
export async function takePhoto(
  options: MediaPickerOptions = {}
): Promise<MediaPickerResult | null> {
  try {
    // Request camera permissions
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert(
        'Permission Required',
        'Please grant camera permissions to take photos.',
        [{ text: 'OK' }]
      );
      return null;
    }

    const {
      allowsEditing = true,
      quality = 0.8,
      base64 = true,
    } = options;

    // Launch camera
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing,
      quality,
      base64,
    });

    // Check if user cancelled
    if (result.canceled || !result.assets || result.assets.length === 0) {
      return null;
    }

    // Return the captured photo
    const asset = result.assets[0];
    
    return {
      uri: asset.uri,
      type: asset.type,
      base64: asset.base64,
      width: asset.width,
      height: asset.height,
    };
  } catch (error) {
    console.error('Camera error:', error);
    
    // Show user-friendly error
    Alert.alert(
      'Camera Error',
      'Failed to take photo. Please try again.',
      [{ text: 'OK' }]
    );
    
    return null;
  }
}

/**
 * Show media picker options (Camera or Gallery)
 */
export async function showMediaOptions(
  onImagePicked: (result: MediaPickerResult) => void,
  mediaType: 'Images' | 'Videos' | 'All' = 'All'
): Promise<void> {
  // On web, we can't show action sheet, so just open gallery
  if (Platform.OS === 'web') {
    const result = await pickMedia({ mediaTypes: mediaType });
    if (result) {
      onImagePicked(result);
    }
    return;
  }

  // On mobile, show options
  Alert.alert(
    'Upload Media',
    'Choose an option',
    [
      {
        text: 'Take Photo',
        onPress: async () => {
          const result = await takePhoto();
          if (result) {
            onImagePicked(result);
          }
        },
      },
      {
        text: 'Choose from Gallery',
        onPress: async () => {
          const result = await pickMedia({ mediaTypes: mediaType });
          if (result) {
            onImagePicked(result);
          }
        },
      },
      {
        text: 'Cancel',
        style: 'cancel',
      },
    ]
  );
}
