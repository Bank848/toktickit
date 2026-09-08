import type { User } from '@prisma/client';

export interface UserAdminDto {
  id: string;
  displayName: string;
  email: string;
  role: 'REQUESTER' | 'IT_STAFF' | 'ADMINISTRATOR';
  isActive: boolean;
  mustChangePassword: boolean;
  createdAt: Date;
}

export function toUserAdminDto(user: User): UserAdminDto {
  return {
    id: user.id,
    displayName: user.displayName,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    mustChangePassword: user.mustChangePassword,
    createdAt: user.createdAt,
  };
}
