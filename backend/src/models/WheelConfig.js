import mongoose from 'mongoose';

const wheelConfigSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      default: 'wheel-weights',
    },
    weights: {
      type: Map,
      of: Number,
      default: {},
    },
    updatedBy: {
      type: String,
      default: '',
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { versionKey: false }
);

export const WheelConfig =
  mongoose.models.WheelConfig || mongoose.model('WheelConfig', wheelConfigSchema);
