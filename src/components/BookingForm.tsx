import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, ArrowRight, Calendar as CalendarIcon, User as UserIcon, School, Phone, Info, Video, FileText, Clock, CheckCircle2 } from 'lucide-react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { doc, getDoc, setDoc, collection, addDoc, query, where, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../App';
import { Studio, Booking, BlockedDate } from '../types';
import { format } from 'date-fns';
import { sendEmail } from '../services/emailService';
import { getDepartmentName, ADMIN_EMAILS } from '../constants';

export default function BookingForm() {
  const { studioId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { profile, accessToken } = useAuth();
  
  const [studio, setStudio] = useState<Studio | null>(null);
  const [existingBookings, setExistingBookings] = useState<Booking[]>([]);
  const TIME_SLOTS = [
    { start: '09:30', end: '12:00', label: '09:30 - 12:00' },
    { start: '13:30', end: '16:00', label: '13:30 - 16:00' },
  ];

  const [formData, setFormData] = useState({
    title: '',
    notes: '',
    startTime: location.state?.startTime || '09:30',
    endTime: location.state?.endTime || '12:00',
    date: location.state?.date || format(new Date(), 'yyyy-MM-dd'),
    phone: '',
  });

  const [submitting, setSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([]);

  const activeSlotIndex = TIME_SLOTS.findIndex(slot => slot.start === formData.startTime);

  useEffect(() => {
    // Fetch Blocked Dates
    const unsubscribeBlocked = onSnapshot(collection(db, 'blocked_dates'), (snapshot) => {
      setBlockedDates(snapshot.docs.map(doc => doc.data() as BlockedDate));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'blocked_dates');
    });

    return () => unsubscribeBlocked();
  }, []);

  useEffect(() => {
    if (studioId) {
      getDoc(doc(db, 'studios', studioId)).then(docSnap => {
        if (docSnap.exists()) {
          setStudio(docSnap.data() as Studio);
        } else {
          // Fallback if studio doesn't exist in DB yet
          setStudio({
            id: studioId,
            name: studioId === 'studio-a1' ? 'LDO Studio A1' : 'LDO Studio',
            type: 'recording',
            status: 'available',
            description: 'Main recording studio'
          });
        }
      }).catch(err => {
        console.error("Error fetching studio:", err);
        setStudio({
          id: studioId,
          name: 'LDO Studio A1',
          type: 'recording',
          status: 'available',
          description: 'Main recording studio'
        });
      });

      // Fetch existing bookings for this date and studio
      const q = query(
        collection(db, 'bookings'),
        where('studioId', '==', studioId),
        where('date', '==', formData.date),
        where('status', 'in', ['pending', 'confirmed'])
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        setExistingBookings(snapshot.docs.map(doc => doc.data() as Booking));
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, 'bookings');
      });

      return () => unsubscribe();
    }
  }, [studioId, formData.date]);

  const isSlotTaken = (start: string) => {
    return existingBookings.some(b => b.startTime === start);
  };

  const handleSlotSelect = (index: number) => {
    if (isSlotTaken(TIME_SLOTS[index].start)) return;
    setFormData({
      ...formData,
      startTime: TIME_SLOTS[index].start,
      endTime: TIME_SLOTS[index].end,
    });
  };

  useEffect(() => {
    // If the currently selected slot is taken, try to auto-switch to an available one
    if (existingBookings.length > 0) {
      if (isSlotTaken(formData.startTime)) {
        const availableSlot = TIME_SLOTS.find(s => !isSlotTaken(s.start));
        if (availableSlot) {
          setFormData(prev => ({
            ...prev,
            startTime: availableSlot.start,
            endTime: availableSlot.end,
          }));
        }
      }
    }
  }, [existingBookings, formData.startTime]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !studio) {
      console.error('Cannot submit: profile or studio is missing', { profile: !!profile, studio: !!studio });
      return;
    }

    setSubmitting(true);
    setError(null);

    // Check if date is blocked
    const isBlocked = blockedDates.some(bd => {
      if (bd.startDate && bd.endDate) {
        return formData.date >= bd.startDate && formData.date <= bd.endDate;
      }
      return (bd as any).date === formData.date;
    });
    if (isBlocked) {
      const reason = blockedDates.find(bd => {
        if (bd.startDate && bd.endDate) {
          return formData.date >= bd.startDate && formData.date <= bd.endDate;
        }
        return (bd as any).date === formData.date;
      })?.reason;
      setError(`ไม่สามารถจองได้ในวันที่เลือก เนื่องจาก: ${reason || 'วันที่นี้ถูกปิดการจองโดยผู้ดูแลระบบ'}`);
      setSubmitting(false);
      return;
    }

    // Check if slot is already taken
    if (isSlotTaken(formData.startTime)) {
      setError('ช่วงเวลานี้มีการจองแล้ว กรุณาเลือกช่วงเวลาอื่น');
      setSubmitting(false);
      return;
    }

    const path = 'bookings';
    try {
      const bookingsRef = collection(db, path);
      const newDocRef = doc(bookingsRef);
      const bookingId = newDocRef.id;

      const bookingData = {
        id: bookingId,
        studioId: studio.id,
        studioName: studio.name,
        userId: profile.uid,
        userName: profile.displayName || 'Anonymous',
        userEmail: profile.email || '',
        userPhone: formData.phone,
        userDepartment: getDepartmentName(profile.department),
        userCode: profile.code || '',
        userPosition: profile.position || '',
        date: formData.date,
        startTime: formData.startTime,
        endTime: formData.endTime,
        title: formData.title,
        notes: formData.notes,
        status: 'pending',
        createdAt: serverTimestamp(),
      };

      console.log('Attempting to save booking:', bookingData);
      await setDoc(newDocRef, bookingData);
      console.log('Booking saved successfully');
      
      // Send email to admins
      if (accessToken) {
        const adminEmails = ADMIN_EMAILS;
        const subject = `New Studio Booking: ${studio.name} - ${formData.date}`;
        const body = `
          <h2>New Booking Request</h2>
          <p><strong>Studio:</strong> ${studio.name}</p>
          <p><strong>Date:</strong> ${formData.date}</p>
          <p><strong>Time:</strong> ${formData.startTime} - ${formData.endTime}</p>
          <p><strong>Topic:</strong> ${formData.title}</p>
          <p><strong>User:</strong> ${profile.displayName} (${profile.email})</p>
          <p><strong>Phone:</strong> ${formData.phone}</p>
          <p><strong>Notes:</strong> ${formData.notes || '-'}</p>
          <br>
          <p>Please review this booking in the <a href="${window.location.origin}/admin">Admin Dashboard</a>.</p>
        `;

        for (const adminEmail of adminEmails) {
          try {
            await sendEmail(accessToken, adminEmail, subject, body);
          } catch (emailErr) {
            console.error(`Failed to send email to ${adminEmail}:`, emailErr);
          }
        }
      }

      setShowSuccess(true);
    } catch (err) {
      console.error('Booking error:', err);
      setError('เกิดข้อผิดพลาดในการจอง กรุณาลองใหม่อีกครั้ง หรือติดต่อเจ้าหน้าที่');
      handleFirestoreError(err, OperationType.WRITE, path);
    } finally {
      setSubmitting(false);
    }
  };

  if (!studio) return <div className="min-h-screen flex items-center justify-center">Loading studio...</div>;

  return (
    <div className="bg-background font-body text-on-background min-h-screen pb-24">
      {/* Top Navigation Anchor */}
      <header className="fixed top-0 w-full z-50 glass-header shadow-sm h-16 flex justify-between items-center px-6">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate(-1)}
            className="p-2 -ml-2 text-primary active:scale-95 duration-200 transition-transform"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="font-headline font-bold tracking-tight text-primary">Confirm Booking</h1>
        </div>
        <div className="w-8 h-8 rounded-full bg-surface-container-high flex items-center justify-center overflow-hidden border border-primary/10">
          {profile?.photoURL ? (
            <img src={profile.photoURL} alt="User" className="w-full h-full object-cover" />
          ) : (
            <UserIcon className="w-5 h-5 text-primary" />
          )}
        </div>
      </header>

      <main className="pt-20 px-4 md:px-8 lg:px-12 max-w-6xl mx-auto">
        {/* Hero Summary Section - Interactive Slot Selection */}
        <section className="mb-8 md:mb-12 mt-4">
          <div className="flex flex-col gap-1">
            <span className="font-label text-xs uppercase tracking-[0.15em] text-secondary font-semibold">Reservation Detail</span>
            <h2 className="font-headline text-3xl md:text-5xl font-extrabold tracking-tighter text-on-background leading-tight">
              {studio.name}
            </h2>
          </div>
          
          <div className="mt-6 flex flex-col md:flex-row gap-4">
            {TIME_SLOTS.map((slot, index) => {
              const taken = isSlotTaken(slot.start);
              const active = activeSlotIndex === index;
              
              return (
                <button
                  key={index}
                  type="button"
                  disabled={taken}
                  onClick={() => handleSlotSelect(index)}
                  className={`flex-1 flex items-center gap-6 p-6 rounded-[32px] shadow-sm relative overflow-hidden border transition-all duration-300 ${
                    active 
                      ? 'bg-white border-primary ring-4 ring-primary/5' 
                      : taken 
                        ? 'bg-surface-container-low border-outline-variant/5 opacity-60 cursor-not-allowed'
                        : 'bg-white border-outline-variant/10 hover:border-primary/30'
                  }`}
                >
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-colors ${
                    active ? 'bg-primary/10 text-primary' : taken ? 'bg-outline/10 text-outline' : 'bg-surface-container-highest text-outline'
                  }`}>
                    <CalendarIcon className="w-7 h-7" />
                  </div>
                  <div className="text-left">
                    <p className={`font-headline text-xl font-bold ${taken ? 'text-outline' : 'text-on-surface'}`}>
                      {format(new Date(formData.date), 'MMMM dd, yyyy')}
                    </p>
                    <p className={`font-label text-base font-medium ${
                      active ? 'text-primary' : taken ? 'text-outline/60' : 'text-on-surface-variant'
                    }`}>
                      {slot.label} {taken && '(Already Booked)'}
                    </p>
                  </div>
                  {active && (
                    <div className="ml-auto bg-primary text-on-primary rounded-full p-1.5">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        {/* Form Content */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 md:gap-12">
          {/* Left Side: Requester Info */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-surface-container-low p-6 md:p-8 rounded-3xl space-y-6 border border-outline-variant/10">
              <h3 className="font-headline text-sm font-bold uppercase tracking-wider text-on-surface-variant/70">Requester Information</h3>
              <div className="grid grid-cols-1 gap-6">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <UserIcon className="text-primary w-5 h-5" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-outline">Full Name</span>
                    <span className="font-bold text-lg">{profile?.displayName || 'ผู้ใช้งาน'}</span>
                  </div>
                </div>
                {profile?.code && (
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <FileText className="text-primary w-5 h-5" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-outline">Lecturer ID</span>
                      <span className="font-bold text-lg">{profile.code}</span>
                    </div>
                  </div>
                )}
                {profile?.position && (
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-secondary/10 flex items-center justify-center">
                      <UserIcon className="text-secondary w-5 h-5" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-outline">Position</span>
                      <span className="font-bold text-lg">{profile.position}</span>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-secondary/10 flex items-center justify-center">
                    <School className="text-secondary w-5 h-5" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-outline">Department</span>
                    <span className="font-bold text-lg">{getDepartmentName(profile?.department || '') || profile?.position || 'Student'}</span>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-tertiary/10 flex items-center justify-center">
                    <Phone className="text-tertiary w-5 h-5" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-outline">Contact</span>
                    <span className="font-bold text-lg">{profile?.phone || 'Not specified'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Status Notice */}
            <div className="flex items-start gap-4 p-6 bg-tertiary/5 rounded-3xl border border-tertiary/10">
              <Info className="text-tertiary w-6 h-6 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-on-surface-variant leading-relaxed">
                An email confirmation will be sent to the admin team for review. You will receive a notification once the status is updated.
              </p>
            </div>
          </div>

          {/* Right Side: Interactive Fields */}
          <div className="lg:col-span-7">
            <form onSubmit={handleSubmit} className="space-y-6 md:space-y-8">
              <div className="space-y-3">
                <label className="font-headline text-sm font-bold text-on-background px-1 flex items-center gap-2" htmlFor="video-title">
                  <Video className="w-4 h-4 text-primary" />
                  Video Title / Topic <span className="text-error">*</span>
                </label>
                <input 
                  className="w-full bg-surface-container-highest border-2 border-transparent rounded-2xl px-6 py-5 focus:border-primary focus:bg-surface-container-lowest transition-all placeholder:text-outline/60 outline-none font-medium" 
                  id="video-title" 
                  placeholder="e.g. Creative Media Production Final Project" 
                  required 
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                />
              </div>

              <div className="space-y-3">
                <label className="font-headline text-sm font-bold text-on-background px-1 flex items-center gap-2" htmlFor="phone">
                  <Phone className="w-4 h-4 text-primary" />
                  Mobile Phone Number <span className="text-error">*</span>
                </label>
                <input 
                  className="w-full bg-surface-container-highest border-2 border-transparent rounded-2xl px-6 py-5 focus:border-primary focus:bg-surface-container-lowest transition-all placeholder:text-outline/60 outline-none font-medium" 
                  id="phone" 
                  placeholder="e.g. 081-xxx-xxxx" 
                  required 
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <label className="font-headline text-sm font-bold text-on-background px-1">Start Time</label>
                  <div className="w-full bg-surface-container-highest border-2 border-transparent rounded-2xl px-6 py-5 flex items-center justify-between text-on-surface-variant font-medium">
                    <span>{formData.startTime === '09:30' ? '09:30 AM' : '01:30 PM'}</span>
                    <Clock className="w-5 h-5 opacity-40" />
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="font-headline text-sm font-bold text-on-background px-1">End Time</label>
                  <div className="w-full bg-surface-container-highest border-2 border-transparent rounded-2xl px-6 py-5 flex items-center justify-between text-on-surface-variant font-medium">
                    <span>{formData.endTime === '12:00' ? '12:00 PM' : '04:00 PM'}</span>
                    <Clock className="w-5 h-5 opacity-40" />
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <label className="font-headline text-sm font-bold text-on-background px-1 flex items-center gap-2" htmlFor="notes">
                  <FileText className="w-4 h-4 text-primary" />
                  Additional Notes <span className="font-normal text-outline/60 text-xs">(Optional)</span>
                </label>
                <textarea 
                  className="w-full bg-surface-container-highest border-2 border-transparent rounded-2xl px-6 py-5 focus:border-primary focus:bg-surface-container-lowest transition-all placeholder:text-outline/60 resize-none outline-none font-medium" 
                  id="notes" 
                  placeholder="Mention special equipment or crew size..." 
                  rows={5}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                ></textarea>
              </div>

              {/* Error Message */}
              {error && (
                <div className="p-4 bg-error/10 border border-error/20 rounded-2xl text-error text-sm font-medium flex items-center gap-3">
                  <Info className="w-5 h-5" />
                  {error}
                </div>
              )}

              {/* CTA Container */}
              <div className="pt-6 flex flex-col md:flex-row gap-4">
                <button 
                  type="submit"
                  disabled={submitting || isSlotTaken(formData.startTime)}
                  className="primary-gradient flex-1 py-5 rounded-2xl shadow-xl shadow-primary/20 text-on-primary font-headline font-bold text-lg flex items-center justify-center gap-3 active:scale-95 transition-transform duration-200 disabled:opacity-50"
                >
                  {submitting ? 'Processing...' : 'Confirm Booking'}
                  <ArrowRight className="w-6 h-6" />
                </button>
                <button 
                  type="button"
                  onClick={() => navigate(-1)}
                  className="md:w-1/3 py-5 text-on-surface-variant font-headline font-bold text-sm bg-surface-container-high rounded-2xl hover:bg-surface-container-highest transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      </main>

      {/* Visual Polish */}
      <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-primary/5 rounded-full blur-3xl"></div>
        <div className="absolute top-1/2 -left-24 w-64 h-64 bg-secondary/5 rounded-full blur-3xl"></div>
      </div>

      {/* Success Dialog */}
      {showSuccess && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-[40px] p-10 max-w-md w-full text-center shadow-2xl border border-primary/10"
          >
            <div className="w-24 h-24 bg-tertiary/10 rounded-full flex items-center justify-center mx-auto mb-8">
              <CheckCircle2 className="w-12 h-12 text-tertiary" />
            </div>
            <h2 className="font-headline text-3xl font-extrabold text-on-surface mb-4">การจองสมบูรณ์</h2>
            <p className="text-on-surface-variant mb-10 leading-relaxed font-medium">
              ระบบได้รับข้อมูลการจองของคุณเรียบร้อยแล้ว <br />
              คุณสามารถตรวจสอบสถานะได้ที่หน้าหลัก
            </p>
            <button 
              onClick={() => navigate('/')}
              className="w-full primary-gradient py-5 rounded-2xl text-on-primary font-headline font-bold text-lg shadow-xl shadow-primary/20 active:scale-95 transition-transform"
            >
              กลับสู่หน้าแรก
            </button>
          </motion.div>
        </div>
      )}
    </div>
  );
}
