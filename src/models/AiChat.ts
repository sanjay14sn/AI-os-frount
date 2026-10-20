import mongoose, { Document, Schema } from 'mongoose';

export interface IAiChatMessage {
  _id?: mongoose.Types.ObjectId;
  role: 'user' | 'assistant';
  content: string;
  createdAt?: Date;
}

export interface IAiChat extends Document {
  userId: mongoose.Types.ObjectId;
  mode: string;
  messages: IAiChatMessage[];
}

const aiChatSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    mode: { type: String, required: true, default: 'student' },
    messages: [
      {
        role: { type: String, enum: ['user', 'assistant'], required: true },
        content: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true },
);

aiChatSchema.index({ userId: 1, mode: 1 }, { unique: true });

export const AiChat = mongoose.model<IAiChat>('AiChat', aiChatSchema);
