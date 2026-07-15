/**
 * Utility for client-side image compression.
 * Uses the Canvas API to resize and re-encode images to WebP format.
 */

export async function compressImage(file, { maxWidth = 1920, maxHeight = 1080, quality = 0.8 } = {}) {
    // Return original file if it's not an image or if it's a GIF (to preserve animation)
    if (!file.type.startsWith('image/') || file.type === 'image/gif' || file.type.startsWith('video/')) {
        return file;
    }

    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                let width = img.width;
                let height = img.height;

                // Calculate aspect ratio and resize if necessary
                if (width > maxWidth || height > maxHeight) {
                    if (width / height > maxWidth / maxHeight) {
                        height = Math.round(height * maxWidth / width);
                        width = maxWidth;
                    } else {
                        width = Math.round(width * maxHeight / height);
                        height = maxHeight;
                    }
                }

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                
                // Draw image on canvas
                ctx.drawImage(img, 0, 0, width, height);

                // Convert to WebP
                canvas.toBlob((blob) => {
                    if (!blob) {
                        reject(new Error('Canvas to Blob conversion failed'));
                        return;
                    }
                    
                    // Create new File object from Blob
                    const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, ".webp"), {
                        type: 'image/webp',
                        lastModified: Date.now()
                    });
                    
                    resolve(compressedFile);
                }, 'image/webp', quality);
            };
            img.onerror = (error) => reject(error);
        };
        reader.onerror = (error) => reject(error);
    });
}
