import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET ?? "";

export interface AuthenticatedRequest extends Request {
  user?: jwt.JwtPayload | string;
}

/**
 * Express middleware that verifies a Bearer JWT and attaches the
 * decoded payload to req.user. Kept for legacy REST routes that
 * remain alongside the new tRPC API (multer uploads, OAuth, etc.).
 */
export const verifyToken = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    res.status(401).send({ message: "Unauthorized access!" });
    return;
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    res.status(401).send({ message: "Invalid or expired token!" });
  }
};

export default verifyToken;
