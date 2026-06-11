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
  // Local development: load from JSON file if it exists, otherwise use mock credentials
  const localPath = path.resolve(__dirname, "../../Config/supplychain-upload.json");
  
  let credentials: Record<string, unknown>;
  if (fs.existsSync(localPath)) {
    credentials = JSON.parse(fs.readFileSync(localPath, "utf8"));
    storage = new Storage({ credentials });
    visionClient = new vision.ImageAnnotatorClient({ credentials });
  } else {
    console.warn("⚠️  Google Cloud credentials file not found. Image upload features will be disabled.");
    console.warn("   To enable, create: backend/Config/supplychain-upload.json");
    // Initialize with empty credentials for development (features will fail gracefully)
    storage = new Storage({ projectId: 'dev-project' });
    visionClient = new vision.ImageAnnotatorClient();
  }
}

const upload = multer({ storage: multer.memoryStorage() });

export { upload, storage, visionClient };
export default upload;
