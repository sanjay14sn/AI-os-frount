import mongoose, { Document, Schema } from 'mongoose';

export interface IJob extends Document {
  _id: mongoose.Types.ObjectId;
  companyId: mongoose.Types.ObjectId;
  recruiterId: mongoose.Types.ObjectId; // User with RECRUITER role
  title: string;
  description: string;
  responsibilities: string[];
  requirements: string[];
  type: 'fulltime' | 'internship' | 'contract' | 'parttime';
  location: string;
  isRemote: boolean;
  salaryMin: number;
  salaryMax: number;
  experience: string;
  openings: number;
  status: 'draft' | 'active' | 'paused' | 'closed' | 'expired';
  eligibility: {
    minCgpa: number;
    maxBacklogs: number;
    branches: string[];
    degree: string[];
    graduationYear: number[];
    requiredCertifications?: string[];
    requiredSkills?: string[];
  };
  skills: string[];
  niceToHave: string[];
  benefits: string[];
  applicationDeadline: Date;
  driveDate?: Date;
  collegeIds: mongoose.Types.ObjectId[];
  stats: {
    eligible: number;
    applied: number;
    shortlisted: number;
    interviewed: number;
    selected: number;
  };
  pipeline: {
    id: string;
    name: string;
    order: number;
    type: 'application' | 'assessment' | 'technical' | 'hr' | 'final' | 'custom';
    description?: string;
    date?: Date;
    duration?: number;
  }[];
  createdAt: Date;
  updatedAt: Date;
}

const jobSchema = new Schema<IJob>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    recruiterId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    responsibilities: [{ type: String }],
    requirements: [{ type: String }],
    type: {
      type: String,
      enum: ['fulltime', 'internship', 'contract', 'parttime'],
      default: 'fulltime',
    },
    location: { type: String, required: true },
    isRemote: { type: Boolean, default: false },
    salaryMin: { type: Number, required: true },
    salaryMax: { type: Number, required: true },
    experience: { type: String, default: 'Fresher' },
    openings: { type: Number, default: 1 },
    status: {
      type: String,
      enum: ['draft', 'active', 'paused', 'closed', 'expired'],
      default: 'draft',
      index: true,
    },
    eligibility: {
      minCgpa: { type: Number, default: 6.0 },
      maxBacklogs: { type: Number, default: 0 },
      branches: [{ type: String }],
      degree: [{ type: String }],
      graduationYear: [{ type: Number }],
      requiredCertifications: [{ type: String }],
      requiredSkills: [{ type: String }],
    },
    skills: [{ type: String }],
    niceToHave: [{ type: String }],
    benefits: [{ type: String }],
    applicationDeadline: { type: Date, required: true },
    driveDate: { type: Date },
    collegeIds: [{ type: Schema.Types.ObjectId, ref: 'College' }],
    stats: {
      eligible: { type: Number, default: 0 },
      applied: { type: Number, default: 0 },
      shortlisted: { type: Number, default: 0 },
      interviewed: { type: Number, default: 0 },
      selected: { type: Number, default: 0 },
    },
    pipeline: [{ type: Schema.Types.Mixed }],
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

jobSchema.index({ title: 'text', location: 'text' });
jobSchema.index({ status: 1, 'eligibility.minCgpa': 1 });

export const Job = mongoose.model<IJob>('Job', jobSchema);
