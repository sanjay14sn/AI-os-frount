import mongoose, { Document, Schema } from 'mongoose';

export interface IInterview extends Document {
  _id: mongoose.Types.ObjectId;
  applicationId: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  jobId: mongoose.Types.ObjectId;
  companyId: mongoose.Types.ObjectId;
  driveId?: mongoose.Types.ObjectId;
  recruiterId: mongoose.Types.ObjectId;
  type: 'technical' | 'hr' | 'managerial' | 'coding' | 'case-study' | 'final';
  round: number;
  status: 'scheduled' | 'confirmed' | 'attended' | 'no_show' | 'completed' | 'cancelled';
  date: Date;
  time: string;
  duration: number;
  mode: 'in-person' | 'video' | 'phone';
  meetingLink?: string;
  venue?: string;
  panelists?: string[];
  feedback?: {
    technicalScore: number;
    communicationScore: number;
    problemSolvingScore: number;
    culturalFitScore: number;
    overallScore: number;
    recommendation: 'strongly_recommend' | 'recommend' | 'neutral' | 'not_recommend';
    strengths: string[];
    improvements: string[];
    notes: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const interviewSchema = new Schema<IInterview>(
  {
    applicationId: { type: Schema.Types.ObjectId, ref: 'Application' },
    studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
    jobId: { type: Schema.Types.ObjectId, ref: 'Job' },
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
    driveId: { type: Schema.Types.ObjectId, ref: 'PlacementDrive' },
    recruiterId: { type: Schema.Types.ObjectId, ref: 'User' },
    type: {
      type: String,
      enum: ['technical', 'hr', 'managerial', 'coding', 'case-study', 'final'],
      required: true,
    },
    round: { type: Number, default: 1 },
    status: {
      type: String,
      enum: ['scheduled', 'confirmed', 'attended', 'no_show', 'completed', 'cancelled'],
      default: 'scheduled',
    },
    date: { type: Date, required: true },
    time: { type: String, required: true },
    duration: { type: Number, default: 60 },
    mode: {
      type: String,
      enum: ['in-person', 'video', 'phone'],
      default: 'video',
    },
    meetingLink: { type: String },
    venue: { type: String },
    panelists: [{ type: String }],
    feedback: {
      technicalScore: Number,
      communicationScore: Number,
      problemSolvingScore: Number,
      culturalFitScore: Number,
      overallScore: Number,
      recommendation: {
        type: String,
        enum: ['strongly_recommend', 'recommend', 'neutral', 'not_recommend'],
      },
      strengths: [String],
      improvements: [String],
      notes: String,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret: Record<string, unknown>) => {
        ret.id = String(ret._id);
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

export const Interview = mongoose.model<IInterview>('Interview', interviewSchema);
