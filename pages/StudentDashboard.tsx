
import React, { useState, useEffect } from 'react';
import { User, AttendanceRecord, AttendanceStatus, SchoolConfig, MessageQueueItem } from '../types';
import { calculateDistance, formatDistance } from '../utils/geo';
import { generateWhatsAppMessage } from '../services/geminiService';

interface StudentDashboardProps {
  user: User;
  attendance: AttendanceRecord[];
  setAttendance: React.Dispatch<React.SetStateAction<AttendanceRecord[]>>;
  setMessageQueue: React.Dispatch<React.SetStateAction<MessageQueueItem[]>>;
  config: SchoolConfig;
}

const StudentDashboard: React.FC<StudentDashboardProps> = ({ user, attendance, setAttendance, setMessageQueue, config }) => {
  const [currentLocation, setCurrentLocation] = useState<{lat: number, lng: number} | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [status, setStatus] = useState<AttendanceStatus | null>(null);
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showQueueAlert, setShowQueueAlert] = useState(false);

  useEffect(() => {
    if (navigator.geolocation) {
      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          setCurrentLocation({ lat: latitude, lng: longitude });
          const dist = calculateDistance(latitude, longitude, config.coordinates.lat, config.coordinates.lng);
          setDistance(dist);
        },
        (err) => console.error(err),
        { enableHighAccuracy: true }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, [config]);

  const studentRecords = attendance
    .filter(r => r.studentId === user.id)
    .sort((a, b) => b.timestamp - a.timestamp);

  const hasAbsentedToday = studentRecords.some(r => {
    const today = new Date().setHours(0,0,0,0);
    const recordDate = new Date(r.timestamp).setHours(0,0,0,0);
    return today === recordDate;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!status) return;
    if (status === AttendanceStatus.PRESENT && (distance === null || distance > config.radiusLimit)) {
      alert(`Anda harus berada di radius ${config.radiusLimit}m dari sekolah untuk mengisi hadir.`);
      return;
    }

    setIsSubmitting(true);
    const now = new Date();
    const timestamp = now.getTime();
    
    // Determine if late
    let finalStatus = status;
    if (status === AttendanceStatus.PRESENT) {
      const [limitHours, limitMinutes] = config.entranceTime.split(':').map(Number);
      const entranceLimit = new Date();
      entranceLimit.setHours(limitHours, limitMinutes, 0, 0);
      
      if (now > entranceLimit) {
        finalStatus = AttendanceStatus.LATE;
      }
    }

    const newRecord: AttendanceRecord = {
      id: `record-${timestamp}`,
      studentId: user.id,
      status: finalStatus,
      timestamp: timestamp,
      note: note,
      location: currentLocation && distance !== null ? { ...currentLocation, distance } : undefined
    };

    setAttendance(prev => [newRecord, ...prev]);

    // Create message draft using AI and add to Admin queue
    const waContent = await generateWhatsAppMessage(user, finalStatus, timestamp, note);
    
    const queueItem: MessageQueueItem = {
      id: `msg-${timestamp}`,
      studentId: user.id,
      studentName: user.name,
      className: user.className,
      parentContact: user.parentContact,
      message: waContent || `Informasi Absensi: ${user.name} berstatus ${finalStatus}.`,
      timestamp: timestamp,
      status: finalStatus
    };

    setMessageQueue(prev => [queueItem, ...prev]);
    
    setIsSubmitting(false);
    setStatus(null);
    setNote('');
    setShowQueueAlert(true);
    
    setTimeout(() => setShowQueueAlert(false), 5000);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      {/* Attendance Form */}
      <div className="lg:col-span-4 space-y-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
            <i className="fas fa-fingerprint text-indigo-600"></i>
            Presensi Hari Ini
          </h2>

          {hasAbsentedToday ? (
            <div className="bg-green-50 border border-green-100 p-6 rounded-xl text-center">
              <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center text-white text-2xl mx-auto mb-4">
                <i className="fas fa-check"></i>
              </div>
              <h3 className="font-bold text-green-800 text-lg">Presensi Berhasil</h3>
              <p className="text-green-600 text-sm mt-1">Terima kasih, kehadiran Anda hari ini telah tercatat dan antrean pesan untuk orang tua telah dibuat.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-3">
                <p className="text-sm font-medium text-slate-700">Pilih Status Kehadiran:</p>
                <div className="grid grid-cols-1 gap-3">
                  <button
                    type="button"
                    onClick={() => setStatus(AttendanceStatus.PRESENT)}
                    className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all ${
                      status === AttendanceStatus.PRESENT 
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700' 
                        : 'border-slate-100 hover:border-slate-200 text-slate-600'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <i className="fas fa-check-circle text-lg"></i>
                      <span className="font-bold">Hadir</span>
                    </div>
                    {distance !== null && (
                      <span className={`text-xs px-2 py-1 rounded-full font-bold ${distance <= config.radiusLimit ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {formatDistance(distance)}
                      </span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setStatus(AttendanceStatus.SICK)}
                    className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                      status === AttendanceStatus.SICK 
                        ? 'border-orange-600 bg-orange-50 text-orange-700' 
                        : 'border-slate-100 hover:border-slate-200 text-slate-600'
                    }`}
                  >
                    <i className="fas fa-ambulance text-lg"></i>
                    <span className="font-bold">Sakit</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setStatus(AttendanceStatus.PERMISSION)}
                    className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                      status === AttendanceStatus.PERMISSION 
                        ? 'border-blue-600 bg-blue-50 text-blue-700' 
                        : 'border-slate-100 hover:border-slate-200 text-slate-600'
                    }`}
                  >
                    <i className="fas fa-envelope-open-text text-lg"></i>
                    <span className="font-bold">Izin</span>
                  </button>
                </div>
              </div>

              {(status === AttendanceStatus.SICK || status === AttendanceStatus.PERMISSION) && (
                <div className="space-y-3 animate-fade-in">
                  <label className="block text-sm font-medium text-slate-700">Keterangan / Upload Bukti:</label>
                  <textarea 
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Contoh: Sakit demam tinggi, ada surat dokter..."
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 h-24"
                    required
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={!status || isSubmitting}
                className="w-full py-4 bg-indigo-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-100 hover:bg-indigo-700 disabled:bg-slate-300 transition-all"
              >
                {isSubmitting ? 'Memproses...' : 'Kirim Kehadiran'}
              </button>
            </form>
          )}
        </div>
      </div>

      <div className="lg:col-span-8 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <p className="text-slate-500 text-xs font-bold uppercase">Hadir</p>
            <p className="text-3xl font-black text-indigo-600 mt-1">
              {studentRecords.filter(r => r.status === AttendanceStatus.PRESENT || r.status === AttendanceStatus.LATE).length}
            </p>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <p className="text-slate-500 text-xs font-bold uppercase">Sakit/Izin</p>
            <p className="text-3xl font-black text-orange-500 mt-1">
              {studentRecords.filter(r => r.status === AttendanceStatus.SICK || r.status === AttendanceStatus.PERMISSION).length}
            </p>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <p className="text-slate-500 text-xs font-bold uppercase">Persentase</p>
            <p className="text-3xl font-black text-green-600 mt-1">
              {studentRecords.length > 0 
                ? `${Math.round((studentRecords.filter(r => r.status === AttendanceStatus.PRESENT || r.status === AttendanceStatus.LATE).length / studentRecords.length) * 100)}%`
                : '0%'
              }
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">Riwayat Kehadiran</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-bold text-left">
                <tr>
                  <th className="px-6 py-4">Tanggal & Waktu</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {studentRecords.map(record => (
                  <tr key={record.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="text-sm font-medium text-slate-900">{new Date(record.timestamp).toLocaleDateString('id-ID')}</p>
                      <p className="text-xs text-slate-500">{new Date(record.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold uppercase ${
                        record.status === AttendanceStatus.PRESENT ? 'bg-green-100 text-green-700' :
                        record.status === AttendanceStatus.LATE ? 'bg-yellow-100 text-yellow-700' :
                        record.status === AttendanceStatus.SICK ? 'bg-orange-100 text-orange-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {record.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">{record.note || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentDashboard;
