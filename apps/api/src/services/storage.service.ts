import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import sharp from "sharp";
import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";

// ── Config ────────────────────────────────────────────────────

const USE_S3 = !!(
  process.env.AWS_ACCESS_KEY_ID &&
  process.env.AWS_SECRET_ACCESS_KEY &&
  process.env.S3_BUCKET
);

const S3_BUCKET = process.env.S3_BUCKET ?? "qrsaas-assets";
const S3_REGION = process.env.AWS_REGION ?? "us-east-1";
const CDN_URL = process.env.CDN_URL; // optional CloudFront prefix

// Local storage fallback (dev mode)
const LOCAL_UPLOADS_DIR = path.join(process.cwd(), "public", "uploads");

let s3Client: S3Client | null = null;
if (USE_S3) {
  s3Client = new S3Client({ region: S3_REGION });
}

// ── Image processing config ───────────────────────────────────

const IMAGE_PRESETS = {
  logo: { width: 400, height: 400, fit: "cover" as const },
  cover: { width: 1200, height: 400, fit: "cover" as const },
  menu_item: { width: 800, height: 600, fit: "cover" as const },
  category: { width: 600, height: 400, fit: "cover" as const },
  avatar: { width: 200, height: 200, fit: "cover" as const },
} as const;

export type ImagePreset = keyof typeof IMAGE_PRESETS;

export interface UploadResult {
  url: string;
  key: string;
  size: number;
  mimeType: string;
}

// ── Helpers ───────────────────────────────────────────────────

function buildKey(
  restaurantId: string,
  folder: string,
  filename: string
): string {
  return `restaurants/${restaurantId}/${folder}/${filename}`;
}

function buildPublicUrl(key: string): string {
  if (CDN_URL) return `${CDN_URL}/${key}`;
  return `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${key}`;
}

async function processImage(
  buffer: Buffer,
  preset: ImagePreset
): Promise<{ buffer: Buffer; mimeType: string }> {
  const { width, height, fit } = IMAGE_PRESETS[preset];
  const processed = await sharp(buffer)
    .resize(width, height, { fit, position: "centre" })
    .webp({ quality: 85 })
    .toBuffer();
  return { buffer: processed, mimeType: "image/webp" };
}

function ensureLocalDir(): void {
  if (!fs.existsSync(LOCAL_UPLOADS_DIR)) {
    fs.mkdirSync(LOCAL_UPLOADS_DIR, { recursive: true });
  }
}

// ── Storage Service ───────────────────────────────────────────

export class StorageService {
  /**
   * Upload an image buffer, resize it, and store in S3 (prod) or local fs (dev).
   */
  async uploadImage(
    buffer: Buffer,
    restaurantId: string,
    folder: string,
    preset: ImagePreset
  ): Promise<UploadResult> {
    const { buffer: processed, mimeType } = await processImage(buffer, preset);
    const filename = `${uuidv4()}.webp`;
    const key = buildKey(restaurantId, folder, filename);

    if (USE_S3 && s3Client) {
      await s3Client.send(
        new PutObjectCommand({
          Bucket: S3_BUCKET,
          Key: key,
          Body: processed,
          ContentType: mimeType,
          CacheControl: "public, max-age=31536000",
        })
      );
      return { url: buildPublicUrl(key), key, size: processed.length, mimeType };
    }

    // Local fallback
    ensureLocalDir();
    const localPath = path.join(LOCAL_UPLOADS_DIR, filename);
    fs.writeFileSync(localPath, processed);
    const appUrl = process.env.APP_URL ?? "http://localhost:3001";
    return {
      url: `${appUrl}/uploads/${filename}`,
      key,
      size: processed.length,
      mimeType,
    };
  }

  /**
   * Delete an object by key from S3 (no-op in local mode).
   */
  async deleteObject(key: string): Promise<void> {
    if (!USE_S3 || !s3Client) {
      // Delete local file if key maps to a filename
      const filename = path.basename(key);
      const localPath = path.join(LOCAL_UPLOADS_DIR, filename);
      if (fs.existsSync(localPath)) fs.unlinkSync(localPath);
      return;
    }
    await s3Client.send(
      new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: key })
    );
  }

  /**
   * Generate a presigned URL for direct browser → S3 upload (future use).
   */
  async getPresignedUploadUrl(
    key: string,
    mimeType: string,
    expiresIn = 300
  ): Promise<string> {
    if (!USE_S3 || !s3Client) {
      throw new Error("Presigned URLs only available in S3 mode");
    }
    const command = new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      ContentType: mimeType,
    });
    return getSignedUrl(s3Client, command, { expiresIn });
  }

  get isS3Mode(): boolean {
    return USE_S3;
  }
}

export const storageService = new StorageService();
