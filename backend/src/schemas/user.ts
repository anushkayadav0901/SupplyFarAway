import { z } from "zod";

export const CompanyAddressSchema = z.object({
  street: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),
});

export const UserInputSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().optional(),
  emailAddress: z.string().email(),
  password: z.string().min(1),
  phoneNumber: z.string().optional(),
  companyName: z.string().optional(),
  companyAddress: CompanyAddressSchema.optional(),
  taxId: z.string().optional(),
  businessType: z.string().optional(),
  primaryContactName: z.string().optional(),
  primaryContactPhone: z.string().optional(),
  preferredShippingMethods: z.array(z.string()).optional(),
  operatingRegions: z.array(z.string()).optional(),
  annualShipmentVolume: z.number().optional(),
  averageShipmentWeight: z.number().optional(),
  sustainabilityGoals: z.string().optional(),
  profilePhoto: z.string().optional(),
});

export type UserInput = z.infer<typeof UserInputSchema>;

export const UserLoginSchema = z.object({
  emailAddress: z.string().email(),
  password: z.string().min(1),
});

export type UserLogin = z.infer<typeof UserLoginSchema>;

export const UserUpdateSchema = UserInputSchema.partial();
export type UserUpdate = z.infer<typeof UserUpdateSchema>;
