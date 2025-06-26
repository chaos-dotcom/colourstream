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
