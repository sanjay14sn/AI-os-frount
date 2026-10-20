import mongoose, { Document, Schema } from 'mongoose';

export interface ISavedResume extends Document {
  userId: mongoose.Types.ObjectId;
  fileName: string;
  size: number;
  mimeType: string;
  text: string;
  data?: Buffer;
  lastQuery?: string;
  lastUsedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const savedResumeSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    fileName: { type: String, required: true, trim: true },
    size: { type: Number, required: true },
    mimeType: { type: String, default: 'application/pdf' },
    text: { type: String, required: true },
    data: { type: Buffer, select: false },
    lastQuery: { type: String, default: '' },
    lastUsedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

savedResumeSchema.index({ userId: 1, lastUsedAt: -1 });

export const SavedResume = mongoose.model<ISavedResume>('SavedResume', savedResumeSchema);
