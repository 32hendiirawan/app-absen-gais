
import { User, UserRole, SchoolConfig } from './types';

export const DEFAULT_SCHOOL_CONFIG: SchoolConfig = {
  entranceTime: '07:30',
  coordinates: {
    lat: -6.2000, // Jakarta Area
    lng: 106.8166
  },
  radiusLimit: 100 // 100 meters
};

export const MOCK_USERS: User[] = [
  {
    id: 'admin-1',
    username: 'admin',
    password: 'password123',
    role: UserRole.ADMIN,
    name: 'Administrator',
    className: 'N/A',
    parentContact: '-'
  },
  {
    id: 'student-1',
    username: 'budi',
    password: 'password123',
    role: UserRole.STUDENT,
    name: 'Budi Santoso',
    className: '12 IPA 1',
    parentContact: '6281234567890'
  },
  {
    id: 'student-2',
    username: 'siti',
    password: 'password123',
    role: UserRole.STUDENT,
    name: 'Siti Aminah',
    className: '12 IPS 2',
    parentContact: '6289876543210'
  }
];
