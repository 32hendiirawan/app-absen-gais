
import React, { useState, useEffect } from 'react';
import { User, UserRole, AttendanceRecord, SchoolConfig, AttendanceStatus, MessageQueueItem } from './types';
import { MOCK_USERS, DEFAULT_SCHOOL_CONFIG } from './constants';
import Login from './pages/Login';
import StudentDashboard from './pages/StudentDashboard';
import AdminDashboard from './pages/AdminDashboard';
import Navbar from './components/Navbar';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>(MOCK_USERS);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [messageQueue, setMessageQueue] = useState<MessageQueueItem[]>([]);
  const [config, setConfig] = useState<SchoolConfig>(DEFAULT_SCHOOL_CONFIG);
  const [isInitialized, setIsInitialized] = useState(false);

  // Persistence logic
  useEffect(() => {
    const storedUsers = localStorage.getItem('absensi_users');
    const storedAttendance = localStorage.getItem('absensi_records');
    const storedConfig = localStorage.getItem('absensi_config');
    const storedQueue = localStorage.getItem('absensi_message_queue');

    if (storedUsers) setUsers(JSON.parse(storedUsers));
    if (storedAttendance) setAttendance(JSON.parse(storedAttendance));
    if (storedConfig) setConfig(JSON.parse(storedConfig));
    if (storedQueue) setMessageQueue(JSON.parse(storedQueue));
    
    setIsInitialized(true);
  }, []);

  useEffect(() => {
    if (isInitialized) {
      localStorage.setItem('absensi_users', JSON.stringify(users));
      localStorage.setItem('absensi_records', JSON.stringify(attendance));
      localStorage.setItem('absensi_config', JSON.stringify(config));
      localStorage.setItem('absensi_message_queue', JSON.stringify(messageQueue));
    }
  }, [users, attendance, config, messageQueue, isInitialized]);

  const handleLogin = (username: string, pass: string) => {
    const user = users.find(u => u.username === username && u.password === pass);
    if (user) {
      setCurrentUser(user);
      return true;
    }
    return false;
  };

  const handleLogout = () => {
    setCurrentUser(null);
  };

  if (!currentUser) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar user={currentUser} onLogout={handleLogout} />
      <main className="container mx-auto px-4 py-8 max-w-7xl">
        {currentUser.role === UserRole.ADMIN ? (
          <AdminDashboard 
            users={users} 
            setUsers={setUsers}
            attendance={attendance}
            setAttendance={setAttendance}
            messageQueue={messageQueue}
            setMessageQueue={setMessageQueue}
            config={config}
            setConfig={setConfig}
          />
        ) : (
          <StudentDashboard 
            user={currentUser} 
            attendance={attendance}
            setAttendance={setAttendance}
            setMessageQueue={setMessageQueue}
            config={config}
          />
        )}
      </main>
    </div>
  );
};

export default App;
