// Shared image upload helper. Validates type + size and returns a base64 data URL
// so the result can be stored in component state without a backend.

export const readFileAsDataUrl = (file: File): Promise<string> => new Promise((resolve, reject) => {
  if (!file.type.startsWith('image/')) { reject(new Error('Please choose an image file.')); return; }
  if (file.size > 1.5 * 1024 * 1024) { reject(new Error('Image must be under 1.5 MB.')); return; }
  const fr = new FileReader();
  fr.onload = () => resolve(fr.result as string);
  fr.onerror = () => reject(new Error('Could not read file.'));
  fr.readAsDataURL(file);
});

export const onPickImage = async (
  file: File,
  setter: (url: string) => void,
  onError?: (msg: string) => void,
): Promise<void> => {
  try {
    const url = await readFileAsDataUrl(file);
    setter(url);
  } catch (err: any) {
    if (onError) onError(err.message || 'Image could not be loaded.');
  }
};
