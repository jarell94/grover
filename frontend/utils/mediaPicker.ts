import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import * as ImageManipulator from "expo-image-manipulator";
import { Alert, Platform } from "react-native";

export type MediaKind = "image" | "video" | "audio" | "unknown";

export interface MediaPickerResult {
  uri: string;
  kind: MediaKind;          // normalized kind: image/video/...
  mimeType?: string;        // e.g. image/jpeg, video/mp4
  fileName?: string;        // e.g. IMG_1234.jpg
  fileSize?: number;        // bytes (not always available)
  duration?: number;        // ms (usually for video)
  width?: number;
  height?: number;
  base64?: string;          // only if requested and available
}

export interface MediaPickerMultiResult {
  assets: MediaPickerResult[];
}

export interface MediaPickerOptions {
  mediaTypes?: "Images" | "Videos" | "All";
  allowsEditing?: boolean;
  quality?: number;
  base64?: boolean; // only recommended for small images
  allowsMultipleSelection?: boolean;
  selectionLimit?: number; // iOS 14+ style
}

const DEFAULTS: Required<Pick<
  MediaPickerOptions,
  "mediaTypes" | "allowsEditing" | "quality" | "base64" | "allowsMultipleSelection"
>> = {
  mediaTypes: "All",
  allowsEditing: true,
  quality: 0.8,
  base64: false,
  allowsMultipleSelection: false,
};

function mapPickerMediaTypes(mediaTypes: MediaPickerOptions["mediaTypes"]) {
  if (mediaTypes === "Images") return ImagePicker.MediaTypeOptions.Images;
  if (mediaTypes === "Videos") return ImagePicker.MediaTypeOptions.Videos;
  return ImagePicker.MediaTypeOptions.All;
}

function normalizeKind(asset: ImagePicker.ImagePickerAsset): MediaKind {
  // Expo asset.type is often "image" | "video"
  const t = (asset.type || "").toLowerCase();
  if (t === "image") return "image";
  if (t === "video") return "video";

  // fallback: infer from mimeType or fileName
  const mt = (asset as any).mimeType?.toLowerCase?.() || "";
  if (mt.startsWith("image/")) return "image";
  if (mt.startsWith("video/")) return "video";
  if (mt.startsWith("audio/")) return "audio";

  const name = (asset.fileName || "").toLowerCase();
  if (/\.(jpg|jpeg|png|webp|heic|heif)$/.test(name)) return "image";
  if (/\.(mp4|mov|m4v|webm)$/.test(name)) return "video";
  if (/\.(mp3|m4a|wav|aac)$/.test(name)) return "audio";

  return "unknown";
}

function fallbackMime(kind: MediaKind, fileName?: string) {
  const n = (fileName || "").toLowerCase();
  if (kind === "image") {
    if (n.endsWith(".png")) return "image/png";
    if (n.endsWith(".webp")) return "image/webp";
    if (n.endsWith(".heic") || n.endsWith(".heif")) return "image/heic";
    return "image/jpeg";
  }
  if (kind === "video") {
    if (n.endsWith(".webm")) return "video/webm";
    return "video/mp4";
  }
  if (kind === "audio") {
    if (n.endsWith(".wav")) return "audio/wav";
    if (n.endsWith(".m4a")) return "audio/mp4";
    return "audio/mpeg";
  }
  return "application/octet-stream";
}

function ensureFileName(asset: ImagePicker.ImagePickerAsset, kind: MediaKind) {
  if (asset.fileName) return asset.fileName;

  const ext =
    kind === "image" ? "jpg" :
    kind === "video" ? "mp4" :
    kind === "audio" ? "mp3" : "bin";

  return `${kind}_${Date.now()}.${ext}`;
}

function toResult(asset: ImagePicker.ImagePickerAsset, includeBase64: boolean): MediaPickerResult {
  const kind = normalizeKind(asset);
  const fileName = ensureFileName(asset, kind);

  // Some platforms expose mimeType; if not, fallback.
  const mimeType = (asset as any).mimeType || fallbackMime(kind, fileName);

  return {
    uri: asset.uri,
    kind,
    mimeType,
    fileName,
    fileSize: (asset as any).fileSize,
    duration: (asset as any).duration,
    width: asset.width,
    height: asset.height,
    base64: includeBase64 ? asset.base64 : undefined,
  };
}

/**
 * Ensure the URI is uploadable (converts iOS ph:// URIs to file://)
 * iOS Photos library returns ph:// URIs which can't be directly uploaded
 */
async function ensureUploadableUri(asset: MediaPickerResult): Promise<MediaPickerResult> {
  // Most cases are already fine (file://, content:// on Android, http(s):// on web)
  if (!asset.uri?.startsWith("ph://")) return asset;

  // Copy iOS Photos asset into app cache as a real file:// path
  const ext =
    asset.fileName?.split(".").pop()?.toLowerCase() ||
    (asset.mimeType?.includes("png") ? "png" :
     asset.mimeType?.includes("mp4") ? "mp4" :
     asset.mimeType?.includes("mov") ? "mov" :
     asset.mimeType?.includes("heic") ? "heic" : "jpg");

  const dest = `${FileSystem.cacheDirectory}${asset.kind}_${Date.now()}.${ext}`;
  await FileSystem.copyAsync({ from: asset.uri, to: dest });

  return { ...asset, uri: dest };
}

/**
 * Convert HEIC/HEIF images to JPEG for backend compatibility
 * Many backends don't support HEIC format which is common on iOS
 */
async function ensureSupportedImage(asset: MediaPickerResult): Promise<MediaPickerResult> {
  if (asset.kind !== "image") return asset;

  const mt = (asset.mimeType || "").toLowerCase();
  const name = (asset.fileName || "").toLowerCase();

  const isHeic = mt.includes("heic") || mt.includes("heif") || name.endsWith(".heic") || name.endsWith(".heif");
  if (!isHeic) return asset;

  try {
    const manipulated = await ImageManipulator.manipulateAsync(
      asset.uri,
      [],
      { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG }
    );

    return {
      ...asset,
      uri: manipulated.uri,
      mimeType: "image/jpeg",
      fileName: (asset.fileName || `image_${Date.now()}.heic`).replace(/\.(heic|heif)$/i, ".jpg"),
    };
  } catch (error) {
    console.warn("HEIC conversion failed, using original:", error);
    return asset;
  }
}

/**
 * Full asset processing pipeline: normalize -> uploadable URI -> supported format
 */
async function processAsset(asset: ImagePicker.ImagePickerAsset, includeBase64: boolean): Promise<MediaPickerResult> {
  const result = toResult(asset, includeBase64);
  const uploadable = await ensureUploadableUri(result);
  const supported = await ensureSupportedImage(uploadable);
  return supported;
}

/**
 * Pick media (image/video) with proper web/mobile handling
 * - Returns ONE asset if allowsMultipleSelection is false
 * - Returns MANY assets if allowsMultipleSelection is true
 */
export async function pickMedia(
  options: MediaPickerOptions = {}
): Promise<MediaPickerResult | MediaPickerMultiResult | null> {
  try {
    const merged = { ...DEFAULTS, ...options };
    const {
      mediaTypes,
      allowsEditing,
      quality,
      base64,
      allowsMultipleSelection,
      selectionLimit,
    } = merged;

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission Required",
        "Please grant camera roll permissions to upload media.",
        [{ text: "OK" }]
      );
      return null;
    }

    const pickerMediaTypes = mapPickerMediaTypes(mediaTypes);

    // Base64 on web is often not what you want; also huge for videos.
    const includeBase64 = Platform.OS !== "web" && base64;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: pickerMediaTypes,
      allowsEditing: Platform.OS !== "web" && allowsEditing && !allowsMultipleSelection, // editing + multi-select tends to be messy
      quality,
      base64: includeBase64,
      allowsMultipleSelection,
      selectionLimit: selectionLimit ?? (allowsMultipleSelection ? 10 : 1),
    });

    if (result.canceled || !result.assets?.length) return null;

    // Convert assets and ensure uploadable URIs (handles iOS ph:// URIs)
    if (allowsMultipleSelection) {
      const assets = await Promise.all(
        result.assets.map(async (a) => {
          const r = toResult(a, includeBase64);
          return ensureUploadableUri(r);
        })
      );
      return { assets };
    }

    const singleAsset = toResult(result.assets[0], includeBase64);
    return await ensureUploadableUri(singleAsset);
  } catch (error) {
    console.error("Media picker error:", error);
    Alert.alert("Upload Error", "Failed to pick media. Please try again.", [{ text: "OK" }]);
    return null;
  }
}

export async function pickImage(
  options: Omit<MediaPickerOptions, "mediaTypes"> = {}
) {
  return pickMedia({ ...options, mediaTypes: "Images" });
}

export async function pickVideo(
  options: Omit<MediaPickerOptions, "mediaTypes"> = {}
) {
  return pickMedia({ ...options, mediaTypes: "Videos" });
}

export async function takePhoto(
  options: MediaPickerOptions = {}
): Promise<MediaPickerResult | null> {
  try {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Required", "Please grant camera permissions to take photos.", [{ text: "OK" }]);
      return null;
    }

    const merged = { ...DEFAULTS, ...options };
    const { allowsEditing, quality, base64 } = merged;

    const includeBase64 = Platform.OS !== "web" && base64;

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: Platform.OS !== "web" && allowsEditing,
      quality,
      base64: includeBase64,
    });

    if (result.canceled || !result.assets?.length) return null;

    const asset = toResult(result.assets[0], includeBase64);
    return await ensureUploadableUri(asset);
  } catch (error) {
    console.error("Camera error:", error);
    Alert.alert("Camera Error", "Failed to take photo. Please try again.", [{ text: "OK" }]);
    return null;
  }
}

/**
 * Build a FormData file part correctly for React Native fetch/axios.
 * This is the #1 reason uploads break.
 */
export function asFormDataFile(asset: MediaPickerResult) {
  return {
    uri: asset.uri,
    name: asset.fileName || `upload_${Date.now()}`,
    type: asset.mimeType || "application/octet-stream",
  } as any;
}

/**
 * Show media picker options (Camera or Gallery)
 */
export async function showMediaOptions(
  onPicked: (result: MediaPickerResult) => void,
  mediaType: "Images" | "Videos" | "All" = "All"
): Promise<void> {
  if (Platform.OS === "web") {
    const res = await pickMedia({ mediaTypes: mediaType });
    if (res && !("assets" in res)) onPicked(res);
    return;
  }

  Alert.alert("Upload Media", "Choose an option", [
    {
      text: "Take Photo",
      onPress: async () => {
        const res = await takePhoto({ base64: false });
        if (res) onPicked(res);
      },
    },
    {
      text: "Choose from Gallery",
      onPress: async () => {
        const res = await pickMedia({ mediaTypes: mediaType, base64: false });
        if (res && !("assets" in res)) onPicked(res);
      },
    },
    { text: "Cancel", style: "cancel" },
  ]);
}
