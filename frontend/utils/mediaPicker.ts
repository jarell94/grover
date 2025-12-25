import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import * as ImageManipulator from "expo-image-manipulator";
import * as MediaLibrary from "expo-media-library";
import { Alert, Platform } from "react-native";

export type MediaKind = "image" | "video" | "audio" | "unknown";

// File size limits
const MAX_IMAGE_BYTES = 15 * 1024 * 1024; // 15MB
const MAX_VIDEO_BYTES = 250 * 1024 * 1024; // 250MB

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

  const mt = ((asset as any).mimeType || "").toLowerCase();
  const ext =
    kind === "image"
      ? (mt.includes("png") ? "png" : mt.includes("webp") ? "webp" : "jpg")
      : kind === "video"
      ? "mp4"
      : kind === "audio"
      ? "mp3"
      : "bin";

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
 * Uses expo-media-library for better iOS compatibility
 */
async function ensureUploadableUri(asset: MediaPickerResult): Promise<MediaPickerResult> {
  if (!asset.uri) return asset;

  // Android content:// and file:// are ok, web is ok
  if (!asset.uri.startsWith("ph://")) return asset;

  try {
    // ph://<assetId>
    const assetId = asset.uri.replace("ph://", "");
    const mlAsset = await MediaLibrary.getAssetInfoAsync(assetId);

    // On iOS this often returns localUri like file://...
    if (mlAsset.localUri) {
      return { ...asset, uri: mlAsset.localUri };
    }

    // Fallback: download/copy into cache if needed
    const ext =
      asset.fileName?.split(".").pop()?.toLowerCase() ||
      (asset.mimeType?.includes("png") ? "png" : "jpg");

    const dest = `${FileSystem.cacheDirectory}${asset.kind}_${Date.now()}.${ext}`;
    await FileSystem.copyAsync({ from: mlAsset.uri, to: dest });
    return { ...asset, uri: dest };
  } catch (e) {
    console.warn("ph:// conversion failed:", e);
    return asset; // fail soft
  }
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
 * Validate file size limits
 */
function assertSizeOk(a: MediaPickerResult): MediaPickerResult {
  if (!a.fileSize) return a;
  const max =
    a.kind === "image" ? MAX_IMAGE_BYTES :
    a.kind === "video" ? MAX_VIDEO_BYTES :
    50 * 1024 * 1024;

  if (a.fileSize > max) {
    throw new Error("File too large. Please choose a smaller file.");
  }
  return a;
}

/**
 * Full asset processing pipeline: normalize -> uploadable URI -> supported format -> size check
 */
async function processAsset(asset: ImagePicker.ImagePickerAsset, includeBase64: boolean): Promise<MediaPickerResult> {
  const result = toResult(asset, includeBase64);
  const uploadable = await ensureUploadableUri(result);
  const supported = await ensureSupportedImage(uploadable);
  return assertSizeOk(supported);
}

/**
 * Convert a MediaPickerResult to a FormData-compatible file object
 * Handles ph:// URIs and HEIC conversion automatically
 */
export async function asFormDataFile(asset: MediaPickerResult) {
  let a = await ensureUploadableUri(asset);
  a = await ensureSupportedImage(a);

  return {
    uri: a.uri,
    name: a.fileName || `upload_${Date.now()}`,
    type: a.mimeType || "application/octet-stream",
  } as any;
}

/**
 * Append media to FormData with proper web/native handling
 */
export async function appendToFormData(
  formData: FormData,
  field: string,
  asset: MediaPickerResult
) {
  if (Platform.OS === "web") {
    const res = await fetch(asset.uri);
    const blob = await res.blob();
    formData.append(field, blob as any, asset.fileName || `upload_${Date.now()}`);
    return;
  }

  const file = await asFormDataFile(asset);
  formData.append(field, file);
}

/**
 * Pick media (image/video) with proper web/mobile handling
 * - Returns ONE asset if allowsMultipleSelection is false
 * - Returns MANY assets if allowsMultipleSelection is true
 */
export async function pickMedia(options: MediaPickerOptions & { allowsMultipleSelection: true }): Promise<MediaPickerMultiResult | null>;
export async function pickMedia(options?: MediaPickerOptions & { allowsMultipleSelection?: false }): Promise<MediaPickerResult | null>;
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

    // allowsEditing: disabled on web, disabled with multi-select, only for images
    const shouldAllowEditing = Platform.OS !== "web" && 
      allowsEditing && 
      !allowsMultipleSelection && 
      pickerMediaTypes === ImagePicker.MediaTypeOptions.Images;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: pickerMediaTypes,
      allowsEditing: shouldAllowEditing,
      quality,
      base64: includeBase64,
      allowsMultipleSelection,
      selectionLimit: selectionLimit ?? (allowsMultipleSelection ? 10 : 1),
    });

    if (result.canceled || !result.assets?.length) return null;

    // Process all assets through the full pipeline
    if (allowsMultipleSelection) {
      const assets = await Promise.all(
        result.assets.map((a) => processAsset(a, includeBase64))
      );
      return { assets };
    }

    return await processAsset(result.assets[0], includeBase64);
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

    return await processAsset(result.assets[0], includeBase64);
  } catch (error) {
    console.error("Camera error:", error);
    Alert.alert("Camera Error", "Failed to take photo. Please try again.", [{ text: "OK" }]);
    return null;
  }
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
