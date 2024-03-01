import mongoose from 'mongoose';

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
    image: {
      type: String,
      // required: true,
    },
    parentPercentage: {
      type: Number,
      required: true,
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

const Chain = mongoose.model('Chain', chainSchema);
export default Chain;
