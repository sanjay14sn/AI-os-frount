import mongoose, { Document, Schema } from 'mongoose';

export interface IInterviewTurn {
  role: 'interviewer' | 'candidate';
  text: string;
}

export interface IInterviewSession extends Document {
  userId: mongoose.Types.ObjectId;
  company: string;
  round: string;
  status: 'active' | 'completed' | 'abandoned';
  model?: string;
  transcript: IInterviewTurn[];
  score?: number;
  feedback?: string;
  strengths: string[];
  improvements: string[];
  createdAt: Date;
  updatedAt: Date;
}

const interviewSessionSchema = new Schema<IInterviewSession>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    company: { type: String, required: true, trim: true },
    round: { type: String, required: true, trim: true },
    status: { type: String, enum: ['active', 'completed', 'abandoned'], default: 'active', index: true },
    model: { type: String },
    transcript: [
      {
        role: { type: String, enum: ['interviewer', 'candidate'], required: true },
        text: { type: String, required: true },
        _id: false,
      },
    ],
    score: { type: Number },
    feedback: { type: String },
    strengths: [{ type: String }],
    improvements: [{ type: String }],
  },
  { timestamps: true },
);

interviewSessionSchema.index({ userId: 1, createdAt: -1 });

export const InterviewSession = mongoose.model<IInterviewSession>('InterviewSession', interviewSessionSchema);
