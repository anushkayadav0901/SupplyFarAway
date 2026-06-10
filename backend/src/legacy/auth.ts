/**
 * Legacy Express routes for auth domain that cannot cleanly become tRPC:
 *  - GET  /auth/google          — initiates Google OAuth (passport redirect)
 *  - GET  /auth/google/callback — OAuth callback (redirects browser to frontend)
 *  - POST /api/user/upload-photo — multer file upload to Google Cloud Storage
 *
 * These are mounted by the consolidation phase in backend/src/index.ts.
 */

import express from "express";
import jwt from "jsonwebtoken";
import passport from "../config/passport.js";
import { upload, storage as gcsStorage } from "../config/multer.js";
import { UserModel } from "../models/User.js";

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET ?? "";
const TOKEN_EXPIRY = "1h";

const isProduction = process.env.NODE_ENV === "production";
const FRONTEND_URL = isProduction
  ? process.env.FRONTEND_URL
  : "http://localhost:5173";

// --- Google OAuth initiation ---
router.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

// --- Google OAuth callback (redirects) ---
router.get(
  "/auth/google/callback",
  passport.authenticate("google", { session: false }),
  (req: express.Request, res: express.Response) => {
    const user = req.user as { _id: unknown; emailAddress: string };
    const token = jwt.sign(
      { id: user._id, email: user.emailAddress },
      JWT_SECRET,
      { expiresIn: TOKEN_EXPIRY }
    );
    const redirectUrl = `${FRONTEND_URL}/?token=${token}`;
    res.redirect(redirectUrl);
  }
);

// --- Upload Profile Photo (multer + Google Cloud Storage) ---
router.post(
  "/api/user/upload-photo",
  upload.single("photo"),
  async (req: express.Request, res: express.Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No photo uploaded" });
      }

      const user = (req as unknown as { user?: { id: string } }).user;
      if (!user?.id) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const userId = user.id;
      const imageFile = req.file;
      const bucketName = process.env.GOOGLE_CLOUD_BUCKET_NAME;

      if (!bucketName) {
        return res.status(500).json({ error: "Bucket name not configured" });
      }

      const fileName = `${userId}_${Date.now()}_${imageFile.originalname}`;
      const bucket = gcsStorage.bucket(bucketName);
      const blob = bucket.file(`profile_photos/${fileName}`);

      // Upload image to Google Cloud Storage
      await new Promise<void>((resolve, reject) => {
        const stream = blob
          .createWriteStream({
            metadata: { contentType: imageFile.mimetype },
          })
          .on("error", reject)
          .on("finish", resolve);
        stream.end(imageFile.buffer);
      });

      // Generate a signed URL (expires in 1 year)
      const [signedUrl] = await blob.getSignedUrl({
        action: "read",
        expires: Date.now() + 365 * 24 * 60 * 60 * 1000,
      });

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
