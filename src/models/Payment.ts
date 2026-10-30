import mongoose, { Document, Schema } from 'mongoose';

export interface IPayment extends Document {
  orderId: string;
  paymentId?: string;
  signature?: string;
  amount: number; // in paise
  currency: string;
  status: 'created' | 'paid' | 'failed' | 'refunded';
  receipt?: string;
  notes?: Record<string, any>;
  description?: string;
  studentEmail?: string;
  studentId?: string;
  collegeId?: string;
  paidAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const paymentSchema = new Schema<IPayment>(
  {
    orderId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    paymentId: {
      type: String,
      index: true,
    },
    signature: {
      type: String,
    },
    amount: {
      type: Number,
      required: true,
      min: 100, // min 100 paise
    },
    currency: {
      type: String,
      default: 'INR',
      uppercase: true,
    },
    status: {
      type: String,
      enum: ['created', 'paid', 'failed', 'refunded'],
      default: 'created',
      index: true,
    },
    receipt: {
      type: String,
    },
    notes: {
      type: Schema.Types.Mixed,
      default: {},
    },
    description: {
      type: String,
    },
    studentEmail: {
      type: String,
      lowercase: true,
      trim: true,
    },
    studentId: {
      type: String,
    },
    collegeId: {
      type: String,
    },
    paidAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

export const Payment = mongoose.model<IPayment>('Payment', paymentSchema);
