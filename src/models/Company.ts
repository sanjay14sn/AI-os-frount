import mongoose, { Document, Schema } from 'mongoose';

export interface ICompany extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  logo?: string;
  industry: string;
  type: 'product' | 'service' | 'startup' | 'mnc' | 'psu';
  website?: string;
  linkedIn?: string;
  description: string;
  hq: string;
  size: 'startup' | 'small' | 'medium' | 'large' | 'enterprise';
  founded?: number;
  revenue?: string;
  techStack: string[];
  activeJobs: number;
  totalHired: number;
  avgPackage: number;
  highestPackage: number;
  isActive: boolean;
  isTied: boolean;
  colleges: mongoose.Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const companySchema = new Schema<ICompany>(
  {
    name: { type: String, required: true, trim: true },
    logo: { type: String },
    industry: { type: String, required: true },
    type: {
      type: String,
      enum: ['product', 'service', 'startup', 'mnc', 'psu'],
      default: 'service',
    },
    website: { type: String },
    linkedIn: { type: String },
    description: { type: String, default: '' },
    hq: { type: String, required: true },
    size: {
      type: String,
      enum: ['startup', 'small', 'medium', 'large', 'enterprise'],
      default: 'medium',
    },
    founded: { type: Number },
    revenue: { type: String },
    techStack: [{ type: String }],
    activeJobs: { type: Number, default: 0 },
    totalHired: { type: Number, default: 0 },
    avgPackage: { type: Number, default: 0 },
    highestPackage: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    isTied: { type: Boolean, default: false },
    colleges: [{ type: Schema.Types.ObjectId, ref: 'College' }],
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

companySchema.index({ name: 'text', industry: 'text', hq: 'text' });

export const Company = mongoose.model<ICompany>('Company', companySchema);
