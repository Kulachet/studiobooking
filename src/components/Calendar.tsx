import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Calendar as CalendarIcon, SlidersHorizontal, Plus, CheckCircle2, XCircle, Lock } from 'lucide-react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, isBefore, startOfDay } from 'date-fns';
import { collection, onSnapshot, query, where, getDocs, setDoc, doc, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Booking, Studio, BlockedDate } from '../types';
import { Link, useNavigate } from 'react-router-dom';

export default function Calendar() {
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [studios, setStudios] = useState<Studio[]>([]);
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([]);

  const isThaiHoliday = (date: Date) => {
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const year = date.getFullYear();

    // Fixed dates
    if (month === 1 && day === 1) return true; // New Year
    if (month === 4 && day === 6) return true; // Chakri
    if (month === 4 && (day >= 13 && day <= 15)) return true; // Songkran
    if (month === 5 && day === 1) return true; // Labour Day
    if (month === 5 && day === 4) return true; // Coronation Day
    if (month === 6 && day === 3) return true; // Queen's Birthday
    if (month === 7 && day === 28) return true; // King's Birthday
    if (month === 8 && day === 12) return true; // Mother's Day
    if (month === 10 && day === 13) return true; // King Rama IX Memorial
    if (month === 10 && day === 23) return true; // Chulalongkorn Day
    if (month === 12 && day === 5) return true; // Father's Day
    if (month === 12 && day === 10) return true; // Constitution Day
    if (month === 12 && day === 31) return true; // New Year's Eve

    // 2026 Specific Lunar (Approximate)
    if (year === 2026) {
      if (month === 3 && day === 3) return true; // Makha Bucha
      if (month === 5 && day === 31) return true; // Visakha Bucha
      if (month === 7 && day === 29) return true; // Asarnha Bucha
      if (month === 7 && day === 30) return true; // Buddhist Lent
    }

    return false;
  };

  const isWeekend = (date: Date) => {
    const day = date.getDay();
    return day === 0 || day === 6; // 0 is Sunday, 6 is Saturday
  };

  const isDisabled = (date: Date) => {
    if (isBefore(startOfDay(date), startOfDay(new Date()))) return true;
    
    const dateStr = format(date, 'yyyy-MM-dd');
    const isBlocked = blockedDates.some(bd => {
      if (bd.startDate && bd.endDate) {
        return dateStr >= bd.startDate && dateStr <= bd.endDate;
      }
      return (bd as any).date === dateStr;
    });
    return isWeekend(date) || isThaiHoliday(date) || isBlocked;
  };

  const getBlockedReason = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return blockedDates.find(bd => {
      if (bd.startDate && bd.endDate) {
        return dateStr >= bd.startDate && dateStr <= bd.endDate;
      }
      return (bd as any).date === dateStr;
    })?.reason;
  };

  useEffect(() => {
    // Fetch Studios
    const unsubscribeStudios = onSnapshot(collection(db, 'studios'), (snapshot) => {
      const studioList = snapshot.docs.map(doc => doc.data() as Studio);
      setStudios(studioList);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'studios');
    });

    // Fetch Bookings for current month
    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);
    const q = query(
      collection(db, 'bookings'),
      where('date', '>=', format(start, 'yyyy-MM-dd')),
      where('date', '<=', format(end, 'yyyy-MM-dd'))
    );

    const unsubscribeBookings = onSnapshot(q, (snapshot) => {
      setBookings(snapshot.docs.map(doc => doc.data() as Booking));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'bookings');
    });

    // Fetch Blocked Dates
    const unsubscribeBlocked = onSnapshot(collection(db, 'blocked_dates'), (snapshot) => {
      setBlockedDates(snapshot.docs.map(doc => doc.data() as BlockedDate));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'blocked_dates');
    });

    return () => {
      unsubscribeStudios();
      unsubscribeBookings();
      unsubscribeBlocked();
    };
  }, [currentDate]);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);
  const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });

  const getDayBookings = (day: Date) => {
    return bookings.filter(b => b.status !== 'cancelled' && b.date === format(day, 'yyyy-MM-dd'));
  };

  return (
    <div className="px-4 md:px-8 max-w-7xl mx-auto">
      {/* Header Section */}
      <section className="flex flex-col md:flex-row md:items-end justify-between mb-8 md:mb-12 gap-6">
        <div className="max-w-xl">
          <p className="text-primary font-bold tracking-widest uppercase text-[10px] md:text-xs mb-2">Schedule Overview</p>
          <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight text-on-surface leading-tight">Mastering Your <span className="text-primary">Creative Timeline.</span></h2>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 bg-surface-container-low p-2 rounded-xl shadow-sm self-start md:self-auto">
          {/* Month Dropdown */}
          <div className="flex items-center bg-surface-container-lowest rounded-lg px-3 py-2 border border-outline-variant/20">
            <select 
              value={currentDate.getMonth()}
              onChange={(e) => {
                const newDate = new Date(currentDate);
                newDate.setMonth(parseInt(e.target.value));
                setCurrentDate(newDate);
              }}
              className="bg-transparent border-none focus:ring-0 font-headline font-bold text-sm text-on-surface cursor-pointer outline-none"
            >
              {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map((month, i) => (
                <option key={month} value={i}>{month}</option>
              ))}
            </select>
          </div>

          {/* Year Dropdown (BE) */}
          <div className="flex items-center bg-surface-container-lowest rounded-lg px-3 py-2 border border-outline-variant/20">
            <select 
              value={currentDate.getFullYear()}
              onChange={(e) => {
                const newDate = new Date(currentDate);
                newDate.setFullYear(parseInt(e.target.value));
                setCurrentDate(newDate);
              }}
              className="bg-transparent border-none focus:ring-0 font-headline font-bold text-sm text-on-surface cursor-pointer outline-none"
            >
              {Array.from({ length: 7 }).map((_, i) => {
                const yearAD = new Date().getFullYear() + i;
                const yearBE = yearAD + 543;
                return <option key={yearAD} value={yearAD}>{yearBE}</option>;
              })}
            </select>
          </div>

          <button className="bg-primary text-white p-2 md:p-2.5 rounded-lg hover:opacity-90 transition-all active:scale-95 shadow-md">
            <SlidersHorizontal className="w-4 h-4 md:w-5 h-5" />
          </button>
        </div>
      </section>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8">
        {/* Calendar Canvas */}
        <div className="lg:col-span-12 bg-surface-container-lowest rounded-xl shadow-[0_4px_24px_rgba(0,0,0,0.04)] overflow-hidden border border-outline-variant/10">
          {/* Month Headline */}
          <div className="px-6 py-6 border-b border-outline-variant/10 bg-primary/5">
            <h3 className="text-3xl md:text-5xl font-black text-primary tracking-tighter uppercase">
              {format(currentDate, 'MMMM')} {currentDate.getFullYear() + 543}
            </h3>
          </div>

          <div className="grid grid-cols-7 border-b border-outline-variant/10">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="py-3 md:py-4 text-center text-[9px] md:text-[10px] font-bold tracking-[0.1em] md:tracking-[0.2em] text-on-surface/40 uppercase">{day}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 auto-rows-fr">
            {calendarDays.map((day, idx) => {
              const isCurrentMonth = isSameMonth(day, monthStart);
              const isToday = isSameDay(day, new Date());
              const dayBookings = getDayBookings(day);
              const hasAM = dayBookings.some(b => b.startTime < '12:00');
              const hasPM = dayBookings.some(b => b.startTime >= '12:00');
              const disabled = isDisabled(day);
              const blockedReason = getBlockedReason(day);
              const isHoliday = isThaiHoliday(day);

              return (
                <div 
                  key={idx}
                  onClick={() => !disabled && navigate(`/book/studio-a1`, { state: { date: format(day, 'yyyy-MM-dd') } })}
                  className={`min-h-[80px] sm:min-h-[100px] md:min-h-[140px] p-1.5 sm:p-2 md:p-3 border-r border-b border-outline-variant/10 transition-colors group relative overflow-hidden
                    ${disabled ? 'bg-surface-container-low/50 cursor-not-allowed' : 'cursor-pointer'}
                    ${!isCurrentMonth ? 'bg-surface-container-low/30 opacity-30' : disabled ? '' : 'hover:bg-primary/5'}
                  `}
                >
                  <div className="flex justify-between items-start">
                    <span className={`font-headline text-base sm:text-lg md:text-2xl font-extrabold transition-colors
                      ${isToday ? 'text-primary' : isCurrentMonth ? (disabled ? 'text-on-surface/20' : 'text-on-surface/80 group-hover:text-primary') : 'text-on-surface/40'}
                    `}>
                      {format(day, 'dd')}
                    </span>
                    {isToday && (
                      <span className="px-1 sm:px-1.5 md:px-2 py-0.5 bg-primary text-white text-[6px] sm:text-[7px] md:text-[8px] font-bold uppercase rounded-full tracking-widest">Today</span>
                    )}
                    {disabled && isCurrentMonth && (
                      <div className="flex flex-col items-end gap-0.5">
                        {isHoliday && (
                          <span className="text-[6px] md:text-[8px] font-bold text-error uppercase tracking-tighter">Holiday</span>
                        )}
                        {blockedReason && (
                          <span className="text-[6px] md:text-[8px] font-bold text-error uppercase tracking-tighter flex items-center gap-0.5">
                            <Lock className="w-2 h-2" />
                            Blocked
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  
                  <div className="mt-1 sm:mt-2 md:mt-3 space-y-1">
                    {blockedReason && isCurrentMonth && (
                      <div className="px-2 py-1 bg-error/5 border border-error/10 rounded-md">
                        <p className="text-[8px] md:text-[10px] text-error font-bold uppercase leading-tight line-clamp-2">
                          {blockedReason}
                        </p>
                      </div>
                    )}
                    {isCurrentMonth && (
                      <div className="flex flex-col gap-1">
                        {[
                          { start: '09:30', label: '9:30 AM', color: 'bg-primary' },
                          { start: '13:30', label: '1:30 PM', color: 'bg-secondary' }
                        ].map((slot) => {
                          const booking = dayBookings.find(b => b.startTime === slot.start);
                          if (disabled && !booking) return null;
                          
                          const isPastOrDisabled = disabled;

                          return (
                            <div 
                              key={slot.label}
                              className={`flex items-center gap-1.5 px-2 py-1 rounded-md border transition-all ${
                                booking 
                                  ? isPastOrDisabled
                                    ? 'bg-outline/5 border-outline/10 text-on-surface/50 grayscale'
                                    : `${slot.color}/10 border-${slot.color === 'bg-primary' ? 'primary' : 'secondary'}/20` 
                                  : 'bg-surface-container-high/30 border-transparent opacity-20'
                              }`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${booking ? (isPastOrDisabled ? 'bg-outline/40' : slot.color) : 'bg-outline/20'}`}></span>
                              <span className={`text-[10px] md:text-[12px] font-bold uppercase tracking-tight truncate ${
                                booking 
                                  ? (isPastOrDisabled ? 'text-on-surface/50' : (slot.color === 'bg-primary' ? 'text-primary' : 'text-secondary')) 
                                  : 'text-outline/40'
                              }`}>
                                {slot.label}: {booking ? booking.userName : 'EMPTY'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Floating Action Button */}
      <Link 
        to="/book/studio-a1"
        className="fixed bottom-24 right-6 md:bottom-8 md:right-8 w-16 h-16 bg-gradient-to-br from-primary to-primary-container text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-110 active:scale-90 transition-transform z-40 group"
      >
        <Plus className="w-8 h-8 group-hover:rotate-90 transition-transform duration-300" />
      </Link>
    </div>
  );
}
