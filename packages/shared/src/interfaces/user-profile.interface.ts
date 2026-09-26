export interface UserProfile {
  id: string;
  telegramId: string;
  username?: string | null;
  firstName: string;
  lastName?: string | null;
  photoUrl?: string | null;
  languageCode?: string | null;
  lastActiveAt: string;
  createdAt: string;
  staffRole?: 'ADMIN' | 'MANAGER' | null;
}
