import mongoose, { Document, Schema } from 'mongoose';

export interface IStudent extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  collegeId: mongoose.Types.ObjectId;
  departmentId: mongoose.Types.ObjectId;
  studentId: string; // college roll number / USN
  name: string;
  email: string;
  phone: string;
  avatar?: string;
  coverImage?: string;
  department: string;
  batch: string;
  degree: string;
  cgpa: number;
  backlogs: number;
  gender: 'male' | 'female' | 'other';
  dob?: Date;
  address: {
    city: string;
    state: string;
    pincode: string;
  };
  skills: string[];
  certifications: {
    id: string;
    name: string;
    issuer: string;
    issueDate: string;
    expiryDate?: string;
    credentialId?: string;
    url?: string;
  }[];
  projects: {
    id: string;
    title: string;
    description: string;
    technologies: string[];
    url?: string;
    githubUrl?: string;
    duration: string;
    highlights: string[];
  }[];
  education: {
    id: string;
    level: 'sslc' | 'puc' | 'diploma' | 'graduation' | 'postgraduation';
    institution: string;
    degree: string;
    specialization?: string;
    score: number;
    scoreType: 'percentage' | 'cgpa';
    yearOfPassing: number;
    location: string;
  }[];
  experience: {
    id: string;
    company: string;
    role: string;
    type: 'internship' | 'fulltime' | 'parttime' | 'freelance';
    startDate: string;
    endDate?: string;
    isCurrent: boolean;
    description: string;
    skills: string[];
  }[];
  resume?: {
    fileName: string;
    fileUrl: string;
    uploadedAt: Date;
    atsScore: number;
    overallScore: number;
  };
  aadharNumber?: string;
  aadharCard?: {
    fileUrl: string;
    fileName: string;
    uploadedAt: Date;
    fileSize?: number;
  };
  profileCompletion: number;
  placementStatus: 'not_placed' | 'placed' | 'not_eligible' | 'opted_out';
  isEligible: boolean;
  offersCount: number;
  placementReadinessScore: number;
  linkedIn?: string;
  github?: string;
  portfolio?: string;
  preferredLocations: string[];
  preferredRoles: string[];
  expectedSalary: number;
  jobPortals: {
    name: string;
    connected: boolean;
    portalId?: string;
  }[];
  isProfilePublic?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const studentSchema = new Schema<IStudent>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    collegeId: { type: Schema.Types.ObjectId, ref: 'College', required: true, index: true },
    departmentId: { type: Schema.Types.ObjectId, ref: 'Department', required: true },
    studentId: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    phone: { type: String, default: '' },
    avatar: { type: String },
    coverImage: { type: String },
    department: { type: String, required: true },
    batch: { type: String, required: true },
    degree: { type: String, required: true },
    cgpa: { type: Number, required: true, min: 0, max: 10 },
    backlogs: { type: Number, default: 0 },
    gender: { type: String, enum: ['male', 'female', 'other'], default: 'male' },
    dob: { type: Date },
    address: {
      city: { type: String, default: '' },
      state: { type: String, default: '' },
      pincode: { type: String, default: '' },
    },
    skills: [{ type: String }],
    certifications: [{ type: Schema.Types.Mixed }],
    projects: [{ type: Schema.Types.Mixed }],
    education: [{ type: Schema.Types.Mixed }],
    experience: [{ type: Schema.Types.Mixed }],
    resume: {
      fileName: String,
      fileUrl: String,
      uploadedAt: Date,
      atsScore: { type: Number, default: 0 },
      overallScore: { type: Number, default: 0 },
    },
    aadharNumber: { type: String, trim: true },
    aadharCard: {
      fileUrl: String,
      fileName: String,
      uploadedAt: { type: Date, default: Date.now },
      fileSize: Number,
    },
    profileCompletion: { type: Number, default: 30 },
    placementStatus: {
      type: String,
      enum: ['not_placed', 'placed', 'not_eligible', 'opted_out'],
      default: 'not_placed',
    },
    isEligible: { type: Boolean, default: false },
    offersCount: { type: Number, default: 0 },
    placementReadinessScore: { type: Number, default: 0 },
    linkedIn: { type: String },
    github: { type: String },
    portfolio: { type: String },
    preferredLocations: [{ type: String }],
    preferredRoles: [{ type: String }],
    expectedSalary: { type: Number, default: 0 },
    jobPortals: [
      {
        name: { type: String, required: true },
        connected: { type: Boolean, default: false },
        portalId: { type: String },
        _id: false,
      }
    ],
    isProfilePublic: { type: Boolean, default: true },
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

studentSchema.index({ collegeId: 1, department: 1 });
studentSchema.index({ name: 'text', email: 'text', studentId: 'text' });

export const Student = mongoose.model<IStudent>('Student', studentSchema);
