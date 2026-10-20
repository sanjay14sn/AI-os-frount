import mongoose, { Document, Schema } from 'mongoose';

export interface IDepartment extends Document {
  _id: mongoose.Types.ObjectId;
  collegeId: mongoose.Types.ObjectId;
  name: string;
  code: string;
  hod: string;
  totalStudents: number;
  eligibleStudents: number;
  placedStudents: number;
  placementPercent: number;
  avgPackage: number;
  topSkills: string[];
  activeJobs: number;
  createdAt: Date;
  updatedAt: Date;
}

const departmentSchema = new Schema<IDepartment>(
  {
    collegeId: { type: Schema.Types.ObjectId, ref: 'College', required: true, index: true },
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, uppercase: true, trim: true },
    hod: { type: String, default: '' },
    totalStudents: { type: Number, default: 0 },
    eligibleStudents: { type: Number, default: 0 },
    placedStudents: { type: Number, default: 0 },
    placementPercent: { type: Number, default: 0 },
    avgPackage: { type: Number, default: 0 },
    topSkills: [{ type: String }],
    activeJobs: { type: Number, default: 0 },
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

departmentSchema.index({ collegeId: 1, code: 1 }, { unique: true });

export const Department = mongoose.model<IDepartment>('Department', departmentSchema);
