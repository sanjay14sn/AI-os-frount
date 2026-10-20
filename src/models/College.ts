import mongoose, { Document, Schema } from 'mongoose';

export interface ICollege extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  code: string;
  logo?: string;
  city: string;
  state: string;
  country: string;
  website?: string;
  phone: string;
  email: string;
  establishedYear: number;
  affiliation: string;
  type: 'engineering' | 'arts' | 'commerce' | 'medical' | 'law' | 'management';
  totalStudents: number;
  departments: string[];
  tpoName: string;
  tpoEmail: string;
  tpoPhone?: string;
  settings?: {
    minCgpa: number;
    maxBacklogs: number;
    driveAlerts: boolean;
    applicationAlerts: boolean;
    interviewReminders: boolean;
  };
  subscription: {
    plan: 'starter' | 'professional' | 'enterprise';
    status: 'active' | 'trial' | 'expired' | 'cancelled';
    expiresAt: Date;
    studentsLimit: number;
    studentsUsed: number;
    aiCreditsLimit: number;
    aiCreditsUsed: number;
    recruitersLimit: number;
    recruitersUsed: number;
    jobsLimit: number;
    jobsUsed: number;
  };
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const subscriptionSchema = new Schema(
  {
    plan: { type: String, enum: ['starter', 'professional', 'enterprise'], default: 'starter' },
    status: { type: String, enum: ['active', 'trial', 'expired', 'cancelled'], default: 'trial' },
    expiresAt: { type: Date, required: true },
    studentsLimit: { type: Number, default: 500 },
    studentsUsed: { type: Number, default: 0 },
    aiCreditsLimit: { type: Number, default: 1000 },
    aiCreditsUsed: { type: Number, default: 0 },
    recruitersLimit: { type: Number, default: 10 },
    recruitersUsed: { type: Number, default: 0 },
    jobsLimit: { type: Number, default: 50 },
    jobsUsed: { type: Number, default: 0 },
  },
  { _id: false }
);

const collegeSchema = new Schema<ICollege>(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    logo: { type: String },
    city: { type: String, required: true },
    state: { type: String, required: true },
    country: { type: String, default: 'India' },
    website: { type: String },
    phone: { type: String, required: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    establishedYear: { type: Number },
    affiliation: { type: String, default: '' },
    type: {
      type: String,
      enum: ['engineering', 'arts', 'commerce', 'medical', 'law', 'management'],
      default: 'engineering',
    },
    totalStudents: { type: Number, default: 0 },
    departments: [{ type: String }],
    tpoName: { type: String, default: '' },
    tpoEmail: { type: String, default: '' },
    tpoPhone: { type: String, default: '' },
    settings: {
      minCgpa: { type: Number, default: 6, min: 0, max: 10 },
      maxBacklogs: { type: Number, default: 0, min: 0 },
      driveAlerts: { type: Boolean, default: true },
      applicationAlerts: { type: Boolean, default: true },
      interviewReminders: { type: Boolean, default: true },
    },
    subscription: { type: subscriptionSchema, required: true },
    isActive: { type: Boolean, default: true },
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

collegeSchema.index({ name: 'text', city: 'text' });

export const College = mongoose.model<ICollege>('College', collegeSchema);
