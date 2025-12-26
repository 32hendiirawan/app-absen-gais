
import React, { useState, useMemo } from 'react';
import { User, AttendanceRecord, SchoolConfig, UserRole, AttendanceStatus, MessageQueueItem } from '../types';
import { generateReportSummary } from '../services/geminiService';
import * as XLSX from 'xlsx';

interface AdminDashboardProps {
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  attendance: AttendanceRecord[];
  setAttendance: React.Dispatch<React.SetStateAction<AttendanceRecord[]>>;
  messageQueue: MessageQueueItem[];
  setMessageQueue: React.Dispatch<React.SetStateAction<MessageQueueItem[]>>;
  config: SchoolConfig;
  setConfig: React.Dispatch<React.SetStateAction<SchoolConfig>>;
}

type ReportPeriod = 'daily' | 'monthly' | 'semester';

const AdminDashboard: React.FC<AdminDashboardProps> = ({ users, setUsers, attendance, setAttendance, messageQueue, setMessageQueue, config, setConfig }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'students' | 'messages' | 'reports' | 'settings'>('overview');
  const [reportPeriod, setReportPeriod] = useState<ReportPeriod>('daily');
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [isFetchingLocation, setIsFetchingLocation] = useState(false);

  // Student Filter & Sort State
  const [searchTerm, setSearchTerm] = useState('');
  const [sortKey, setSortKey] = useState<keyof User>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Student CRUD State
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  const students = useMemo(() => users.filter(u => u.role === UserRole.STUDENT), [users]);

  const filteredAndSortedStudents = useMemo(() => {
    let result = students;
    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      result = result.filter(s => 
        s.name.toLowerCase().includes(lowerSearch) || 
        s.className.toLowerCase().includes(lowerSearch) ||
        s.username.toLowerCase().includes(lowerSearch)
      );
    }
    result = [...result].sort((a, b) => {
      const aValue = (a[sortKey] || '').toString().toLowerCase();
      const bValue = (b[sortKey] || '').toString().toLowerCase();
      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    return result;
  }, [students, searchTerm, sortKey, sortDirection]);

  const recapData = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(new Date().setHours(0,0,0,0)).getTime();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    
    const isSecondSemester = now.getMonth() < 6;
    const semesterStart = isSecondSemester 
      ? new Date(now.getFullYear(), 0, 1).getTime() 
      : new Date(now.getFullYear(), 6, 1).getTime();

    let filterTimestamp = todayStart;
    if (reportPeriod === 'monthly') filterTimestamp = monthStart;
    if (reportPeriod === 'semester') filterTimestamp = semesterStart;

    return students.map(student => {
      const studentRecords = attendance.filter(r => r.studentId === student.id && r.timestamp >= filterTimestamp);
      
      const counts = {
        [AttendanceStatus.PRESENT]: studentRecords.filter(r => r.status === AttendanceStatus.PRESENT).length,
        [AttendanceStatus.LATE]: studentRecords.filter(r => r.status === AttendanceStatus.LATE).length,
        [AttendanceStatus.SICK]: studentRecords.filter(r => r.status === AttendanceStatus.SICK).length,
        [AttendanceStatus.PERMISSION]: studentRecords.filter(r => r.status === AttendanceStatus.PERMISSION).length,
        [AttendanceStatus.ABSENT]: 0,
      };

      if (reportPeriod === 'daily' && studentRecords.length === 0) {
        counts[AttendanceStatus.ABSENT] = 1;
      }

      return {
        ...student,
        counts,
        total: studentRecords.length
      };
    });
  }, [students, attendance, reportPeriod]);

  const handleExportExcel = () => {
    const date = new Date();
    const fileName = `Laporan_Absensi_${reportPeriod.toUpperCase()}_${date.getFullYear()}_${date.getMonth() + 1}.xlsx`;
    
    const dataToExport = recapData.map((item, index) => ({
      'No': index + 1,
      'Nama Siswa': item.name,
      'Kelas': item.className,
      'Hadir': item.counts[AttendanceStatus.PRESENT],
      'Terlambat': item.counts[AttendanceStatus.LATE],
      'Izin': item.counts[AttendanceStatus.PERMISSION],
      'Sakit': item.counts[AttendanceStatus.SICK],
      'Alpa': item.counts[AttendanceStatus.ABSENT],
      'Total Kehadiran': item.total
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Rekap Absensi");

    // Setting column widths
    const wscols = [
      { wch: 5 },  // No
      { wch: 25 }, // Nama
      { wch: 15 }, // Kelas
      { wch: 10 }, // Hadir
      { wch: 10 }, // Terlambat
      { wch: 10 }, // Izin
      { wch: 10 }, // Sakit
      { wch: 10 }, // Alpa
      { wch: 15 }  // Total
    ];
    worksheet['!cols'] = wscols;

    XLSX.writeFile(workbook, fileName);
  };

  const handleSort = (key: keyof User) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  const handleGenerateSummary = async () => {
    setIsGeneratingAi(true);
    const res = await generateReportSummary(attendance, students);
    setAiSummary(res);
    setIsGeneratingAi(false);
  };

  const deleteUser = (id: string) => {
    if (confirm("Hapus akun siswa ini?")) {
      setUsers(prev => prev.filter(u => u.id !== id));
      setAttendance(prev => prev.filter(r => r.studentId !== id));
      setMessageQueue(prev => prev.filter(m => m.studentId !== id));
    }
  };

  const handleSendMessage = (msg: MessageQueueItem) => {
    const encodedText = encodeURIComponent(msg.message);
    window.open(`https://wa.me/${msg.parentContact}?text=${encodedText}`, '_blank');
    setMessageQueue(prev => prev.filter(item => item.id !== msg.id));
  };

  const deleteFromQueue = (id: string) => {
    setMessageQueue(prev => prev.filter(item => item.id !== id));
  };

  const handleUserSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const userData: User = {
      id: editingUser?.id || `user-${Date.now()}`,
      username: formData.get('username') as string,
      password: (formData.get('password') as string) || editingUser?.password || 'password123',
      role: UserRole.STUDENT,
      name: formData.get('name') as string,
      className: formData.get('className') as string,
      parentContact: formData.get('parentContact') as string,
    };

    if (editingUser) {
      setUsers(prev => prev.map(u => u.id === editingUser.id ? userData : u));
    } else {
      setUsers(prev => [...prev, userData]);
    }
    setShowUserModal(false);
    setEditingUser(null);
  };

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) return alert("Geolokasi tidak didukung.");
    setIsFetchingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setConfig(prev => ({ ...prev, coordinates: { lat: pos.coords.latitude, lng: pos.coords.longitude } }));
        setIsFetchingLocation(false);
        alert("Lokasi diperbarui!");
      },
      () => setIsFetchingLocation(false),
      { enableHighAccuracy: true }
    );
  };

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {[
          { id: 'overview', icon: 'fa-table', label: 'Rekap Kehadiran' },
          { id: 'students', icon: 'fa-user-graduate', label: 'Kelola Siswa' },
          { id: 'messages', icon: 'fa-paper-plane', label: 'Antrean Pesan', badge: messageQueue.length },
          { id: 'settings', icon: 'fa-cog', label: 'Pengaturan' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`relative flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${
              activeTab === tab.id 
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 scale-[1.02]' 
                : 'bg-white text-slate-500 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <i className={`fas ${tab.icon}`}></i>
            {tab.label}
            {tab.badge !== undefined && tab.badge > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full border-2 border-white">
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200">
            <div className="flex bg-slate-100 p-1 rounded-xl w-fit">
              {[
                { id: 'daily', label: 'Harian' },
                { id: 'monthly', label: 'Bulanan' },
                { id: 'semester', label: 'Semester' }
              ].map(p => (
                <button
                  key={p.id}
                  onClick={() => setReportPeriod(p.id as ReportPeriod)}
                  className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                    reportPeriod === p.id ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            
            <div className="flex items-center gap-3">
              <button
                onClick={handleExportExcel}
                className="px-6 py-2 bg-green-50 text-green-700 font-bold rounded-xl hover:bg-green-100 transition-colors flex items-center gap-2 border border-green-200"
              >
                <i className="fas fa-file-excel"></i>
                Ekspor Excel
              </button>
              <button
                onClick={handleGenerateSummary}
                disabled={isGeneratingAi}
                className="px-6 py-2 bg-indigo-50 text-indigo-700 font-bold rounded-xl hover:bg-indigo-100 transition-colors flex items-center gap-2"
              >
                <i className={`fas ${isGeneratingAi ? 'fa-spinner fa-spin' : 'fa-magic'}`}></i>
                Ringkasan AI
              </button>
            </div>
          </div>

          {aiSummary && (
            <div className="bg-indigo-600 p-6 rounded-2xl text-white shadow-xl animate-fade-in relative overflow-hidden">
               <div className="absolute top-0 right-0 p-4 opacity-10">
                 <i className="fas fa-robot text-8xl"></i>
               </div>
               <h3 className="font-bold mb-2 flex items-center gap-2">
                 <i className="fas fa-brain"></i> Analisis Cerdas Gemini
               </h3>
               <p className="text-sm text-indigo-50 leading-relaxed whitespace-pre-wrap relative z-10">{aiSummary}</p>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase font-bold text-left border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4">Nama Siswa / Kelas</th>
                    <th className="px-4 py-4 text-center">Hadir</th>
                    <th className="px-4 py-4 text-center">Terlambat</th>
                    <th className="px-4 py-4 text-center">Izin</th>
                    <th className="px-4 py-4 text-center">Sakit</th>
                    <th className="px-4 py-4 text-center">Alpa</th>
                    <th className="px-4 py-4 text-center">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recapData.map(row => (
                    <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <p className="font-bold text-slate-900 text-sm">{row.name}</p>
                        <p className="text-xs text-slate-500">{row.className}</p>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className={`font-bold ${row.counts[AttendanceStatus.PRESENT] > 0 ? 'text-green-600' : 'text-slate-300'}`}>
                          {row.counts[AttendanceStatus.PRESENT]}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className={`font-bold ${row.counts[AttendanceStatus.LATE] > 0 ? 'text-yellow-600' : 'text-slate-300'}`}>
                          {row.counts[AttendanceStatus.LATE]}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className={`font-bold ${row.counts[AttendanceStatus.PERMISSION] > 0 ? 'text-blue-600' : 'text-slate-300'}`}>
                          {row.counts[AttendanceStatus.PERMISSION]}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className={`font-bold ${row.counts[AttendanceStatus.SICK] > 0 ? 'text-orange-600' : 'text-slate-300'}`}>
                          {row.counts[AttendanceStatus.SICK]}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className={`font-bold ${row.counts[AttendanceStatus.ABSENT] > 0 ? 'text-red-600' : 'text-slate-300'}`}>
                          {row.counts[AttendanceStatus.ABSENT]}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className="font-black text-slate-900">{row.total}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'students' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <h2 className="text-xl font-bold text-slate-900">Data Siswa ({filteredAndSortedStudents.length})</h2>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="relative flex-1">
                <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
                <input 
                  type="text"
                  placeholder="Cari nama, kelas..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full sm:w-64 pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none"
                />
              </div>
              <button 
                onClick={() => { setEditingUser(null); setShowUserModal(true); }}
                className="px-4 py-2 bg-indigo-600 text-white font-bold rounded-lg flex items-center justify-center gap-2 hover:bg-indigo-700"
              >
                <i className="fas fa-plus"></i> Tambah
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-bold text-left">
                <tr>
                  <th className="px-6 py-4 cursor-pointer" onClick={() => handleSort('name')}>Nama & Kelas</th>
                  <th className="px-6 py-4">Username</th>
                  <th className="px-6 py-4">Kontak Ortu</th>
                  <th className="px-6 py-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAndSortedStudents.map(s => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4">
                      <p className="font-bold text-slate-900">{s.name}</p>
                      <p className="text-xs text-slate-500">{s.className}</p>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">{s.username}</td>
                    <td className="px-6 py-4 text-sm text-slate-600 font-mono">{s.parentContact}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => { setEditingUser(s); setShowUserModal(true); }} className="w-8 h-8 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center"><i className="fas fa-edit"></i></button>
                        <button onClick={() => deleteUser(s.id)} className="w-8 h-8 bg-red-50 text-red-600 rounded-lg flex items-center justify-center"><i className="fas fa-trash"></i></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'messages' && (
        <div className="space-y-4">
          <div className="bg-white p-6 rounded-2xl border border-slate-200">
            <h2 className="text-xl font-bold text-slate-900">Antrean Pesan WhatsApp</h2>
            <p className="text-sm text-slate-500 mt-1">Laporan kehadiran yang perlu dikirim ke orang tua.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {messageQueue.map(msg => (
              <div key={msg.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col hover:border-indigo-300 transition-colors">
                <div className="mb-4">
                   <h3 className="font-bold text-slate-900">{msg.studentName}</h3>
                   <p className="text-[10px] text-slate-500 uppercase font-black">{msg.className} • {new Date(msg.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl text-xs text-slate-600 italic mb-6 leading-relaxed flex-1">"{msg.message}"</div>
                <div className="flex gap-2">
                  <button onClick={() => handleSendMessage(msg)} className="flex-1 py-3 bg-green-600 text-white font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-green-700 transition-all"><i className="fab fa-whatsapp"></i> Kirim</button>
                  <button onClick={() => deleteFromQueue(msg.id)} className="w-12 h-12 bg-red-50 text-red-500 rounded-xl flex items-center justify-center hover:bg-red-100 transition-all"><i className="fas fa-trash-alt"></i></button>
                </div>
              </div>
            ))}
            {messageQueue.length === 0 && (
              <div className="col-span-full py-20 bg-white border border-dashed border-slate-200 rounded-2xl text-center text-slate-400">Antrean kosong</div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="max-w-2xl bg-white p-8 rounded-2xl border border-slate-200 shadow-sm space-y-8">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900">Konfigurasi Sekolah</h2>
            <button onClick={handleGetCurrentLocation} className="px-4 py-2 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-lg hover:bg-indigo-100">
              <i className="fas fa-location-arrow mr-2"></i> Update Lokasi
            </button>
          </div>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Jam Masuk (Terlambat Setelah Ini)</label>
              <input type="time" value={config.entranceTime} onChange={(e) => setConfig(prev => ({ ...prev, entranceTime: e.target.value }))} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Radius Kehadiran (Meter)</label>
              <input type="number" value={config.radiusLimit} onChange={(e) => setConfig(prev => ({ ...prev, radiusLimit: parseInt(e.target.value) }))} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Koordinat Sekolah</label>
            <div className="grid grid-cols-2 gap-4">
              <input type="text" value={config.coordinates.lat} readOnly className="p-3 bg-slate-100 border border-slate-200 rounded-xl text-xs font-mono" />
              <input type="text" value={config.coordinates.lng} readOnly className="p-3 bg-slate-100 border border-slate-200 rounded-xl text-xs font-mono" />
            </div>
          </div>
          <button onClick={() => alert('Disimpan!')} className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-100">Simpan Konfigurasi</button>
        </div>
      )}

      {showUserModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden p-8 animate-bounce-in">
            <h3 className="text-xl font-bold mb-6">{editingUser ? 'Edit Siswa' : 'Tambah Siswa'}</h3>
            <form onSubmit={handleUserSubmit} className="space-y-4">
              <input name="name" defaultValue={editingUser?.name} placeholder="Nama Lengkap" required className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl" />
              <input name="username" defaultValue={editingUser?.username} placeholder="Username" required className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl" />
              <input name="className" defaultValue={editingUser?.className} placeholder="Kelas (misal: 12 IPA 1)" required className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl" />
              <input name="parentContact" defaultValue={editingUser?.parentContact} placeholder="No WA Ortu (format: 628xxx)" required className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl" />
              <input name="password" type="password" placeholder="Password Baru" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl" />
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowUserModal(false)} className="flex-1 py-3 border border-slate-200 rounded-xl font-bold text-slate-500">Batal</button>
                <button type="submit" className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-xl">Simpan</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
