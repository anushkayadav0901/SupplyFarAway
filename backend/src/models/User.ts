import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const userSchema = new Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: false },
  emailAddress: { type: String, required: true },
  password: { type: String, required: true },
  phoneNumber: { type: String, required: false },
  companyName: { type: String, required: false },
  companyAddress: {
    street: { type: String, required: false },
    city: { type: String, required: false },
    state: { type: String, required: false },
    postalCode: { type: String, required: false },
    country: { type: String, required: false },
  },
  taxId: { type: String, required: false },
  businessType: { type: String, required: false },
  primaryContactName: { type: String, required: false },
  primaryContactPhone: { type: String, required: false },
  preferredShippingMethods: [{ type: String, required: false }],
  operatingRegions: [{ type: String, required: false }],
  annualShipmentVolume: { type: Number, required: false },
  averageShipmentWeight: { type: Number, required: false },
  sustainabilityGoals: { type: String, required: false },
  profilePhoto: { type: String, required: false },
  createdAt: { type: Date, default: Date.now },
});

export type UserDocument = InferSchemaType<typeof userSchema> & {
  _id: mongoose.Types.ObjectId;
};

// Preserve the legacy model name "userModel" to keep collection mapping
// consistent with the existing JS code during the migration.
export const UserModel: Model<UserDocument> =
  (mongoose.models.userModel as Model<UserDocument>) ||
  mongoose.model<UserDocument>("userModel", userSchema);

export default UserModel;
