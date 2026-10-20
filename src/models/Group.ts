import mongoose, { Document, Schema } from 'mongoose';

export interface IGroup extends Document {
  name: string;
  description: string;
  members: mongoose.Types.ObjectId[];
  admins: mongoose.Types.ObjectId[];
  avatar?: string;
  createdAt: Date;
  updatedAt: Date;
}

const groupSchema = new Schema(
  {
    name: { type: String, required: true },
    description: { type: String, required: true },
    members: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    admins: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    avatar: { type: String },
  },
  { timestamps: true }
);

export const Group = mongoose.model<IGroup>('Group', groupSchema);
