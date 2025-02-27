import { Room } from '@prisma/client';

// Type for incoming request body
export type RoomCreateBody = {
  name: string;
  password: string;
  expiryDays: number;
};

// Type for Prisma create operation
export type RoomCreateInput = {
  id: string;
  name: string;
  mirotalkRoomId: string;
  streamKey: string;
  password: string;
  displayPassword: string;
  expiryDate: Date;
  link: string;
  presenterLink?: string;
  mirotalkToken?: string;
};

export type RoomResponse = Omit<Room, 'password'> & {
  displayPassword: string;
};

// Using Prisma.RoomSelect to ensure type safety
export type RoomSelect = {
  id?: boolean;
  name?: boolean;
  mirotalkRoomId?: boolean;
  streamKey?: boolean;
  password?: boolean;
  displayPassword?: boolean;
  expiryDate?: boolean;
  link?: boolean;
  presenterLink?: boolean;
  mirotalkToken?: boolean;
  createdAt?: boolean;
};

export type RoomValidationResponse = {
  mirotalkRoomId: string;
  streamKey: string;
  mirotalkToken?: string;
  isPresenter?: boolean;
}; 