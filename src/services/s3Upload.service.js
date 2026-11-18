const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");

const crypto = require("crypto");

const path = require("path");



const AWS_REGION = String(process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "").trim();

const AWS_ACCESS_KEY_ID = String(process.env.AWS_ACCESS_KEY_ID || "").trim();

const AWS_SECRET_ACCESS_KEY = String(process.env.AWS_SECRET_ACCESS_KEY || "").trim();

const S3_MENU_BUCKET = String(process.env.S3_MENU_BUCKET || "").trim();

const S3_PUBLIC_BASE_URL = String(process.env.S3_PUBLIC_BASE_URL || "").trim();



function isS3Configured() {

  return Boolean(AWS_REGION && AWS_ACCESS_KEY_ID && AWS_SECRET_ACCESS_KEY && S3_MENU_BUCKET);

}



let s3Client;



function getS3Client() {

  if (!isS3Configured()) return null;

  if (!s3Client) {

    s3Client = new S3Client({

      region: AWS_REGION,

      credentials: {

        accessKeyId: AWS_ACCESS_KEY_ID,

        secretAccessKey: AWS_SECRET_ACCESS_KEY,

      },

    });

  }

  return s3Client;

}



function guessExtension(fileName, contentType) {

  const ext = path.extname(String(fileName || "")).toLowerCase();

  if (ext && ext.length <= 6) return ext;

  const mime = String(contentType || "").toLowerCase();

  if (mime.includes("png")) return ".png";

  if (mime.includes("webp")) return ".webp";

  if (mime.includes("gif")) return ".gif";

  return ".jpg";

}



function buildPublicUrl(bucket, key) {

  if (S3_PUBLIC_BASE_URL) {

    return `${S3_PUBLIC_BASE_URL.replace(/\/$/, "")}/${key}`;

  }

  return `https://${bucket}.s3.${AWS_REGION}.amazonaws.com/${key}`;

}



/**

 * Upload an image buffer to the menu bucket.

 * @returns {Promise<{ publicUrl: string, key: string, contentType: string, contentLength: number }>}

 */

async function uploadImageToS3(file, keyPrefix) {
  const client = getS3Client();
  if (!client) {
    const err = new Error("S3 is not configured");
    err.status = 503;
    err.code = "S3_NOT_CONFIGURED";
    throw err;
  }

  const contentType = String(file.mimetype || "image/jpeg").split(";")[0].trim() || "image/jpeg";
  if (!contentType.startsWith("image/")) {
    const err = new Error("File must be an image");
    err.status = 400;
    throw err;
  }

  const ext = guessExtension(file.originalname, contentType);
  const prefix = String(keyPrefix || "uploads").replace(/\/$/, "");
  const key = `${prefix}/${Date.now()}-${crypto.randomBytes(8).toString("hex")}${ext}`;

  await client.send(
    new PutObjectCommand({
      Bucket: S3_MENU_BUCKET,
      Key: key,
      Body: file.buffer,
      ContentType: contentType,
    }),
  );

  return {
    publicUrl: buildPublicUrl(S3_MENU_BUCKET, key),
    key,
    contentType,
    contentLength: file.size,
  };
}

async function uploadMenuImage(file) {
  return uploadImageToS3(file, "menu");
}

async function uploadRoomImage(file) {
  return uploadImageToS3(file, "rooms");
}

async function uploadVenueImage(file) {
  return uploadImageToS3(file, "event-venues");
}



module.exports = {
  isS3Configured,
  uploadMenuImage,
  uploadRoomImage,
  uploadVenueImage,
  S3_MENU_BUCKET,
};


