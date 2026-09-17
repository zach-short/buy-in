export interface User {
  id: string;
  name?: string;
  email?: string;
  picture?: string;
  bio?: string;
  isDeleted?: boolean;
  deletedAt?: string;
}

export type UserRole = 'admin' | 'user';
