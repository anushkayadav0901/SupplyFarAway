import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";
import { Storage } from "@google-cloud/storage";
import vision from "@google-cloud/vision";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let storage: Storage;
let visionClient: vision.ImageAnnotatorClient;

if (process.env.NODE_ENV === "production") {
  let credentials: Record<string, unknown>;
  // Accept either the new explicit name or the legacy ENV name for backward compatibility
  const credentialsJson = process.env.GOOGLE_CLOUD_CREDENTIALS_JSON ?? process.env.ENV ?? "";
  try {
    credentials = JSON.parse(credentialsJson);
  } catch (error) {
    console.error("Failed to parse credentials from GOOGLE_CLOUD_CREDENTIALS_JSON:", error);
    throw new Error(
      "Unable to load Google Cloud credentials from environment variable"
    );
  }

  storage = new Storage({ credentials });
  visionClient = new vision.ImageAnnotatorClient({ credentials });
} else {
  // Local development: load from JSON file. The legacy file lives at
  // backend/Config/supplychain-upload.json. From backend/src/config/multer.ts,
  // we resolve up two directories: ../../Config/supplychain-upload.json
  const localPath = path.resolve(__dirname, "../../Config/supplychain-upload.json");
  const credentials = JSON.parse(fs.readFileSync(localPath, "utf8"));

  storage = new Storage({ credentials });
  visionClient = new vision.ImageAnnotatorClient({ credentials });
}

const upload = multer({ storage: multer.memoryStorage() });

export { upload, storage, visionClient };
export default upload;
