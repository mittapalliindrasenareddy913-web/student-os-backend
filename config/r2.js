const { S3Client } = require('@aws-sdk/client-s3');
const dotenv = require('dotenv');

dotenv.config();

const s3Client = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
  forcePathStyle: true, // required for Cloudflare R2
});

module.exports = {
  s3Client,
  bucketName: process.env.R2_BUCKET_NAME || 'isr-storage',
  publicUrl: process.env.R2_PUBLIC_URL || 'https://pub-320ac8c2fd92405fa47369a442214a34.r2.dev'
};
