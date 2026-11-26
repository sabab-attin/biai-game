import mongoose from 'mongoose';

export const PHOTO_THEMES = Object.freeze(['gold', 'crimson', 'navy']);
export const ALLOWED_PHOTO_MIME_TYPES = Object.freeze(['image/webp', 'image/jpeg', 'image/png']);
export const MAX_WINNER_PHOTO_BYTES = 50 * 1024;

const winnerPhotoSchema = new mongoose.Schema(
  {
    photoId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    playId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    recordId: {
      type: String,
      required: true,
      index: true,
    },
    playerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Player',
      default: null,
      index: true,
    },
    winnerName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    phone: {
      type: String,
      default: null,
      trim: true,
      maxlength: 32,
    },
    prizeTitle: {
      type: String,
      default: null,
      trim: true,
      maxlength: 200,
    },
    game: {
      type: String,
      default: null,
      trim: true,
      maxlength: 80,
    },
    themeId: {
      type: String,
      enum: PHOTO_THEMES,
      default: 'gold',
    },
    mimeType: {
      type: String,
      enum: ALLOWED_PHOTO_MIME_TYPES,
      required: true,
    },
    sizeBytes: {
      type: Number,
      required: true,
      min: 1,
      max: MAX_WINNER_PHOTO_BYTES,
    },
    imageData: {
      type: Buffer,
      required: true,
    },
    capturedAt: {
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

winnerPhotoSchema.index({ capturedAt: -1 });

export const WinnerPhoto =
  mongoose.models.WinnerPhoto || mongoose.model('WinnerPhoto', winnerPhotoSchema);
