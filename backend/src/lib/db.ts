import mongoose from "mongoose";

export async function connectMongoDB(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI is not set");
    return;
  }
  try {
    await mongoose.connect(uri);
    console.log("MongoDB Database is Connected");
  } catch (error) {
    console.log("Error connecting the Database: ", error);
  }
}

export default connectMongoDB;
