import mongoose, { Schema, Document } from 'mongoose';

export interface IAnnouncementComment {
  id: string;
  userId: string;
  userName: string;
  userRole: string;
  userAvatar?: string;
  content: string;
  createdAt: Date;
}

export interface IAnnouncementAttachment {
  name: string;
  url: string;
  type: string;
  size: number;
}

export interface IAnnouncement extends Document {
  title: string;
  slug: string;
  summary: string;
  content: string;
  category: 'Industry Trends' | 'Tech News' | 'Student Success Story';
  priority: 'normal' | 'high' | 'urgent';
  targetAudience: ('ALL' | 'STUDENT' | 'COLLEGE_ADMIN' | 'TPO' | 'RECRUITER')[];
  coverImage: string;
  authorId: mongoose.Types.ObjectId;
  authorName: string;
  authorRole: string;
  authorAvatar?: string;
  isPinned: boolean;
  isPublished: boolean;
  viewsCount: number;
  likesCount: number;
  likedByUsers: string[];
  comments: IAnnouncementComment[];
  attachments?: IAnnouncementAttachment[];
  publishedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const commentSchema = new Schema({
  id: { type: String, required: true },
  userId: { type: String, required: true },
  userName: { type: String, required: true },
  userRole: { type: String, required: true },
  userAvatar: { type: String },
  content: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
}, { _id: false });

const attachmentSchema = new Schema({
  name: { type: String, required: true },
  url: { type: String, required: true },
  type: { type: String, required: true },
  size: { type: Number, required: true },
}, { _id: false });

const announcementSchema = new Schema(
  {
    title: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    summary: { type: String, required: true },
    content: { type: String, required: true },
    category: {
      type: String,
      enum: ['Industry Trends', 'Tech News', 'Student Success Story'],
      required: true,
    },
    priority: {
      type: String,
      enum: ['normal', 'high', 'urgent'],
      default: 'normal',
    },
    targetAudience: [{
      type: String,
      enum: ['ALL', 'STUDENT', 'COLLEGE_ADMIN', 'TPO', 'RECRUITER'],
    }],
    coverImage: { type: String, default: '' },
    authorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    authorName: { type: String, required: true },
    authorRole: { type: String, required: true },
    authorAvatar: { type: String },
    isPinned: { type: Boolean, default: false },
    isPublished: { type: Boolean, default: true },
    viewsCount: { type: Number, default: 0 },
    likesCount: { type: Number, default: 0 },
    likedByUsers: [{ type: String }],
    comments: [commentSchema],
    attachments: [attachmentSchema],
    publishedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export const Announcement = mongoose.model<IAnnouncement>('Announcement', announcementSchema);
