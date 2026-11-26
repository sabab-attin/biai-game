import mongoose from 'mongoose';

export const RECORD_SOURCES = Object.freeze(['wheel', 'quiz', 'dart']);

const recordSchema = new mongoose.Schema(
  {
    recordId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    name: {
      type: String,
      default: null,
      trim: true,
      maxlength: 80,
    },
    phone: {
      type: String,
      default: null,
      trim: true,
      maxlength: 32,
    },
    email: {
      type: String,
      default: null,
      trim: true,
      maxlength: 120,
    },
    reward: {
      type: String,
      default: null,
      trim: true,
      maxlength: 200,
    },
    timestamp: {
      type: Date,
      required: true,
      index: true,
    },
    source: {
      type: String,
      enum: RECORD_SOURCES,
      required: true,
      index: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    playerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Player',
      default: null,
      index: true,
    },
    result: {
      type: String,
      default: null,
      trim: true,
      maxlength: 120,
    },
    game: {
      type: String,
      default: null,
      trim: true,
      maxlength: 80,
    },
    score: {
      type: Number,
      default: null,
      min: 0,
    },
  },
  {
    timestamps: false,
    versionKey: false,
  }
);

recordSchema.index({ source: 1, timestamp: -1 });

export const Record = mongoose.models.Record || mongoose.model('Record', recordSchema);
