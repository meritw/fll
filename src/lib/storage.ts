import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export const MAX_PROGRAM_BYTES = 32 * 1024 * 1024;
const UPLOAD_CONTENT_TYPE = "application/octet-stream";

type StorageConfig = {
  accessKeyId: string;
  secretAccessKey: string;
  endpoint: string;
  region: string;
  bucket: string;
};

export function storageConfig(): StorageConfig | null {
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  const endpoint = process.env.AWS_ENDPOINT_URL_S3;
  const region = process.env.AWS_REGION;
  const bucket = process.env.NEON_STORAGE_BUCKET;
  if (!accessKeyId || !secretAccessKey || !endpoint || !region || !bucket) {
    return null;
  }
  return { accessKeyId, secretAccessKey, endpoint, region, bucket };
}

let client: S3Client | null = null;

function getClient(config: StorageConfig) {
  if (!client) {
    client = new S3Client({
      region: config.region,
      endpoint: config.endpoint,
      forcePathStyle: true,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
    });
  }
  return client;
}

export function objectKeyForUser(userId: string) {
  return `programs/${userId}/${crypto.randomUUID()}.llsp3`;
}

export function isOwnedProgramKey(userId: string, key: string) {
  if (!userId || userId.includes("/") || userId.includes("..")) {
    return false;
  }
  const prefix = `programs/${userId}/`;
  if (!key.startsWith(prefix)) {
    return false;
  }
  const rest = key.slice(prefix.length);
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.llsp3$/i.test(rest);
}

export async function presignProgramUpload(key: string, contentLength: number) {
  const config = storageConfig();
  if (!config) {
    return null;
  }
  const command = new PutObjectCommand({
    Bucket: config.bucket,
    Key: key,
    ContentType: UPLOAD_CONTENT_TYPE,
    ContentLength: contentLength,
  });
  const url = await getSignedUrl(getClient(config), command, { expiresIn: 15 * 60 });
  return { url, contentType: UPLOAD_CONTENT_TYPE };
}

export async function headProgramObject(key: string) {
  const config = storageConfig();
  if (!config) {
    return null;
  }
  const result = await getClient(config).send(
    new HeadObjectCommand({ Bucket: config.bucket, Key: key }),
  );
  return { size: result.ContentLength ?? 0 };
}

export async function openProgramObject(key: string) {
  const config = storageConfig();
  if (!config) {
    return null;
  }
  try {
    const result = await getClient(config).send(
      new GetObjectCommand({ Bucket: config.bucket, Key: key }),
    );
    if (!result.Body) {
      return null;
    }
    return result.Body.transformToWebStream();
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    if (name === "NotFound" || name === "NoSuchKey") {
      return null;
    }
    throw error;
  }
}
