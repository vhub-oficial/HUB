export type Role = 'viewer' | 'editor' | 'admin';

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  organization_id: string;
  role: Role;
  avatar_url?: string;
  is_active?: boolean;
}

export interface Folder {
  id: string;
  name: string;
  parent_id: string | null;
  organization_id: string;
  created_at: string;
}

export interface Asset {
  id: string;
  name: string;
  url: string; // Public or Signed URL
  size_mb: number;
  type: 'video' | 'audio' | 'image';
  tags: string[]; // Stored as array in DB
  folder_id: string | null;
  organization_id: string;
  created_at: string;
  thumbnail_url?: string;
}

export interface FeedbackData {
  rating: number;
  message: string;
  page: string;
}
