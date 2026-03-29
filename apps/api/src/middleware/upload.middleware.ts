import multer, { FileFilterCallback } from "multer";
import { Request } from "express";

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
];

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

const storage = multer.memoryStorage();

function fileFilter(
  _req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback
): void {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      Object.assign(
        new Error(`Unsupported file type: ${file.mimetype}. Allowed: jpeg, png, webp, gif`),
        { statusCode: 415 }
      )
    );
  }
}

export const uploadSingle = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE },
}).single("file");

export const uploadSingleMiddleware = (
  fieldName = "file"
) =>
  multer({
    storage,
    fileFilter,
    limits: { fileSize: MAX_FILE_SIZE },
  }).single(fieldName);
