import mongoose, { Schema, Document } from 'mongoose';

export type TargetAudience = 'ALL' | 'STUDENT' | 'COLLEGE_ADMIN' | 'TPO' | 'RECRUITER';

export interface IVideoResource {
  _id?: mongoose.Types.ObjectId;
  id?: string;
  title: string;
  type: string;
  url: string;
  size?: string;
}

export interface IProgramVideo {
  _id?: mongoose.Types.ObjectId;
  id?: string;
  order: number;
  title: string;
  description?: string;
  duration: string;
  videoUrl: string;
  thumbnail?: string;
  resources?: IVideoResource[];
}

export interface IProgram extends Document {
  title: string;
  subtitle?: string;
  description: string;
  category: string;
  targetAudience: TargetAudience[];
  thumbnailUrl: string;
  instructorName: string;
  instructorTitle: string;
  instructorAvatar?: string;
  isPublished: boolean;
  totalDuration: string;
  videosCount: number;
  videos: IProgramVideo[];
  enrolledCount: number;
  rating: number;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

const VideoResourceSchema = new Schema<IVideoResource>({
  title: { type: String, required: true },
  type: { type: String, default: 'pdf' },
  url: { type: String, required: true },
  size: { type: String, default: '1.5 MB' },
});

const ProgramVideoSchema = new Schema<IProgramVideo>({
  order: { type: Number, required: true },
  title: { type: String, required: true },
  description: { type: String, default: '' },
  duration: { type: String, default: '20:00' },
  videoUrl: { type: String, required: true },
  thumbnail: { type: String },
  resources: [VideoResourceSchema],
});

const ProgramSchema = new Schema<IProgram>(
  {
    title: { type: String, required: true, trim: true },
    subtitle: { type: String, default: '' },
    description: { type: String, required: true },
    category: { type: String, required: true, default: 'Placement Training' },
    targetAudience: [{ type: String, enum: ['ALL', 'STUDENT', 'COLLEGE_ADMIN', 'TPO', 'RECRUITER'], default: 'STUDENT' }],
    thumbnailUrl: { type: String, required: true },
    instructorName: { type: String, required: true, default: 'Super Admin Team' },
    instructorTitle: { type: String, default: 'PlacementOS Director' },
    instructorAvatar: { type: String, default: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80' },
    isPublished: { type: Boolean, default: true },
    totalDuration: { type: String, default: '1h 00m' },
    videosCount: { type: Number, default: 0 },
    videos: [ProgramVideoSchema],
    enrolledCount: { type: Number, default: 0 },
    rating: { type: Number, default: 5.0 },
    tags: [{ type: String }],
  },
  {
    timestamps: true,
  }
);

ProgramSchema.index({ category: 1 });
ProgramSchema.index({ targetAudience: 1 });
ProgramSchema.index({ isPublished: 1 });

export const Program = mongoose.model<IProgram>('Program', ProgramSchema);
