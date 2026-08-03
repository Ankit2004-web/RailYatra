const MAX_SOURCE_BYTES = 10 * 1024 * 1024;
const OUTPUT_MAX_PX = 512;
const OUTPUT_QUALITY = 0.85;
const SUPPORTED_EXT = /\.(jpe?g|png|webp|gif|bmp)$/i;
const HEIC_EXT = /\.(heic|heif)$/i;

export function isSupportedAvatarFile(file) {
  if (!file) return false;
  const type = (file.type || '').toLowerCase();
  if (/image\/(heic|heif)/.test(type)) return false;
  if (type.startsWith('image/')) return true;
  const name = (file.name || '').toLowerCase();
  if (HEIC_EXT.test(name)) return false;
  return SUPPORTED_EXT.test(name);
}

const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = () => reject(new Error('Could not read image file'));
  reader.readAsDataURL(file);
});

const loadImage = (src) => new Promise((resolve, reject) => {
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = () => reject(new Error('Could not decode image. Use JPG or PNG.'));
  img.src = src;
});

export async function compressImageForAvatar(file) {
  if (file.size > MAX_SOURCE_BYTES) {
    throw new Error('Image must be under 10 MB.');
  }

  const name = (file.name || '').toLowerCase();
  const type = (file.type || '').toLowerCase();
  if (/image\/(heic|heif)/.test(type) || HEIC_EXT.test(name)) {
    throw new Error('HEIC photos are not supported. Save as JPG or PNG and try again.');
  }
  if (!isSupportedAvatarFile(file)) {
    throw new Error('Please choose a PNG, JPG, or WEBP image.');
  }

  const dataUrl = await readFileAsDataUrl(file);
  const img = await loadImage(dataUrl);

  if (!img.width || !img.height) {
    throw new Error('Image appears to be empty or corrupted.');
  }

  const longest = Math.max(img.width, img.height);
  const scale = longest > OUTPUT_MAX_PX ? OUTPUT_MAX_PX / longest : 1;
  const width = Math.max(1, Math.round(img.width * scale));
  const height = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not process image');
  }

  ctx.drawImage(img, 0, 0, width, height);
  return canvas.toDataURL('image/jpeg', OUTPUT_QUALITY);
}
