// Uploads everything in 3dmodels/ to Vercel Blob storage, so the app can serve large splat/point
// cloud files from a CDN instead of bundling them into the repo/deployment.
//
// Usage:
//   1. Create a Blob store for this project on vercel.com (Storage tab) and copy its
//      "BLOB_READ_WRITE_TOKEN".
//   2. BLOB_READ_WRITE_TOKEN=vercel_blob_rw_xxx node scripts/upload-models.mjs
//   3. Set BLOB_BASE_URL in your environment (Vercel project settings, and .env.local for dev)
//      to the origin printed below, e.g. https://<id>.public.blob.vercel-storage.com
//      Once set, lib/estate-data.ts's modelUrl() serves from Blob instead of the local file.

import { createReadStream, statSync } from "node:fs";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { put } from "@vercel/blob";

const MODELS_DIR = path.join(process.cwd(), "3dmodels");

async function main() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error(
      "Missing BLOB_READ_WRITE_TOKEN. Create a Blob store at vercel.com (Storage tab), " +
        "copy its read/write token, and re-run as:\n" +
        "  BLOB_READ_WRITE_TOKEN=vercel_blob_rw_xxx node scripts/upload-models.mjs"
    );
    process.exit(1);
  }

  const files = (await readdir(MODELS_DIR)).filter((f) => f.toLowerCase().endsWith(".ply"));
  if (files.length === 0) {
    console.log(`No .ply files found in ${MODELS_DIR}`);
    return;
  }

  let baseUrl = null;
  for (const file of files) {
    const filePath = path.join(MODELS_DIR, file);
    const sizeMb = statSync(filePath).size / 1024 / 1024;
    console.log(`Uploading ${file} (${sizeMb.toFixed(1)} MB)...`);

    const blob = await put(file, createReadStream(filePath), {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      multipart: true,
      onUploadProgress: ({ percentage }) => process.stdout.write(`\r  ${percentage}%  `),
    });
    console.log(`\r  -> ${blob.url}`);
    baseUrl ??= new URL(blob.url).origin;
  }

  console.log(`\nDone. Set BLOB_BASE_URL=${baseUrl} in your environment (Vercel project env vars, and .env.local for local dev) to serve models from Blob.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
