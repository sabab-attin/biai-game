import mongoose from 'mongoose';

const playerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 80,
    },
    isGuest: {
      type: Boolean,
      default: false,
      index: true,
    },
    phone: {
      type: String,
      default: '',
      trim: true,
      maxlength: 32,
    },
    phoneNormalized: {
      type: String,
      default: '',
      trim: true,
    },
    email: {
      type: String,
      default: '',
      trim: true,
      maxlength: 120,
    },
    emailNormalized: {
      type: String,
      default: '',
      trim: true,
    },
    spinsUsed: {
      type: Number,
      default: 0,
      min: 0,
    },
    maxSpins: {
      type: Number,
      default: 1,
      min: 1,
    },
    prizeId: {
      type: String,
      default: '',
    },
    prizeTitle: {
      type: String,
      default: '',
    },
    claimCode: {
      type: String,
      default: '',
    },
    enteredAt: {
      type: Date,
      default: Date.now,
    },
    lastLoginAt: {
      type: Date,
      default: Date.now,
    },
    spunAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: false,
    versionKey: false,
  }
);

playerSchema.index(
  { phoneNormalized: 1 },
  {
    unique: true,
    partialFilterExpression: { phoneNormalized: { $gt: '' } },
  }
);

playerSchema.index(
  { emailNormalized: 1 },
  {
    unique: true,
    partialFilterExpression: { emailNormalized: { $gt: '' } },
  }
);

export const Player = mongoose.models.Player || mongoose.model('Player', playerSchema);
