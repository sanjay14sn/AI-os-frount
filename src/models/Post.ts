import mongoose, { Document, Schema } from 'mongoose';

export interface IPost extends Document {
  author: mongoose.Types.ObjectId;
  title?: string;
  content: string;
  type: 'achievement' | 'project' | 'question' | 'opportunity' | 'requirement';
  hashtags: string[];
  bullets?: string[];
  media: string[];
  likes: mongoose.Types.ObjectId[];
  comments: {
    author: mongoose.Types.ObjectId;
    content: string;
    createdAt: Date;
  }[];
  createdAt: Date;
  updatedAt: Date;
}

const postSchema = new Schema(
  {
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String },
    content: { type: String, required: true },
    type: { 
      type: String, 
      enum: ['achievement', 'project', 'question', 'opportunity', 'requirement'],
      default: 'achievement' 
    },
    hashtags: [{ type: String }],
    bullets: [{ type: String }],
    media: [{ type: String }],
    likes: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    comments: [
      {
        author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        content: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

export const Post = mongoose.model<IPost>('Post', postSchema);
