import mongoose from 'mongoose';

const spinSchema = new mongoose.Schema(
  {
    playerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Player',
      required: true,
      index: true,
    },
    playerName: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      default: '',
      trim: true,
    },
    email: {
      type: String,
      default: '',
      trim: true,
    },
    prizeId: {
      type: String,
      required: true,
    },
    prizeTitle: {
      type: String,
      required: true,
    },
    segmentIndex: {
      type: Number,
      required: true,
      min: 0,
    },
    claimCode: {
      type: String,
      required: true,
      unique: true,
    },
    spunAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: false,
    versionKey: false,
  }
);

export const Spin = mongoose.models.Spin || mongoose.model('Spin', spinSchema);
