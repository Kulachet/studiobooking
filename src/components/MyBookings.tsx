import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Calendar as CalendarIcon, Clock, Video, Mic, ChevronRight, CalendarX, CheckCircle2, XCircle, AlertCircle, Trash2, AlertTriangle } from 'lucide-react';
import { collection, query, where, orderBy, onSnapshot, updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../App';
import { Booking } from '../types';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';

export default function MyBookings() {
  const { profile } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!profile) return;

    const q = query(
      collection(db, 'bookings'),
      where('userId', '==', profile.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setBookings(snapshot.docs.map(doc => doc.data() as Booking));
      setLoading(false);
    });

    return unsubscribe;
  }, [profile]);

  const upcomingBookings = bookings.filter(b => b.status !== 'cancelled' && new Date(b.date).getTime() >= new Date().setHours(0,0,0,0));
  const pastBookings = bookings.filter(b => b.status !== 'cancelled' && new Date(b.date).getTime() < new Date().setHours(0,0,0,0));

  const handleCancelClick = (id: string) => {
    setDeletingId(id);
    setIsConfirmOpen(true);
  };

  const confirmCancel = async () => {
    if (!deletingId) return;
    
    setIsDeleting(true);
    const path = `bookings/${deletingId}`;
    try {
      await updateDoc(doc(db, 'bookings', deletingId), { status: 'cancelled' });
      console.log('Booking cancelled successfully');
      setIsConfirmOpen(false);
      setDeletingId(null);
    } catch (error) {
      console.error('Cancel error:', error);
      // Mandatory error handling for Firestore permission issues
      const errInfo = {
        error: error instanceof Error ? error.message : String(error),
        authInfo: {
          userId: profile?.uid,
          email: profile?.email,
        },
        operationType: 'update',
        path: path
      };
      console.error('Firestore Error Details:', JSON.stringify(errInfo));
      // throw new Error(JSON.stringify(errInfo));
    } finally {
      setIsDeleting(false);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading bookings...</div>;

  return (
    <main className="px-4 md:px-8 max-w-6xl mx-auto">
      {/* Editorial Header */}
      <div className="mb-8 md:mb-12">
        <p className="font-label text-primary font-bold tracking-widest uppercase text-[10px] mb-2">Academic Catalyst</p>
        <h2 className="font-headline text-3xl md:text-5xl font-extrabold tracking-tight text-on-surface leading-tight">Your<br className="md:hidden"/> Schedule</h2>
      </div>

      {/* Section: Upcoming */}
      <section className="mb-12">
        <div className="flex items-center justify-between mb-6 md:mb-8">
          <h3 className="font-headline text-xl md:text-2xl font-bold text-on-surface">Upcoming Sessions</h3>
          <span className="bg-primary/5 text-primary text-[10px] md:text-xs font-bold px-3 py-1.5 rounded-full uppercase tracking-tighter">
            {upcomingBookings.length} Reservation{upcomingBookings.length !== 1 ? 's' : ''}
          </span>
        </div>

        {upcomingBookings.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
            {upcomingBookings.map((booking) => (
              <motion.div 
                key={booking.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-surface-container-lowest rounded-[1.5rem] p-6 shadow-[0_-4px_24px_rgba(0,0,0,0.02)] relative overflow-hidden group border border-outline-variant/10 flex flex-col h-full"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-110 duration-500"></div>
                <div className="flex justify-between items-start mb-4">
                  <div className="flex flex-col">
                    <span className="font-headline text-3xl font-black text-primary leading-none">{format(new Date(booking.date), 'dd')}</span>
                    <span className="font-label text-[10px] uppercase font-bold text-outline tracking-[0.2em]">{format(new Date(booking.date), 'MMMM')}</span>
                  </div>
                  <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${
                    booking.status === 'confirmed' ? 'bg-tertiary/10 text-tertiary' : 'bg-secondary/10 text-secondary'
                  }`}>
                    <div className={`w-2 h-2 rounded-full animate-pulse ${booking.status === 'confirmed' ? 'bg-tertiary' : 'bg-secondary'}`}></div>
                    <span className="font-bold text-[11px] uppercase tracking-wider">{booking.status}</span>
                  </div>
                </div>
                <div className="mb-6 flex-1">
                  <h4 className="font-headline text-lg font-bold text-on-surface mb-2 line-clamp-2">{booking.title}</h4>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-on-surface-variant">
                      <Clock className="w-4 h-4" />
                      <span className="text-sm font-medium">{booking.startTime} — {booking.endTime}</span>
                    </div>
                    <div className="flex items-center gap-2 text-on-surface-variant">
                      {booking.studioName.toLowerCase().includes('audio') ? <Mic className="w-4 h-4" /> : <Video className="w-4 h-4" />}
                      <span className="text-sm font-medium">{booking.studioName}</span>
                    </div>
                  </div>
                </div>
                <button 
                  onClick={() => handleCancelClick(booking.id)}
                  className="w-full py-4 text-primary font-bold text-sm bg-primary/5 rounded-xl hover:bg-primary/10 transition-colors active:scale-[0.98] duration-150 mt-auto flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Cancel Booking
                </button>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center bg-surface-container-low/50 rounded-3xl border border-dashed border-outline-variant/30">
            <CalendarX className="w-12 h-12 text-outline/30 mb-4" />
            <h4 className="font-headline text-lg font-bold text-on-surface">No bookings found</h4>
            <p className="text-sm text-on-surface-variant max-w-[200px] mt-2">Ready to start creating? Book your first session now.</p>
            <Link to="/" className="mt-6 px-8 py-3 bg-primary text-on-primary font-bold rounded-full text-sm shadow-lg shadow-primary/20 hover:scale-105 transition-transform">
              Book a Studio
            </Link>
          </div>
        )}
      </section>

      {/* Section: Past Reservations */}
      {pastBookings.length > 0 && (
        <section className="bg-surface-container-low -mx-4 md:-mx-8 px-4 md:px-8 py-12 rounded-t-[2.5rem] md:rounded-3xl">
          <h3 className="font-headline text-xl md:text-2xl font-bold text-on-surface mb-8">Past Sessions</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pastBookings.map((booking) => (
              <div key={booking.id} className="flex items-center gap-4 p-4 bg-surface-container-lowest/50 rounded-2xl opacity-70 grayscale-[0.5] border border-outline-variant/5 hover:opacity-100 hover:grayscale-0 transition-all">
                <div className="bg-surface-container-high w-14 h-14 rounded-xl flex flex-col items-center justify-center shrink-0">
                  <span className="font-headline text-lg font-bold text-on-surface-variant">{format(new Date(booking.date), 'dd')}</span>
                  <span className="font-label text-[8px] font-bold text-outline uppercase tracking-tighter">{format(new Date(booking.date), 'MMM')}</span>
                </div>
                <div className="flex-1 overflow-hidden">
                  <h5 className="font-bold text-on-surface truncate">{booking.title}</h5>
                  <p className="text-xs text-on-surface-variant">Completed • {booking.studioName}</p>
                </div>
                <ChevronRight className="text-outline w-5 h-5" />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Confirmation Modal */}
      <AnimatePresence>
        {isConfirmOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isDeleting && setIsConfirmOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-sm bg-surface-container-low z-[110] rounded-3xl p-8 shadow-2xl border border-outline-variant/10"
            >
              <div className="flex flex-col items-center text-center mb-6">
                <div className="w-16 h-16 bg-error/10 rounded-full flex items-center justify-center mb-4">
                  <AlertTriangle className="w-8 h-8 text-error" />
                </div>
                <h3 className="text-2xl font-black text-on-surface tracking-tight font-headline">Cancel Booking?</h3>
                <p className="text-sm text-on-surface-variant mt-2">คุณแน่ใจหรือไม่ว่าต้องการยกเลิกการจองนี้? การจองจะถูกยกเลิกและคืนเวลากลับเข้าระบบ</p>
              </div>

              <div className="flex gap-3">
                <button 
                  disabled={isDeleting}
                  onClick={() => setIsConfirmOpen(false)}
                  className="flex-1 py-4 bg-surface-container-high text-on-surface font-bold rounded-2xl hover:bg-surface-container-highest transition-colors disabled:opacity-50"
                >
                  No, Keep it
                </button>
                <button 
                  disabled={isDeleting}
                  onClick={confirmCancel}
                  className="flex-[2] py-4 bg-error text-white font-bold rounded-2xl shadow-lg shadow-error/20 hover:bg-error/80 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isDeleting ? 'Cancelling...' : 'Yes, Cancel'}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </main>
  );
}
