import mongoose from "mongoose";

const promotionSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
    },
    duration: {
      start: {
        type: Date,
      },
      end: {
        type: Date,
      },
    },
    noOfUser: {
      type: Number,
      default: 100,
    },
    noOfTime: {
      type: Number,
      default: 1,
    },
    isPause: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

const Promotion = mongoose.model("Promotion", promotionSchema);
export default Promotion;