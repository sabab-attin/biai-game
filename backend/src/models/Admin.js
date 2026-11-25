import mongoose from 'mongoose';

const adminSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      minlength: 3,
      maxlength: 64,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ['admin'],
      default: 'admin',
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: false,
    versionKey: false,
  }
);

export const Admin = mongoose.models.Admin || mongoose.model('Admin', adminSchema);
