import mongoose from "mongoose";

const chainSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
    },
    icon: {
      type: String,
    },
    seedAmount: {
      type: Number,
      required: true,
    },
    childNodes: {
      type: Number,
      required: true,
    },
    parentPercentage: {
      type: Number,
      required: true,
    },
    isPause: {
      type: Boolean,
      default: false,
    },
    isDelete: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ["Enabled", "Disabled", "Blocked"],
      default: "Enabled",
    },
  },
  {
    timestamps: true,
  }
);

const Chain = mongoose.model("Chain", chainSchema);

export default Chain;
