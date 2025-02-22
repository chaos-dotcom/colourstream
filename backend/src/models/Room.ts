import mongoose, { Document, Schema, CallbackError } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IRoom extends Document {
  name: string;
  mirotalkRoomId: string;
  streamKey: string;
  password: string;
  expiryDate: Date;
  link: string;
  createdAt: Date;
  isPasswordValid(password: string): Promise<boolean>;
}

const roomSchema = new Schema<IRoom>({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  mirotalkRoomId: {
    type: String,
    required: true,
    unique: true,
  },
  streamKey: {
    type: String,
    required: true,
  },
  password: {
    type: String,
    required: true,
  },
  expiryDate: {
    type: Date,
    required: true,
  },
  link: {
    type: String,
    required: true,
    unique: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Hash password before saving
roomSchema.pre('save', async function(this: IRoom, next: (err?: CallbackError) => void) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error as CallbackError);
  }
});

// Method to check if password is valid
roomSchema.methods.isPasswordValid = async function(this: IRoom, password: string): Promise<boolean> {
  return bcrypt.compare(password, this.password);
};

// Add index for querying expired rooms
roomSchema.index({ expiryDate: 1 });

export const Room = mongoose.model<IRoom>('Room', roomSchema); 