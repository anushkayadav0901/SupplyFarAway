import { TRPCError } from "@trpc/server";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "../trpc.js";
import { UserModel } from "../models/User.js";
import { DraftModel } from "../models/Draft.js";
import { SaveRouteModel } from "../models/SaveRoute.js";
import { ProductAnalysisModel } from "../models/ProductAnalysis.js";
import {
  UserLoginSchema,
  CompanyAddressSchema,
} from "../schemas/user.js";

const JWT_SECRET = process.env.JWT_SECRET ?? "";
const TOKEN_EXPIRY = "1h";

export const authRouter = router({
  /**
   * POST /createAccount → auth.createAccount
   * Creates a new user account with email/password.
   */
  createAccount: publicProcedure
    .input(
      z.object({
        firstName: z.string().min(1),
        lastName: z.string().optional(),
        emailAddress: z.string().email(),
        password: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      const { firstName, lastName, emailAddress, password } = input;

      const userExists = await UserModel.findOne({ emailAddress });
      if (userExists) {
        if (userExists.password === "GOOGLE_AUTH_PLACEHOLDER") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "This email is already registered through Google sign-in. Please sign in with Google.",
          });
        }
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "User already exists",
        });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const newUser = await UserModel.create({
        firstName,
        lastName,
        emailAddress,
        password: hashedPassword,
      });

      const token = jwt.sign(
        { id: newUser._id, email: newUser.emailAddress },
        JWT_SECRET,
        { expiresIn: TOKEN_EXPIRY }
      );

      return {
        message: "Account created successfully",
        token,
        user: newUser,
      };
    }),

  /**
   * POST /loginUser → auth.loginUser
   * Authenticates a user and returns a JWT.
   */
  loginUser: publicProcedure
    .input(UserLoginSchema)
    .mutation(async ({ input }) => {
      const { emailAddress, password } = input;

      const user = await UserModel.findOne({ emailAddress });
      if (!user) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "User not found!",
        });
      }

      if (user.password === "GOOGLE_AUTH_PLACEHOLDER") {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message:
            "User registered through Google sign-in. Please sign in with Google.",
        });
      }

      const matchPassword = await bcrypt.compare(password, user.password);
      if (!matchPassword) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid credentials!",
        });
      }

      const token = jwt.sign(
        { id: user._id, email: user.emailAddress },
        JWT_SECRET,
        { expiresIn: TOKEN_EXPIRY }
      );

      return {
        message: "Logged in successfully!",
        token,
        user,
      };
    }),

  /**
   * GET /protectedRoute → auth.getMe
   * Returns the authenticated user's profile (minus password).
   */
  getMe: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.user.id ?? ctx.user._id;
    const user = await UserModel.findById(userId).select("-password");
    if (!user) {
      throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
    }

    return {
      message: "Access granted to protected route!",
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        emailAddress: user.emailAddress,
        profilePhoto: user.profilePhoto,
        phoneNumber: user.phoneNumber,
        companyName: user.companyName,
        companyAddress: user.companyAddress || {},
        taxId: user.taxId,
      },
    };
  }),

  /**
   * PUT /api/user/update-username → auth.updateUsername
   */
  updateUsername: protectedProcedure
    .input(
      z.object({
        firstName: z.string().min(1),
        lastName: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id ?? ctx.user._id;
      const { firstName, lastName } = input;

      const updatedUser = await UserModel.findByIdAndUpdate(
        userId,
        { firstName, lastName },
        { new: true }
      );

      if (!updatedUser) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      }

      return {
        message: "Username updated successfully",
        user: {
          firstName: updatedUser.firstName,
          lastName: updatedUser.lastName,
        },
      };
    }),

  /**
   * PUT /api/user/update-password → auth.updatePassword
   */
  updatePassword: protectedProcedure
    .input(
      z.object({
        newPassword: z.string().min(6, "Password must be at least 6 characters long"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id ?? ctx.user._id;
      const { newPassword } = input;

      const user = await UserModel.findById(userId);
      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      }

      if (user.password === "GOOGLE_AUTH_PLACEHOLDER") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message:
            "You are authorized by Google. Password changes are not allowed for this account",
        });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await UserModel.findByIdAndUpdate(
        userId,
        { password: hashedPassword },
        { new: true }
      );

      return { message: "Password updated successfully" };
    }),

  /**
   * PUT /api/user/update-profile → auth.updateProfile
   */
  updateProfile: protectedProcedure
    .input(
      z.object({
        phoneNumber: z.string().min(1, "Phone number is required"),
        companyName: z.string().optional(),
        companyAddress: CompanyAddressSchema.optional(),
        taxId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id ?? ctx.user._id;
      const { phoneNumber, companyName, companyAddress, taxId } = input;

      const updateData: Record<string, unknown> = {};
      updateData.phoneNumber = phoneNumber;
      if (companyName !== undefined) updateData.companyName = companyName;
      if (taxId !== undefined) updateData.taxId = taxId;

      if (companyAddress) {
        const addressFields: Record<string, string | undefined> = {
          "companyAddress.street": companyAddress.street,
          "companyAddress.city": companyAddress.city,
          "companyAddress.state": companyAddress.state,
          "companyAddress.postalCode": companyAddress.postalCode,
          "companyAddress.country": companyAddress.country,
        };

        for (const [key, value] of Object.entries(addressFields)) {
          if (value !== undefined && value !== null) {
            updateData[key] = value;
          }
        }
      }

      let user = await UserModel.findById(userId);

      if (user) {
        const updatedUser = await UserModel.findByIdAndUpdate(
          userId,
          { $set: updateData },
          { new: true, runValidators: true }
        );

        if (!updatedUser) {
          throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
        }

        return {
          message: "Profile updated successfully",
          user: {
            phoneNumber: updatedUser.phoneNumber,
            companyName: updatedUser.companyName,
            companyAddress: updatedUser.companyAddress || {},
            taxId: updatedUser.taxId,
          },
        };
      } else {
        // User does not exist — create new (mirrors legacy behavior)
        const newUserData = {
          ...updateData,
          createdAt: new Date(),
        };

        const newUser = new UserModel(newUserData as Parameters<typeof UserModel.create>[0]);
        const savedUser = await newUser.save();

        return {
          message: "Profile created successfully",
          user: {
            phoneNumber: savedUser.phoneNumber,
            companyName: savedUser.companyName,
            companyAddress: savedUser.companyAddress || {},
            taxId: savedUser.taxId,
          },
        };
      }
    }),

  /**
   * DELETE /api/user/delete-account → auth.deleteAccount
   * Deletes the user and all associated data.
   */
  deleteAccount: protectedProcedure.mutation(async ({ ctx }) => {
    const userId = ctx.user.id ?? ctx.user._id;

    await UserModel.findByIdAndDelete(userId);
    await DraftModel.deleteMany({ userId });
    await SaveRouteModel.deleteMany({ userId });
    await ProductAnalysisModel.deleteMany({ userId });

    return { message: "Account deleted successfully" };
  }),
});
