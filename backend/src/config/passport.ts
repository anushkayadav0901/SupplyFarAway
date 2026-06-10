import passport from "passport";
import {
  Strategy as GoogleStrategy,
  type Profile,
  type VerifyCallback,
} from "passport-google-oauth20";
import dotenv from "dotenv";
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
        const email = profile.emails?.[0]?.value;
        if (!email) {
          return done(new Error("Google profile missing email"));
        }

        let user = await UserModel.findOne({ emailAddress: email });
        if (!user) {
          user = await UserModel.create({
            firstName: profile.name?.givenName ?? "",
            lastName: profile.name?.familyName ?? "",
            emailAddress: email,
            password: "GOOGLE_AUTH_PLACEHOLDER",
            profilePhoto: profile.photos?.[0]?.value ?? "",
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
  // Mongoose docs have `.id` getter
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
