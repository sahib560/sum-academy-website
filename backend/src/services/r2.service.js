import fs from "fs";
import { S3Client, PutObjectCommand, DeleteObjectCommand, HeadObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const accountId = process.env.R2_ACCOUNT_ID || "";
const accessKeyId = process.env.R2_ACCESS_KEY_ID || "";
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY || "";
export const bucketName = process.env.R2_BUCKET_NAME || "";
const publicUrl = process.env.R2_PUBLIC_URL || "";

// Configure the S3 Client for Cloudflare R2
const s3Client = new S3Client({
  region: "auto",
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
});

export const getPublicUrl = (key) => {
  const baseUrl = publicUrl.endsWith("/") ? publicUrl.slice(0, -1) : publicUrl;
  return `${baseUrl}/${key}`;
};

export const extractR2KeyFromUrl = (url = "") => {
  if (!url) return "";
  const baseUrl = publicUrl.endsWith("/") ? publicUrl.slice(0, -1) : publicUrl;
  if (url.startsWith(baseUrl + "/")) {
    return url.replace(baseUrl + "/", "").split("?")[0];
  }
  return url;
};

export const uploadToR2 = async ({ fileBuffer, key, contentType, metadata = {} }) => {
  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    Body: fileBuffer,
    ContentType: contentType,
    Metadata: metadata,
  });

  await s3Client.send(command);
  return {
    url: getPublicUrl(key),
    key,
  };
};

export const uploadFileToR2FromPath = async (localPath, key, contentType, metadata = {}) => {
  const fileStream = fs.createReadStream(localPath);
  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    Body: fileStream,
    ContentType: contentType,
    Metadata: metadata,
  });

  await s3Client.send(command);
  return {
    url: getPublicUrl(key),
    key,
  };
};

export const deleteFromR2 = async (keyOrUrl) => {
  const key = extractR2KeyFromUrl(keyOrUrl);
  if (!key) return;

  const command = new DeleteObjectCommand({
    Bucket: bucketName,
    Key: key,
  });

  try {
    await s3Client.send(command);
  } catch (error) {
    console.error("Failed to delete from R2:", error);
  }
};

export const checkR2ObjectExists = async (key) => {
  try {
    const command = new HeadObjectCommand({
      Bucket: bucketName,
      Key: key,
    });
    const response = await s3Client.send(command);
    return { exists: true, metadata: response };
  } catch (error) {
    if (error.name === "NotFound") {
      return { exists: false };
    }
    throw error;
  }
};

export const getR2PresignedUrl = async (key, expiresInSeconds = 7200) => {
  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: key,
  });
  return await getSignedUrl(s3Client, command, { expiresIn: expiresInSeconds });
};

export const streamFromR2 = async (key, rangeHeader, res) => {
  try {
    // 1. Get object metadata first
    const headCommand = new HeadObjectCommand({
      Bucket: bucketName,
      Key: key,
    });
    let metadata;
    try {
      metadata = await s3Client.send(headCommand);
    } catch (err) {
      if (err.name === "NotFound") {
        return res.status(404).json({ error: "File not found" });
      }
      throw err;
    }

    const fileSize = metadata.ContentLength;
    const mimeType = metadata.ContentType || "application/octet-stream";

    let getCommandParams = {
      Bucket: bucketName,
      Key: key,
    };

    if (rangeHeader) {
      const parts = rangeHeader.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = end - start + 1;

      getCommandParams.Range = `bytes=${start}-${end}`;

      res.writeHead(206, {
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": chunkSize,
        "Content-Type": mimeType,
        "Cache-Control": "no-cache",
        "X-Frame-Options": "DENY",
      });
    } else {
      res.writeHead(200, {
        "Content-Length": fileSize,
        "Content-Type": mimeType,
        "Accept-Ranges": "bytes",
        "Cache-Control": "no-cache",
        "X-Frame-Options": "DENY",
      });
    }

    const command = new GetObjectCommand(getCommandParams);
    const response = await s3Client.send(command);

    // Pipe the readable stream from the response body to the express response
    response.Body.pipe(res);
    response.Body.on("error", (err) => {
      console.error("S3 stream error:", err);
      if (!res.headersSent) res.status(500).end();
    });

  } catch (error) {
    console.error("streamFromR2 error:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: "Stream failed" });
    }
  }
};
