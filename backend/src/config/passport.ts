// External
import passport from "passport";
import {
  Strategy as GoogleStrategy,
  type Profile,
  type VerifyCallback,
} from "passport-google-oauth20";
import dotenv from "dotenv";

// Internal
import UserModel from "../models/User.js";

dotenv.config();

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

const isProduction = process.env.NODE_ENV === "production";

const callbackURL = isProduction
  ? `${process.env.BACKEND_URL}/auth/google/callback`
  : "http://localhost:5000/auth/google/callback";

if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
  throw new Error(
    "Missing Google OAuth credentials. Ensure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are set in the .env file."
  );
}

// ---------------------------------------------------------------------------
// Rate-limiting hook: mount express-rate-limit on /auth/google/callback in
// legacy/auth.ts to mitigate OAuth callback abuse.
// Example:
//   import rateLimit from "express-rate-limit";
//   export const oauthLimiter = rateLimit({ windowMs: 15 * 60_000, max: 30 });
// ---------------------------------------------------------------------------

/**
 * Validates that a Google OAuth profile contains the minimum required fields
 * before we proceed to sign a JWT. Prevents malformed profile objects from
 * reaching the token-signing step.
 */
function validateGoogleProfile(
  profile: Profile
): { email: string; firstName: string; lastName: string; photo: string } | null {
  const email = profile.emails?.[0]?.value?.trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return null;
  }
  return {
    email,
    firstName: profile.name?.givenName?.trim() ?? "",
    lastName: profile.name?.familyName?.trim() ?? "",
    photo: profile.photos?.[0]?.value ?? "",
  };
}

passport.use(
  new GoogleStrategy(
    {
      clientID: GOOGLE_CLIENT_ID,
      clientSecret: GOOGLE_CLIENT_SECRET,
      callbackURL,
    },
    async (
      _accessToken: string,
      _refreshToken: string,
      profile: Profile,
      done: VerifyCallback
    ) => {
      try {
        const validated = validateGoogleProfile(profile);
        if (!validated) {
          return done(new Error("Google profile is missing a valid email address"));
        }

        const { email, firstName, lastName, photo } = validated;

        let user = await UserModel.findOne({ emailAddress: email });
        if (!user) {
          user = await UserModel.create({
            firstName,
            lastName,
            emailAddress: email,
            // Placeholder signals this account must not use password login.
            password: "GOOGLE_AUTH_PLACEHOLDER",
            profilePhoto: photo,
          });
        }
        return done(null, user);
      } catch (error) {
        return done(error as Error);
      }
    }
  )
);

passport.serializeUser((user: Express.User, done) => {
  // Mongoose docs expose an `.id` string getter backed by `_id`.
  done(null, (user as unknown as { id: string }).id);
});

passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await UserModel.findById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

export default passport;
