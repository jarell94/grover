/**
 * Normalize remote URLs to ensure they have proper scheme
 * Handles Cloudinary URLs that might be missing https://
 */
export function normalizeRemoteUrl(url?: string): string {
  if (!url) return "";

  const u = url.trim();

  // Already has valid scheme
  if (
    u.startsWith("http://") ||
    u.startsWith("https://") ||
    u.startsWith("file://") ||
    u.startsWith("content://") ||
    u.startsWith("ph://") ||
    u.startsWith("blob:") ||
    u.startsWith("data:")
  ) {
    return u;
  }

  // Protocol-relative URLs (//example.com/...)
  if (u.startsWith("//")) {
    return `https:${u}`;
  }

  // Cloudinary URLs missing scheme
  if (u.startsWith("res.cloudinary.com/") || u.includes("cloudinary.com/")) {
    return `https://${u}`;
  }

  // Other URLs that look like they need https
  if (u.includes(".com/") || u.includes(".io/") || u.includes(".net/")) {
    return `https://${u}`;
  }

  return u; // fallback - return as-is
}

/**
 * Check if string is a valid media URL
 */
export function isValidMediaUrl(url: string): boolean {
  return (
    url.startsWith("http://") ||
    url.startsWith("https://") ||
    url.startsWith("file://") ||
    url.startsWith("content://") ||
    url.startsWith("blob:") ||
    url.startsWith("data:")
  );
}

/**
 * Generate Cloudinary video thumbnail URL from video URL
 */
export function getCloudinaryVideoThumbnail(videoUrl: string): string {
  if (!videoUrl.includes("cloudinary.com")) return "";
  
  // Replace /video/upload/ with /video/upload/so_0,f_jpg/ for first frame thumbnail
  return videoUrl.replace(
    "/video/upload/",
    "/video/upload/so_0,f_jpg,w_400,h_400,c_fill/"
  ).replace(/\.(mp4|mov|webm|avi)$/i, ".jpg");
}

/**
 * Generate Cloudinary optimized image URL
 */
export function getCloudinaryOptimizedImage(imageUrl: string, width = 800): string {
  if (!imageUrl.includes("cloudinary.com")) return imageUrl;
  
  // Add transformation for auto format and quality
  return imageUrl.replace(
    "/image/upload/",
    `/image/upload/f_auto,q_auto,w_${width}/`
  );
}
