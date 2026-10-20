import mongoose, { Document, Schema } from 'mongoose';

export interface IApplication extends Document {
  _id: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  jobId: mongoose.Types.ObjectId;
  companyId: mongoose.Types.ObjectId;
  driveId?: mongoose.Types.ObjectId;
  status: 'applied' | 'under_review' | 'shortlisted' | 'assessment' | 'technical' | 'hr' | 'selected' | 'rejected' | 'withdrawn';
  currentStage: string;
  timeline: {
    stage: string;
    status: 'pending' | 'passed' | 'failed' | 'current';
    date?: Date;
    notes?: string;
  }[];
  matchScore?: number;
  notes?: string;
  recruiterNotes?: string;
  isShortlisted: boolean;
  offerDetails?: {
    package: number;
    joiningDate: Date;
    location: string;
    accepted?: boolean;
  };
  appliedAt: Date;
  updatedAt: Date;
  createdAt: Date;
}

const applicationSchema = new Schema<IApplication>(
  {
    studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
    jobId: { type: Schema.Types.ObjectId, ref: 'Job', required: true, index: true },
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
    driveId: { type: Schema.Types.ObjectId, ref: 'PlacementDrive' },
    status: {
      type: String,
      enum: ['applied', 'under_review', 'shortlisted', 'assessment', 'technical', 'hr', 'selected', 'rejected', 'withdrawn'],
      default: 'applied',
      index: true,
    },
    currentStage: { type: String, default: 'Application Submitted' },
    timeline: [
      {
        stage: String,
        status: { type: String, enum: ['pending', 'passed', 'failed', 'current'] },
        date: Date,
        notes: String,
        _id: false,
      },
    ],
    matchScore: { type: Number },
    notes: { type: String },
    recruiterNotes: { type: String },
    isShortlisted: { type: Boolean, default: false },
    offerDetails: {
      package: Number,
      joiningDate: Date,
      location: String,
      accepted: Boolean,
    },
    appliedAt: { type: Date, default: Date.now },
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

// Prevent duplicate applications
applicationSchema.index({ studentId: 1, jobId: 1 }, { unique: true });

export const Application = mongoose.model<IApplication>('Application', applicationSchema);
