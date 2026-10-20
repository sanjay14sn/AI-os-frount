import mongoose, { Document, Schema } from 'mongoose';

export interface IPlacementDrive extends Document {
  _id: mongoose.Types.ObjectId;
  collegeId: mongoose.Types.ObjectId;
  companyId: mongoose.Types.ObjectId;
  jobId: mongoose.Types.ObjectId;
  title: string;
  description?: string;
  date: Date;
  endDate?: Date;
  venue: string;
  status: 'upcoming' | 'ongoing' | 'completed' | 'cancelled';
  eligibleDepartments: string[];
  eligibility: {
    minCgpa: number;
    maxBacklogs: number;
    branches: string[];
    degree: string[];
    graduationYear: number[];
  };
  openings: number;
  pipeline: {
    id: string;
    name: string;
    order: number;
    type: string;
    description?: string;
    date?: Date;
    duration?: number;
  }[];
  stats: {
    registered: number;
    eligible: number;
    applied: number;
    shortlisted: number;
    assessment: number;
    interviewed: number;
    selected: number;
    rejected: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

const placementDriveSchema = new Schema<IPlacementDrive>(
  {
    collegeId: { type: Schema.Types.ObjectId, ref: 'College', required: true, index: true },
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
    jobId: { type: Schema.Types.ObjectId, ref: 'Job' },
    title: { type: String, required: true },
    description: { type: String },
    date: { type: Date, required: true },
    endDate: { type: Date },
    venue: { type: String, required: true },
    status: {
      type: String,
      enum: ['upcoming', 'ongoing', 'completed', 'cancelled'],
      default: 'upcoming',
    },
    eligibleDepartments: [{ type: String }],
    eligibility: {
      minCgpa: { type: Number, default: 6.0 },
      maxBacklogs: { type: Number, default: 0 },
      branches: [String],
      degree: [String],
      graduationYear: [Number],
    },
    openings: { type: Number, default: 1 },
    pipeline: [{ type: Schema.Types.Mixed }],
    stats: {
      registered: { type: Number, default: 0 },
      eligible: { type: Number, default: 0 },
      applied: { type: Number, default: 0 },
      shortlisted: { type: Number, default: 0 },
      assessment: { type: Number, default: 0 },
      interviewed: { type: Number, default: 0 },
      selected: { type: Number, default: 0 },
      rejected: { type: Number, default: 0 },
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

export const PlacementDrive = mongoose.model<IPlacementDrive>('PlacementDrive', placementDriveSchema);
