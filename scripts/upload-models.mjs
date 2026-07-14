// Uploads everything in 3dmodels/ to Vercel Blob storage, so the app can serve large splat/point
// cloud files from a CDN instead of bundling them into the repo/deployment.
//
// Usage:
//   1. Create a Blob store for this project on vercel.com (Storage tab, Public access) and copy
//      its "BLOB_READ_WRITE_TOKEN".
//   2. Set BLOB_PATHNAME_SALT to any random secret string (kept out of git) - it's mixed into the
//      hash below so blob URLs don't reveal the original filename and can't be recomputed by
//      anyone who doesn't have it.
//   3. BLOB_READ_WRITE_TOKEN=vercel_blob_rw_xxx BLOB_PATHNAME_SALT=xxx node scripts/upload-models.mjs
//   4. Set BLOB_BASE_URL in your environment (Vercel project settings, and .env.local for dev)
//      to the origin printed below, e.g. https://<id>.public.blob.vercel-storage.com
//      Once BLOB_BASE_URL and BLOB_PATHNAME_SALT are both set, lib/estate-data.ts's modelUrl()
//      serves from Blob instead of the local file.

import { createHash } from "node:crypto";
import { createReadStream, statSync } from "node:fs";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { put } from "@vercel/blob";

const MODELS_DIR = path.join(process.cwd(), "3dmodels");

// Deterministic (same input -> same output) so re-running this script updates the same blob
// instead of leaving old ones behind, but unrecoverable without the salt. Keep this in sync with
// the identical function in lib/estate-data.ts.
function blobPathname(modelFile, salt) {
  const ext = modelFile.slice(modelFile.lastIndexOf("."));
  const hash = createHash("sha256").update(`${salt}:${modelFile}`).digest("hex").slice(0, 32);
  return `${hash}${ext}`;
}

async function main() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error(
      "Missing BLOB_READ_WRITE_TOKEN. Create a Blob store at vercel.com (Storage tab, Public access), " +
        "copy its read/write token, and re-run with it set."
    );
    process.exit(1);
  }
  const salt = process.env.BLOB_PATHNAME_SALT;
  if (!salt) {
    console.error(
      "Missing BLOB_PATHNAME_SALT. Set it to any random secret string (kept out of git) so " +
        "uploaded blob URLs don't reveal the original filename, then re-run."
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
    const sizeBytes = statSync(filePath).size;
    const pathname = blobPathname(file, salt);
    console.log(`Uploading ${file} (${(sizeBytes / 1024 / 1024).toFixed(1)} MB) as ${pathname}...`);

    const blob = await put(pathname, createReadStream(filePath), {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      multipart: true,
      onUploadProgress: ({ percentage }) => process.stdout.write(`\r  ${percentage}%  `),
    });
    console.log(`\r  -> ${blob.url}`);
    // Vercel Blob serves large files dynamically Brotli-compressed with no Content-Length header,
    // so the browser can't learn the size on its own - paste this into the matching House's
    // modelSizeBytes in lib/estate-data.ts so download progress can be shown at all.
    console.log(`     modelSizeBytes: ${sizeBytes},`);
    baseUrl ??= new URL(blob.url).origin;
  }

  console.log(`\nDone. Set BLOB_BASE_URL=${baseUrl} in your environment (Vercel project env vars, and .env.local for local dev) to serve models from Blob.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
