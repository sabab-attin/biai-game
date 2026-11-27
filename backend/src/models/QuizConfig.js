import mongoose from 'mongoose';

const quizConfigSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      default: 'quiz-settings',
    },
    questionCount: {
      type: Number,
      required: true,
      default: 5,
    },
    rewardsByScore: {
      type: Map,
      of: String,
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

export const QuizConfig =
  mongoose.models.QuizConfig || mongoose.model('QuizConfig', quizConfigSchema);
