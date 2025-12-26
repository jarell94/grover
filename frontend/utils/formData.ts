// FormData builders for uploads
import { Platform } from "react-native";

// Use the picker result shape instead of guessing from uri
export interface MediaFile {
  uri: string;
  mimeType?: string;
  fileName?: string;
  kind?: "image" | "video" | "audio" | "unknown";
}

/**
 * Append a file to FormData with proper cross-platform handling
 */
async function appendFileToFormData(
  formData: FormData,
  field: string,
  file: MediaFile,
  fallbackName = `upload_${Date.now()}`
) {
  const name = file.fileName || (file as any).name || fallbackName;
  const type = file.mimeType || (file as any).type || "application/octet-stream";

  if (Platform.OS === "web") {
    // Web requires Blob/File, not {uri, name, type}
    const res = await fetch(file.uri);
    const blob = await res.blob();
    formData.append(field, blob as any, name);
    return;
  }

  // Native (iOS/Android)
  formData.append(field, {
    uri: file.uri,
    name,
    type,
  } as any);
}

/**
 * Build FormData for creating a post
 */
export async function buildPostFormData(options: {
  content: string;
  media?: MediaFile | null;
  taggedUsers?: string;
  location?: string;
  pollQuestion?: string;
  pollOptions?: string[];
  pollDurationHours?: number;
}): Promise<FormData> {
  const formData = new FormData();

  formData.append("content", options.content.trim() || "");

  if (options.taggedUsers?.trim()) formData.append("tagged_users", options.taggedUsers.trim());
  if (options.location?.trim()) formData.append("location", options.location.trim());

  if (options.pollQuestion?.trim()) {
    formData.append("poll_question", options.pollQuestion.trim());
    if (options.pollOptions) formData.append("poll_options", JSON.stringify(options.pollOptions.filter(o => o.trim())));
    if (options.pollDurationHours) formData.append("poll_duration_hours", String(options.pollDurationHours));
  }

  if (options.media?.uri) {
    await appendFileToFormData(formData, "media", options.media, "media_upload");
  }

  return formData;
}

/**
 * Build FormData for creating a product
 */
export async function buildProductFormData(options: {
  name: string;
  description: string;
  price: string;
  productType?: "physical" | "digital" | "service";
  serviceDuration?: number;
  digitalFileUrl?: string;
  image?: MediaFile | null;
}): Promise<FormData> {
  const formData = new FormData();

  formData.append("name", options.name);
  formData.append("description", options.description);
  formData.append("price", options.price);

  if (options.productType) formData.append("product_type", options.productType);
  if (options.serviceDuration) formData.append("service_duration", String(options.serviceDuration));
  if (options.digitalFileUrl) formData.append("digital_file_url", options.digitalFileUrl);

  if (options.image?.uri) {
    await appendFileToFormData(formData, "image", options.image, "product_image");
  }

  return formData;
}

/**
 * Build FormData for creating a story
 */
export async function buildStoryFormData(options: {
  media: MediaFile;
  caption?: string;
}): Promise<FormData> {
  const formData = new FormData();

  if (options.caption?.trim()) formData.append("caption", options.caption.trim());

  await appendFileToFormData(formData, "media", options.media, "story_media");

  // Tell backend media_type based on mimeType
  const mt = (options.media.mimeType || (options.media as any).type || "").toLowerCase();
  const mediaType =
    mt.startsWith("video/") ? "video" :
    mt.startsWith("audio/") ? "audio" :
    "image";

  formData.append("media_type", mediaType);

  return formData;
}

/**
 * Build FormData for profile picture upload
 */
export async function buildProfilePictureFormData(options: {
  image: MediaFile;
}): Promise<FormData> {
  const formData = new FormData();

  await appendFileToFormData(formData, "profile_picture", options.image, "profile_picture");

  return formData;
}

/**
 * Build FormData for voice/video message
 */
export async function buildMessageMediaFormData(options: {
  media: MediaFile;
  conversationId: string;
}): Promise<FormData> {
  const formData = new FormData();

  formData.append("conversation_id", options.conversationId);

  const mt = (options.media.mimeType || "").toLowerCase();
  const messageType =
    mt.startsWith("video/") ? "video" :
    mt.startsWith("audio/") ? "voice" :
    "file";

  formData.append("message_type", messageType);

  await appendFileToFormData(formData, "media", options.media, `${messageType}_message`);

  return formData;
}
