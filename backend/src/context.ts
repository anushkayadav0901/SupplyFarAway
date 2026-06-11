import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import jwt from "jsonwebtoken";

export interface AuthUser {
  id?: string;
  _id?: string;
  email?: string;
  [key: string]: unknown;
}

export interface Context {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: AuthUser | null;
}

/**
 * Extract a JWT from either the Authorization header (Bearer <token>)
 * or from cookies, mirroring backend/Middleware/auth.js behavior but
 * extended to also look at cookies for forward-compatibility.
 */
function extractToken(req: CreateExpressContextOptions["req"]): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const parts = authHeader.split(" ");
    if (parts.length === 2 && parts[0] === "Bearer") {
      return parts[1];
    }
    // Some clients pass raw token in the header
    if (parts.length === 1 && parts[0]) {
      return parts[0];
    }
  }

  // Cookies (if cookie-parser is mounted upstream)
  const cookies = (req as unknown as { cookies?: Record<string, string> }).cookies;
  if (cookies?.token) return cookies.token;
  if (cookies?.authToken) return cookies.authToken;

  return null;
}

export async function createContext({
  req,
  res,
}: CreateExpressContextOptions): Promise<Context> {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error("JWT_SECRET environment variable must be set");
  }

  let user: AuthUser | null = null;

  const token = extractToken(req);
  if (token) {
    try {
      const decoded = jwt.verify(token, jwtSecret) as AuthUser;
      user = decoded;
    } catch {
      user = null;
    }
  }

  return { req, res, user };
}
