import mongoose, { Document, Schema } from 'mongoose';

export type EventType = 'Webinar' | 'Orientation' | 'Masterclass';

export interface IEvent extends Document {
  title: string;
  description: string;
  date: Date;
  startTime: string;
  endTime: string;
  location: string;
  speaker: string;
  speakerRole: string;
  speakerAvatar?: string;
  image?: string;
  type: EventType;
  organizer: mongoose.Types.ObjectId;
  collegeId: mongoose.Types.ObjectId;
  attendees: mongoose.Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const eventSchema = new Schema<IEvent>(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    date: { type: Date, required: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    location: { type: String, required: true, trim: true },
    speaker: { type: String, required: true, trim: true },
    speakerRole: { type: String, default: '' },
    speakerAvatar: { type: String },
    image: { type: String },
    type: {
      type: String,
      enum: ['Webinar', 'Orientation', 'Masterclass'],
      required: true,
    },
    organizer: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    collegeId: { type: Schema.Types.ObjectId, ref: 'College', required: true, index: true },
    attendees: [{ type: Schema.Types.ObjectId, ref: 'User' }],
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

export const Event = mongoose.model<IEvent>('Event', eventSchema);
