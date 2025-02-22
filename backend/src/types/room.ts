import { Room } from '@prisma/client';

export type RoomCreateInput = {
  name: string;
  mirotalkRoomId: string;
  streamKey: string;
  password: string;
  expiryDays: number;
};

export type RoomResponse = Pick<Room, 'id' | 'name' | 'link' | 'expiryDate'>;

export type RoomValidationResponse = Pick<Room, 'mirotalkRoomId' | 'streamKey'>; 