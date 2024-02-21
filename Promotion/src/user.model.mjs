import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    OAuthId: String,
    firstName: {
      type: String,
    },
    lastName: {
      type: String,
    },
    userName: {
      type: String,
      lowercase: true,
      trim: true,
      unique: true,
    },
    email: {
      type: String,
      lowercase: true,
      trim: true,
      // unique: true,
    },
    password: {
      type: String,
    },
    phone: {
      type: String,
    },
    isAccCreated: { type: Boolean, default: false },
    provider: String,
    role: {
      type: String,
      enum: ["Client", "Admin"],
      default: "Client",
    },
    otp: {
      code: {
        type: String,
      },
      expiry: {
        type: Date,
      },
      verified: {
        type: Boolean,
        default: false,
      },
    },
    address: {
      country: {
        type: String,
      },
      city: {
        type: String,
      },
      state: {
        type: String,
      },
      postalCode: {
        type: String,
      },
    },
    perference: {
      "2FA": {
        type: Boolean,
        default: true,
      },
      invites: {
        type: Boolean,
        default: true,
      },
      mode: {
        type: String,
        enum: ["public", "private"],
        default: "public",
      },
      messages: {
        type: Boolean,
        default: true,
      },
    },
  },
  {
    timestamps: true,
  }
);

const User = mongoose.model("User", userSchema);
export default User;