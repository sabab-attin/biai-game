import mongoose from 'mongoose';

const pendingPlaySchema = new mongoose.Schema(
  {
    playId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    game: {
      type: String,
      enum: ['wheel', 'quiz'],
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['pending', 'claimed'],
      default: 'pending',
      required: true,
      index: true,
    },
    prizeId: {
      type: String,
      default: null,
    },
    prizeTitle: {
      type: String,
      default: null,
    },
    segmentIndex: {
      type: Number,
      default: null,
      min: 0,
    },
    claimCode: {
      type: String,
      default: null,
    },
    score: {
      type: Number,
      default: null,
      min: 0,
    },
    total: {
      type: Number,
      default: null,
      min: 0,
    },
    playerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Player',
      default: null,
      index: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    claimedAt: {
      type: Date,
      default: null,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 },
    },
  },
  {
    timestamps: false,
    versionKey: false,
  }
);

export const PendingPlay =
  mongoose.models.PendingPlay || mongoose.model('PendingPlay', pendingPlaySchema);
