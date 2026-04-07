export type UserRole = 'student' | 'admin' | 'staff';

export interface UserProfile {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
  role: UserRole;
  department?: string;
  phone?: string;
  position?: string;
  code?: string;
}

export interface AllowedUser {
  id?: string;
  code: string;
  position: string;
  name: string;
  email: string;
  phone: string;
  department: string;
}

export type StudioStatus = 'available' | 'occupied' | 'maintenance';

export interface Studio {
  id: string;
  name: string;
  type?: string;
  description?: string;
  status: StudioStatus;
  image?: string;
}

export type BookingStatus = 'pending' | 'confirmed' | 'cancelled';

export interface Booking {
  id: string;
  studioId: string;
  studioName: string;
  userId: string;
  userName: string;
  userEmail: string;
  userPhone?: string;
  userDepartment?: string;
  userCode?: string;
  userPosition?: string;
  date: string; // YYYY-MM-DD
  startTime: string;
  endTime: string;
  title: string;
  notes?: string;
  status: BookingStatus;
  createdAt: number; // timestamp
}

export interface BlockedDate {
  id: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  reason: string;
  createdAt: any; // timestamp
  createdBy: string;
}
