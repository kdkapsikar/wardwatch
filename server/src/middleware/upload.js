import multer from 'multer';
import { config } from '../config.js';

// Files are buffered in memory (max 5 x 5 MB per request), validated by magic
// bytes in lib/files.js, and only then written to disk - so a rejected request
// never leaves files behind.
const uploader = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.maxPhotoBytes, files: config.maxPhotos, fields: 20, fieldSize: 10 * 1024 },
});

/** Accepts up to 5 images in the `photos` field; populates req.files and req.body. */
export const photosUpload = uploader.array('photos', config.maxPhotos);
