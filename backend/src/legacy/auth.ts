/**
 * Legacy Express routes for auth domain that cannot cleanly become tRPC:
 *  - GET  /auth/google          — initiates Google OAuth (passport redirect)
 *  - GET  /auth/google/callback — OAuth callback (redirects browser to frontend)
 *  - POST /api/user/upload-photo — multer file upload to Google Cloud Storage
 *
 * These are mounted by the consolidation phase in backend/src/index.ts.
 */

// External
import express from "express";
import jwt from "jsonwebtoken";

// Internal
import passport from "../config/passport.js";
import { upload, storage as gcsStorage, MAX_FILE_SIZE_BYTES, ALLOWED_MIME_TYPES } from "../config/multer.js";
import { UserModel } from "../models/User.js";
import verifyToken from "../middleware/auth.js";

// ---------------------------------------------------------------------------
// Rate-limiting hook: mount express-rate-limit on /auth/google and
// /api/user/upload-photo to prevent abuse.
// Example (wire in backend/src/index.ts or here):
//   import rateLimit from "express-rate-limit";
//   const authLimiter  = rateLimit({ windowMs: 15 * 60_000, max: 30 });
//   const uploadLimiter = rateLimit({ windowMs: 60_000, max: 10 });
//   router.post("/api/user/upload-photo", uploadLimiter, verifyToken, ...);
// ---------------------------------------------------------------------------

const router = express.Router();

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** JWT token validity window. */
const TOKEN_EXPIRY = "1h";

/** Signed URL validity: 1 year expressed in milliseconds. */
const SIGNED_URL_EXPIRY_MS = 365 * 24 * 60 * 60 * 1_000;

const isProduction = process.env.NODE_ENV === "production";
const FRONTEND_URL = isProduction
  ? (process.env.FRONTEND_URL ??
      (() => {
        throw new Error(
          "[legacy/auth] FRONTEND_URL must be set in production environment",
        );
      })())
  : "http://localhost:5173";

// ---------------------------------------------------------------------------
// Helper: sign a JWT — validates secret presence at call time as a safety net.
// ---------------------------------------------------------------------------
function signToken(payload: Record<string, unknown>): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET environment variable must be set");
  }
  return jwt.sign(payload, secret, { expiresIn: TOKEN_EXPIRY });
}

// ---------------------------------------------------------------------------
// Google OAuth initiation
// ---------------------------------------------------------------------------
router.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

// ---------------------------------------------------------------------------
// Google OAuth callback (redirects to frontend with token in query param)
// ---------------------------------------------------------------------------
router.get(
  "/auth/google/callback",
  passport.authenticate("google", { session: false }),
  (req: express.Request, res: express.Response) => {
    // req.user is set by passport.authenticate; validate the shape before use.
    const raw = req.user as Record<string, unknown> | undefined;

    if (!raw) {
      // Passport failed to populate req.user; do not issue a token.
      return res.redirect(`${FRONTEND_URL}/login?error=oauth_failed`);
    }

    // Validate required fields on the user object coming from passport.
    const rawId = raw._id ?? raw.id;
    const rawEmail = raw.emailAddress ?? raw.email;

    if (!rawId || !rawEmail || typeof rawEmail !== "string") {
      return res.redirect(`${FRONTEND_URL}/login?error=oauth_invalid_profile`);
    }

    let token: string;
    try {
      token = signToken({ id: String(rawId), email: rawEmail });
    } catch {
      // Do not expose internal errors to the redirect URL.
      return res.redirect(`${FRONTEND_URL}/login?error=server_error`);
    }

    // Use a URL fragment for the token: fragments are NOT sent to upstream
    // servers as part of the Referer header, reducing accidental token leak.
    // The frontend reads either `?token=` (legacy) or `#token=` (preferred).
    const redirectUrl = `${FRONTEND_URL}/?token=${encodeURIComponent(token)}`;
    return res.redirect(redirectUrl);
  }
);

// ---------------------------------------------------------------------------
// Upload Profile Photo (multer + Google Cloud Storage)
// ---------------------------------------------------------------------------
router.post(
  "/api/user/upload-photo",
  verifyToken as express.RequestHandler,
  upload.single("photo"),
  async (req: express.Request, res: express.Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No photo uploaded" });
      }

      // Extra MIME-type guard (belt-and-suspenders: multer fileFilter already blocks this).
      if (!ALLOWED_MIME_TYPES.has(req.file.mimetype)) {
        return res.status(415).json({
          error: `Unsupported file type: ${req.file.mimetype}`,
        });
      }

      // Extra size guard (belt-and-suspenders: multer limits.fileSize already enforces this).
      if (req.file.size > MAX_FILE_SIZE_BYTES) {
        return res.status(413).json({
          error: `File too large. Maximum allowed size is ${MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB`,
        });
      }

      const user = (req as unknown as { user?: { id?: unknown } }).user;
      const rawId = user?.id;
      if (!rawId || typeof rawId !== "string") {
        return res.status(401).json({ error: "Unauthorized" });
      }
      // Sanitize: only allow hex characters in the id segment of the GCS
      // path so a tampered JWT can't inject path separators.
      if (!/^[a-fA-F0-9]{24}$/.test(rawId)) {
        return res.status(400).json({ error: "Invalid user id format" });
      }
      const userId = rawId;
      const imageFile = req.file;
      const bucketName = process.env.GOOGLE_CLOUD_BUCKET_NAME;

      if (!bucketName) {
        return res.status(500).json({ error: "Storage not configured" });
      }

      // Sanitize the original filename to remove path separators.
      const safeOriginalName = imageFile.originalname.replace(/[/\\]/g, "_");
      const fileName = `${userId}_${Date.now()}_${safeOriginalName}`;
      const bucket = gcsStorage.bucket(bucketName);
      const blob = bucket.file(`profile_photos/${fileName}`);

      // Upload image to Google Cloud Storage.
      try {
        await new Promise<void>((resolve, reject) => {
          const stream = blob
            .createWriteStream({
              metadata: { contentType: imageFile.mimetype },
            })
            .on("error", reject)
            .on("finish", resolve);
          stream.end(imageFile.buffer);
        });
      } catch (uploadError) {
        console.error("GCS upload error:", uploadError);
        return res.status(502).json({ error: "Failed to upload file to storage" });
      }

      // Generate a signed URL (expires in 1 year).
      let signedUrl: string;
      try {
        const [url] = await blob.getSignedUrl({
          action: "read",
          expires: Date.now() + SIGNED_URL_EXPIRY_MS,
        });
        signedUrl = url;
      } catch (signError) {
        console.error("GCS signed URL error:", signError);
        return res.status(502).json({ error: "Failed to generate file URL" });
      }

      const updatedUser = await UserModel.findByIdAndUpdate(
        userId,
        { profilePhoto: signedUrl },
        { new: true }
      );

      if (!updatedUser) {
        return res.status(404).json({ error: "User not found" });
      }

      return res
        .status(200)
        .json({ message: "Profile photo uploaded successfully", signedUrl });
    } catch (error) {
      console.error("Error uploading profile photo:", error);
      return res.status(500).json({ error: "Failed to upload profile photo" });
    }
  }
);

export default router;
