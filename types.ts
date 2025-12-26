
export enum UserRole {
  ADMIN = 'ADMIN',
  STUDENT = 'STUDENT'
}

export enum AttendanceStatus {
  PRESENT = 'HADIR',
  LATE = 'TERLAMBAT',
  SICK = 'SAKIT',
  PERMISSION = 'IZIN',
  ABSENT = 'ALPHA'
}

export interface User {
  id: string;
  username: string;
  password?: string;
  role: UserRole;
  name: string;
  className: string;
  parentContact: string;
}

export interface AttendanceRecord {
  id: string;
  studentId: string;
  status: AttendanceStatus;
  timestamp: number;
  location?: {
    lat: number;
    lng: number;
    distance: number;
  };
  proofUrl?: string;
  note?: string;
}

export interface MessageQueueItem {
  id: string;
  studentId: string;
  studentName: string;
  className: string;
  parentContact: string;
  message: string;
  timestamp: number;
  status: AttendanceStatus;
}

export interface SchoolConfig {
  entranceTime: string; // HH:mm
  coordinates: {
    lat: number;
    lng: number;
  };
  radiusLimit: number; // in meters
}
