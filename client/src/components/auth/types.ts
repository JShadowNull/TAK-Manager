export interface User {
  username: string;
  is_admin: boolean;
}

export interface PasswordResetErrors {
  currentPassword?: string;
  newPassword?: string;
  confirmPassword?: string;
}

export interface UserAddErrors {
  username?: string;
  password?: string;
  confirmPassword?: string;
} 