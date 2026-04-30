import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  Calendar as CalendarIcon, 
  UserPlus, 
  Trash2, 
  CheckCircle2, 
  XCircle, 
  Search, 
  Filter, 
  ChevronLeft, 
  ChevronRight,
  Mail,
  CalendarDays,
  UserCheck,
  Lock,
  Upload,
  Download,
  Edit2,
  X
} from 'lucide-react';
import { 
  collection, 
  onSnapshot, 
  query, 
  where, 
  getDocs, 
  setDoc,
  doc, 
  deleteDoc, 
  updateDoc,
  addDoc,
  orderBy,
  serverTimestamp
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Booking, Studio, AllowedUser, UserProfile, BlockedDate } from '../types';
import { format, startOfMonth, endOfMonth, eachMonthOfInterval, subMonths, addMonths } from 'date-fns';
import { th } from 'date-fns/locale';
import { useAuth } from '../App';
import { sendEmail } from '../services/emailService';
import { getDepartmentName, ADMIN_EMAILS } from '../constants';

import Papa from 'papaparse';

export default function AdminDashboard() {
  const { accessToken, user: firebaseUser, profile, signIn } = useAuth();
  const [activeTab, setActiveTab] = useState<'bookings' | 'users' | 'blocked'>('bookings');
  const isAdmin = profile?.role === 'admin' || (firebaseUser?.email && ADMIN_EMAILS.includes(firebaseUser.email.toLowerCase()));
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [allowedUsers, setAllowedUsers] = useState<AllowedUser[]>([]);
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Blocked Dates State
  const [newBlockedDate, setNewBlockedDate] = useState({ startDate: '', endDate: '', reason: '' });

  // Upload State
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Confirmation Dialog State
  const [confirmingBooking, setConfirmingBooking] = useState<Booking | null>(null);
  const [confirmingDeleteBlockedDate, setConfirmingDeleteBlockedDate] = useState<BlockedDate | null>(null);
  const [confirmingCancelBooking, setConfirmingCancelBooking] = useState<string | null>(null);
  const [confirmingDeleteBooking, setConfirmingDeleteBooking] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    if (!firebaseUser) return;

    // Fetch Bookings for current month
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    const qBookings = query(
      collection(db, 'bookings'),
      where('date', '>=', format(start, 'yyyy-MM-dd')),
      where('date', '<=', format(end, 'yyyy-MM-dd')),
      orderBy('date', 'asc')
    );

    const unsubscribeBookings = onSnapshot(qBookings, (snapshot) => {
      setBookings(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Booking)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'bookings');
    });

    // Fetch Allowed Users
    const unsubscribeUsers = onSnapshot(collection(db, 'allowed_users'), (snapshot) => {
      setAllowedUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AllowedUser)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'allowed_users');
    });

    // Fetch Blocked Dates
    const unsubscribeBlocked = onSnapshot(collection(db, 'blocked_dates'), (snapshot) => {
      setBlockedDates(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BlockedDate)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'blocked_dates');
    });

    return () => {
      unsubscribeBookings();
      unsubscribeUsers();
      unsubscribeBlocked();
    };
  }, [currentMonth, firebaseUser]);

  const handleCancelBooking = async (id: string) => {
    const path = `bookings/${id}`;
    try {
      await updateDoc(doc(db, 'bookings', id), { status: 'cancelled' });
      setConfirmingCancelBooking(null);
      console.log('Booking cancelled successfully');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  const handleDeleteBooking = async (id: string) => {
    const path = `bookings/${id}`;
    try {
      await deleteDoc(doc(db, 'bookings', id));
      setConfirmingDeleteBooking(null);
      console.log('Booking deleted successfully');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  const handleAddBlockedDate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBlockedDate.startDate || !newBlockedDate.endDate || !newBlockedDate.reason) {
      alert('กรุณาระบุวันที่เริ่มต้น วันที่สิ้นสุด และเหตุผล');
      return;
    }

    const start = new Date(newBlockedDate.startDate);
    const end = new Date(newBlockedDate.endDate);

    if (end < start) {
      alert('End date cannot be before start date.');
      return;
    }

    const rangeId = `${newBlockedDate.startDate}_${newBlockedDate.endDate}`;
    const path = `blocked_dates/${rangeId}`;
    try {
      await setDoc(doc(db, 'blocked_dates', rangeId), {
        id: rangeId,
        startDate: newBlockedDate.startDate,
        endDate: newBlockedDate.endDate,
        reason: newBlockedDate.reason,
        createdAt: serverTimestamp(),
        createdBy: firebaseUser?.uid || 'admin'
      });
      
      setNewBlockedDate({ startDate: '', endDate: '', reason: '' });
    } catch (error) {
      console.error('Error blocking dates:', error);
    }
  };

  const handleRemoveBlockedDate = async (id: string) => {
    if (!id) return;
    const path = `blocked_dates/${id}`;
    try {
      await deleteDoc(doc(db, 'blocked_dates', id));
      setConfirmingDeleteBlockedDate(null);
      console.log('Date unblocked successfully');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadProgress(0);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => {
        const cleanHeader = header.trim().replace(/^[\uFEFF\xA0]+|[\uFEFF\xA0]+$/g, '');
        const headerMap: Record<string, string> = {
          'รหัส': 'code',
          'ตำแหน่ง': 'position',
          'ชื่อ-นามสกุล': 'name',
          'อีเมล์': 'email',
          'โทรศัพท์': 'phone',
          'หน่วยงาน': 'department',
          'id': 'code',
          'code': 'code',
          'position': 'position',
          'name': 'name',
          'email': 'email',
          'phone': 'phone',
          'department': 'department'
        };
        return headerMap[cleanHeader] || cleanHeader.toLowerCase();
      },
      complete: async (results) => {
        const users = results.data as any[];
        let processed = 0;
        let errors = 0;
        
        for (const user of users) {
          if (user.email) {
            try {
              const emailId = user.email.toLowerCase().replace(/\./g, '_');
              // Clean up phone number if it has quotes or extra spaces
              const phone = user.phone ? user.phone.replace(/"/g, '').trim() : '';
              
              // Clean up undefined values
              const cleanUser = Object.fromEntries(
                Object.entries(user).map(([k, v]) => [k, v === undefined ? null : v])
              );

              await setDoc(doc(db, 'allowed_users', emailId), {
                ...cleanUser,
                code: user.code ? String(user.code) : '',
                name: user.name ? String(user.name) : '',
                position: user.position ? String(user.position) : '',
                department: user.department ? String(user.department) : '',
                phone,
                email: user.email.toLowerCase()
              });
            } catch (err) {
              console.error(`Error uploading user ${user.email}:`, err);
              errors++;
            }
          }
          processed++;
          setUploadProgress(Math.round((processed / users.length) * 100));
        }

        setIsUploading(false);
        setUploadProgress(0);
        if (errors > 0) {
          alert(`อัปโหลดสำเร็จ ${users.length - errors} รายการ, ล้มเหลว ${errors} รายการ`);
        } else {
          alert(`อัปโหลดรายชื่อผู้ใช้งานสำเร็จ ${users.length} รายการ`);
        }
      },
      error: (error) => {
        console.error('CSV Parse Error:', error);
        setIsUploading(false);
        setUploadProgress(0);
        alert('เกิดข้อผิดพลาดในการอ่านไฟล์ CSV');
      }
    });
  };

  const sendConfirmation = async (booking: Booking) => {
    console.log('sendConfirmation called for booking:', booking.id);
    
    setIsSending(true);
    try {
      // 1. Update booking status to confirmed FIRST so the UI updates immediately
      if (booking.status === 'pending') {
        console.log('Updating booking status to confirmed...');
        await updateDoc(doc(db, 'bookings', booking.id), { status: 'confirmed' });
        console.log('Booking status updated');
      }

      // 2. Call Google Apps Script Webhook
      const scriptUrl = import.meta.env.VITE_GOOGLE_SCRIPT_URL || 'https://script.google.com/macros/s/AKfycbwz2mXDGsvqI0XRHHrtEnTqM7ewlHtIpkDY4wwECjtxjCHpaWBYBZTqRgAxQQ6Gm2Vk/exec';
      
      if (scriptUrl) {
        console.log('Calling Google Apps Script to send email and calendar...');
        try {
          await fetch(scriptUrl, {
            method: 'POST',
            mode: 'no-cors', // Use no-cors to bypass CORS block on the browser
            headers: {
              'Content-Type': 'text/plain;charset=utf-8', // Use text/plain to avoid OPTIONS preflight
            },
            body: JSON.stringify({
              type: 'booking_confirmed',
              booking: booking
            }),
          });
          console.log('Webhook triggered');
        } catch (fetchErr) {
          console.error('Error triggering webhook:', fetchErr);
        }
      } else {
        console.warn('VITE_GOOGLE_SCRIPT_URL is not set. Skipping email and calendar.');
      }

      alert('ยืนยันการจองสำเร็จ!');
      setConfirmingBooking(null);
    } catch (error: any) {
      console.error('Error sending confirmation:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      alert(`เกิดข้อผิดพลาด: ${errorMessage}`);
    } finally {
      setIsSending(false);
    }
  };

  const filteredBookings = bookings.filter(b => 
    b.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    b.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="px-4 md:px-8 max-w-7xl mx-auto pb-24">
      <header className="mb-12">
        <p className="text-primary font-bold tracking-widest uppercase text-xs mb-2">ศูนย์ควบคุมผู้ดูแลระบบ</p>
        <h2 className="text-4xl md:text-6xl font-extrabold tracking-tight text-on-surface leading-tight">ระบบจัดการ <span className="text-primary">หลังบ้าน</span></h2>
      </header>

      {(!firebaseUser || !accessToken) && (
        <div className="mb-8 p-6 bg-warning/10 border border-warning/20 rounded-2xl flex flex-col md:flex-row items-center gap-4 text-warning">
          <div className="w-12 h-12 bg-warning/20 rounded-full flex items-center justify-center shrink-0">
            <Lock className="w-6 h-6" />
          </div>
          <div className="flex-1 text-center md:text-left">
            <h4 className="font-bold text-lg">Google Authentication Required</h4>
            <p className="text-sm opacity-80">
              {!firebaseUser 
                ? "While you've unlocked the dashboard with a password, Firestore data access requires a valid Google login. Please sign in with your @bu.ac.th account."
                : "Your Google session has expired or the access token is missing. Please sign in again to enable Email and Calendar integration features."}
            </p>
          </div>
          <button 
            onClick={signIn}
            className="px-6 py-2 bg-warning text-on-warning font-bold rounded-xl hover:bg-warning/80 transition-colors"
          >
            {firebaseUser ? 'Re-authenticate' : 'Sign In Now'}
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-4 mb-8 border-b border-outline-variant/20 overflow-x-auto pb-2">
        <button 
          onClick={() => setActiveTab('bookings')}
          className={`pb-4 px-2 font-headline font-bold text-sm transition-all relative whitespace-nowrap ${activeTab === 'bookings' ? 'text-primary' : 'text-on-surface/40'}`}
        >
          รายการจอง
          {activeTab === 'bookings' && <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-1 bg-primary rounded-full" />}
        </button>
        <button 
          onClick={() => setActiveTab('users')}
          className={`pb-4 px-2 font-headline font-bold text-sm transition-all relative whitespace-nowrap ${activeTab === 'users' ? 'text-primary' : 'text-on-surface/40'}`}
        >
          รายชื่ออาจารย์/บุคลากร
          {activeTab === 'users' && <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-1 bg-primary rounded-full" />}
        </button>
        <button 
          onClick={() => setActiveTab('blocked')}
          className={`pb-4 px-2 font-headline font-bold text-sm transition-all relative whitespace-nowrap ${activeTab === 'blocked' ? 'text-primary' : 'text-on-surface/40'}`}
        >
          วันที่ปิด/ไม่ว่าง
          {activeTab === 'blocked' && <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-1 bg-primary rounded-full" />}
        </button>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'bookings' && (
          <motion.div 
            key="bookings"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {/* Month Selector & Search */}
            <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-surface-container-low p-4 rounded-2xl border border-outline-variant/10">
              <div className="flex items-center gap-4">
                <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-2 hover:bg-surface-container-high rounded-full transition-colors">
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <h3 className="font-headline font-bold text-lg min-w-[150px] text-center">{format(currentMonth, 'MMMM yyyy', { locale: th })}</h3>
                <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-2 hover:bg-surface-container-high rounded-full transition-colors">
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
              <div className="relative w-full md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-outline" />
                <input 
                  type="text" 
                  placeholder="ค้นหารายการจอง..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-xl pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                />
              </div>
            </div>

            {/* Bookings Table */}
            <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-surface-container-low/50 border-b border-outline-variant/10">
                      <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-outline">วันที่และเวลา</th>
                      <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-outline">ผู้จอง</th>
                      <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-outline">แผนก/คณะ</th>
                      <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-outline">หัวข้อ</th>
                      <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-outline">สถานะ</th>
                      <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-outline text-right">การจัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/10">
                    {filteredBookings.length > 0 ? filteredBookings.map((booking) => (
                      <tr key={booking.id} className="hover:bg-surface-container-low/30 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="font-bold text-sm">{format(new Date(booking.date), 'dd MMM yyyy', { locale: th })}</span>
                            <span className="text-xs text-outline">{booking.startTime} - {booking.endTime}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                              {booking.userName.charAt(0)}
                            </div>
                            <div className="flex flex-col">
                              <span className="text-sm font-medium">{booking.userName}</span>
                              {booking.userPhone && <span className="text-[10px] text-outline">{booking.userPhone}</span>}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-xs text-outline">{getDepartmentName(booking.userDepartment)}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm font-medium line-clamp-1">{booking.title}</span>
                        </td>
                        <td className="px-6 py-4">
                          <button 
                            onClick={() => booking.status === 'pending' && setConfirmingBooking(booking)}
                            className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase border transition-all ${
                              booking.status === 'confirmed' ? 'bg-tertiary/10 text-tertiary border-tertiary/20' :
                              booking.status === 'cancelled' ? 'bg-error/10 text-error border-error/20' :
                              'bg-secondary/10 text-secondary border-secondary/20 hover:bg-secondary/20 cursor-pointer'
                            }`}
                            title={booking.status === 'pending' ? 'คลิกเพื่อยืนยันและส่งอีเมล' : undefined}
                          >
                            {booking.status === 'confirmed' ? 'ยืนยันแล้ว' :
                             booking.status === 'cancelled' ? 'ยกเลิกแล้ว' :
                             'รอการยืนยัน'}
                          </button>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button 
                              onClick={() => setConfirmingBooking(booking)}
                              title="ส่งอีเมลยืนยัน"
                              className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors"
                            >
                              <Mail className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => setConfirmingCancelBooking(booking.id)}
                              title="ยกเลิกการจอง"
                              className="p-2 text-secondary hover:bg-secondary/10 rounded-lg transition-colors"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => setConfirmingDeleteBooking(booking.id)}
                              title="ลบรายการจอง"
                              className="p-2 text-error hover:bg-error/10 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center text-outline italic">ไม่พบรายการจองสำหรับเดือนนี้</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'users' && (
          <motion.div 
            key="users"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-8"
          >
            <div className="lg:col-span-4">
              <div className="bg-surface-container-low p-6 rounded-2xl border border-outline-variant/10">
                <h3 className="font-headline font-bold text-lg mb-4 flex items-center gap-2">
                  <Upload className="w-5 h-5 text-primary" />
                  อัปโหลดรายชื่อผู้ใช้งาน
                </h3>
                <p className="text-xs text-on-surface-variant mb-6 leading-relaxed">
                  อัปโหลดไฟล์ CSV ที่มีคอลัมน์: <span className="font-bold">id หรือ code, position, name, email, phone, department</span>
                </p>
                
                <div className="relative group">
                  <input 
                    type="file" 
                    accept=".csv" 
                    onChange={handleFileUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    disabled={isUploading}
                  />
                  <div className={`border-2 border-dashed border-outline-variant/30 rounded-2xl p-8 text-center transition-all group-hover:border-primary/50 ${isUploading ? 'bg-surface-container-high' : 'bg-surface-container-lowest'}`}>
                    {isUploading ? (
                      <div className="space-y-4">
                        <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto"></div>
                        <p className="text-sm font-bold text-primary">กำลังอัปโหลด {uploadProgress}%</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-2">
                          <Upload className="w-6 h-6 text-primary" />
                        </div>
                        <p className="text-sm font-bold">คลิกหรือลากไฟล์ CSV</p>
                        <p className="text-[10px] text-outline">ขนาดไฟล์สูงสุด: 5MB</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-8">
              <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 overflow-hidden shadow-sm">
                <div className="p-4 border-b border-outline-variant/10 flex justify-between items-center">
                  <h3 className="font-headline font-bold">รายชื่ออาจารย์/บุคลากร ({allowedUsers.length})</h3>
                  <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-outline" />
                    <input 
                      type="text" 
                      placeholder="ค้นหาชื่อ, อีเมล, หน่วยงาน..." 
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-surface-container-low border border-outline-variant/20 rounded-xl pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                    />
                  </div>
                </div>
                <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 bg-surface-container-low/90 backdrop-blur-sm z-10">
                      <tr className="border-b border-outline-variant/10">
                        <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-outline">รหัส</th>
                        <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-outline">ชื่อ-นามสกุล</th>
                        <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-outline">ตำแหน่ง</th>
                        <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-outline">หน่วยงาน</th>
                        <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-outline">อีเมล</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/10">
                      {allowedUsers
                        .filter(u => 
                          (u.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (u.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (u.department || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (u.code || '').toLowerCase().includes(searchQuery.toLowerCase())
                        )
                        .map((user) => (
                        <tr key={user.id} className="hover:bg-surface-container-low/30 transition-colors">
                          <td className="px-6 py-4 text-sm font-medium text-on-surface-variant">{user.code}</td>
                          <td className="px-6 py-4 text-sm font-bold text-on-surface">{user.name}</td>
                          <td className="px-6 py-4 text-sm text-on-surface-variant">{user.position}</td>
                          <td className="px-6 py-4 text-sm text-on-surface-variant">{user.department}</td>
                          <td className="px-6 py-4 text-sm text-outline">{user.email}</td>
                        </tr>
                      ))}
                      {allowedUsers.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-6 py-12 text-center text-outline italic">ยังไม่มีข้อมูลบุคลากร</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'blocked' && (
          <motion.div 
            key="blocked"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-8"
          >
            <div className="lg:col-span-4">
              <form onSubmit={handleAddBlockedDate} className="bg-surface-container-low p-6 rounded-2xl border border-outline-variant/10 space-y-4">
                <h3 className="font-headline font-bold text-lg mb-4 flex items-center gap-2">
                  <Lock className="w-5 h-5 text-primary" />
                  ปิดวันที่ใหม่
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-outline px-1">วันที่เริ่มต้น</label>
                    <input 
                      type="date" 
                      required
                      value={newBlockedDate.startDate}
                      onChange={(e) => setNewBlockedDate({...newBlockedDate, startDate: e.target.value})}
                      className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-outline px-1">วันที่สิ้นสุด</label>
                    <input 
                      type="date" 
                      required
                      value={newBlockedDate.endDate}
                      onChange={(e) => setNewBlockedDate({...newBlockedDate, endDate: e.target.value})}
                      className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-outline px-1">เหตุผล / หมายเหตุ</label>
                  <input 
                    type="text" 
                    required
                    value={newBlockedDate.reason}
                    onChange={(e) => setNewBlockedDate({...newBlockedDate, reason: e.target.value})}
                    className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                    placeholder="เช่น ปิดปรับปรุงสตูดิโอ, วันหยุดนักขัตฤกษ์"
                  />
                </div>

                <button 
                  type="submit" 
                  className="w-full py-4 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/20 hover:bg-primary-container transition-all active:scale-95 mt-4"
                >
                  ปิดวันที่
                </button>
              </form>
            </div>

            <div className="lg:col-span-8">
              <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 overflow-hidden shadow-sm">
                <div className="p-4 border-b border-outline-variant/10">
                  <h3 className="font-headline font-bold">วันที่ปิดปรับปรุง/ไม่ว่าง ({blockedDates.length})</h3>
                </div>
                <div className="divide-y divide-outline-variant/10">
                  {blockedDates.sort((a, b) => (b.startDate || '').localeCompare(a.startDate || '')).map((bd) => (
                    <div key={bd.id} className="flex items-center justify-between p-4 hover:bg-surface-container-low/20 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-error/10 flex items-center justify-center text-error">
                          <Lock className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="font-bold text-sm">
                            {(!bd.startDate || !bd.endDate) 
                              ? (bd as any).date || 'ไม่ทราบวันที่'
                              : bd.startDate === bd.endDate 
                                ? format(new Date(bd.startDate), 'dd MMMM yyyy')
                                : `${format(new Date(bd.startDate), 'dd MMM')} - ${format(new Date(bd.endDate), 'dd MMM yyyy')}`
                            }
                          </h4>
                          <p className="text-xs text-outline">{bd.reason}</p>
                        </div>
                      </div>
                      <button 
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setConfirmingDeleteBlockedDate(bd);
                        }}
                        className="p-3 text-error hover:bg-error/10 rounded-xl transition-all group"
                        title="ยกเลิกการปิดวันที่"
                      >
                        <Trash2 className="w-5 h-5 group-hover:scale-110 transition-transform" />
                      </button>
                    </div>
                  ))}
                  {blockedDates.length === 0 && (
                    <div className="py-12 text-center text-outline italic">ขณะนี้ไม่มีการปิดวันที่</div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Blocked Date Deletion Confirmation */}
      <AnimatePresence>
        {confirmingDeleteBlockedDate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setConfirmingDeleteBlockedDate(null)}
              className="absolute inset-0 bg-on-surface/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-surface-container-lowest rounded-3xl shadow-2xl overflow-hidden border border-outline-variant/10"
            >
              <div className="p-8">
                <div className="w-16 h-16 bg-error/10 rounded-full flex items-center justify-center mb-6 mx-auto">
                  <Trash2 className="w-8 h-8 text-error" />
                </div>
                <h3 className="text-2xl font-headline font-bold text-center mb-2">ยกเลิกการปิดวันที่?</h3>
                <p className="text-on-surface-variant text-center mb-8 leading-relaxed">
                  คุณแน่ใจหรือไม่ว่าต้องการยกเลิกการปิดวันที่นี้? การดำเนินการนี้จะทำให้สตูดิโอกลับมาเปิดให้จองได้อีกครั้ง
                </p>

                <div className="flex gap-4">
                  <button 
                    onClick={() => setConfirmingDeleteBlockedDate(null)}
                    className="flex-1 py-3 px-6 rounded-xl font-bold text-sm border border-outline-variant/30 hover:bg-surface-container-high transition-colors"
                  >
                    ยกเลิก
                  </button>
                  <button 
                    onClick={() => handleRemoveBlockedDate(confirmingDeleteBlockedDate.id)}
                    className="flex-1 py-3 px-6 rounded-xl font-bold text-sm bg-error text-white hover:bg-error/90 transition-all shadow-lg shadow-error/20"
                  >
                    ยืนยันการยกเลิก
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirmation Dialog */}
      <AnimatePresence>
        {confirmingBooking && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isSending && setConfirmingBooking(null)}
              className="absolute inset-0 bg-on-surface/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-surface-container-lowest rounded-3xl shadow-2xl overflow-hidden border border-outline-variant/10"
            >
              <div className="p-8">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-6 mx-auto">
                  <Mail className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-2xl font-headline font-bold text-center mb-2">ยืนยันการจอง?</h3>
                <p className="text-on-surface-variant text-center mb-8 leading-relaxed">
                  คุณกำลังจะยืนยันการจองสำหรับ <span className="font-bold text-on-surface">{confirmingBooking.userName}</span> 
                  ระบบจะส่งอีเมลยืนยันอัตโนมัติและเพิ่มกิจกรรมลงใน Google Calendar
                </p>

                <div className="bg-surface-container-low p-4 rounded-2xl mb-8 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-outline">สตูดิโอ:</span>
                    <span className="font-bold">{confirmingBooking.studioName}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-outline">วันที่:</span>
                    <span className="font-bold">{format(new Date(confirmingBooking.date), 'dd MMM yyyy')}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-outline">เวลา:</span>
                    <span className="font-bold">{confirmingBooking.startTime} - {confirmingBooking.endTime}</span>
                  </div>
                </div>

                <div className="flex gap-4">
                  <button 
                    onClick={() => setConfirmingBooking(null)}
                    disabled={isSending}
                    className="flex-1 py-3 px-6 rounded-xl font-bold text-sm border border-outline-variant/30 hover:bg-surface-container-high transition-colors disabled:opacity-50"
                  >
                    ยกเลิก
                  </button>
                  <button 
                    onClick={() => sendConfirmation(confirmingBooking)}
                    disabled={isSending}
                    className="flex-1 py-3 px-6 rounded-xl font-bold text-sm bg-primary text-on-primary hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isSending ? (
                      <>
                        <div className="w-4 h-4 border-2 border-on-primary/20 border-t-on-primary rounded-full animate-spin"></div>
                        กำลังส่ง...
                      </>
                    ) : (
                      'ยืนยันและส่งอีเมล'
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Cancel Booking Confirmation */}
      <AnimatePresence>
        {confirmingCancelBooking && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setConfirmingCancelBooking(null)}
              className="absolute inset-0 bg-on-surface/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-surface-container-lowest rounded-3xl shadow-2xl overflow-hidden border border-outline-variant/10"
            >
              <div className="p-8 text-center">
                <div className="w-16 h-16 bg-secondary/10 rounded-full flex items-center justify-center mb-6 mx-auto">
                  <XCircle className="w-8 h-8 text-secondary" />
                </div>
                <h3 className="text-2xl font-headline font-bold mb-2">ยกเลิกการจอง?</h3>
                <p className="text-on-surface-variant mb-8">คุณแน่ใจหรือไม่ว่าต้องการยกเลิกการจองนี้?</p>
                <div className="flex gap-4">
                  <button onClick={() => setConfirmingCancelBooking(null)} className="flex-1 py-3 rounded-xl font-bold border border-outline-variant/30">ยกเลิก</button>
                  <button onClick={() => handleCancelBooking(confirmingCancelBooking)} className="flex-1 py-3 rounded-xl font-bold bg-secondary text-white">ยืนยันการยกเลิก</button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Booking Confirmation */}
      <AnimatePresence>
        {confirmingDeleteBooking && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setConfirmingDeleteBooking(null)}
              className="absolute inset-0 bg-on-surface/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-surface-container-lowest rounded-3xl shadow-2xl overflow-hidden border border-outline-variant/10"
            >
              <div className="p-8 text-center">
                <div className="w-16 h-16 bg-error/10 rounded-full flex items-center justify-center mb-6 mx-auto">
                  <Trash2 className="w-8 h-8 text-error" />
                </div>
                <h3 className="text-2xl font-headline font-bold mb-2">ลบรายการจอง?</h3>
                <p className="text-on-surface-variant mb-8 text-sm">คุณแน่ใจหรือไม่ว่าต้องการลบรายการจองนี้? การดำเนินการนี้ไม่สามารถย้อนกลับได้</p>
                <div className="flex gap-4">
                  <button onClick={() => setConfirmingDeleteBooking(null)} className="flex-1 py-3 rounded-xl font-bold border border-outline-variant/30">ยกเลิก</button>
                  <button onClick={() => handleDeleteBooking(confirmingDeleteBooking)} className="flex-1 py-3 rounded-xl font-bold bg-error text-white">ยืนยันการลบ</button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
