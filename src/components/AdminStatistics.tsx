import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { Booking } from '../types';
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths, addMonths, subYears, addYears, parse } from 'date-fns';
import { th } from 'date-fns/locale';
import { BarChart3, ChevronLeft, ChevronRight, Download, Calendar as CalendarIcon, Users } from 'lucide-react';
import Papa from 'papaparse';

export default function AdminStatistics() {
  const [viewMode, setViewMode] = useState<'month' | 'year'>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [statsData, setStatsData] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchStatistics();
  }, [viewMode, currentDate]);

  const fetchStatistics = async () => {
    setLoading(true);
    try {
      let start: Date;
      let end: Date;

      if (viewMode === 'month') {
        start = startOfMonth(currentDate);
        end = endOfMonth(currentDate);
      } else {
        start = startOfYear(currentDate);
        end = endOfYear(currentDate);
      }

      const qBookings = query(
        collection(db, 'bookings'),
        where('date', '>=', format(start, 'yyyy-MM-dd')),
        where('date', '<=', format(end, 'yyyy-MM-dd')),
        orderBy('date', 'asc')
      );

      const snapshot = await getDocs(qBookings);
      const bookings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Booking));
      setStatsData(bookings.filter(b => b.status !== 'cancelled'));
    } catch (error) {
      console.error("Error fetching statistics:", error);
    } finally {
      setLoading(false);
    }
  };

  const calculateHours = (startTime: string, endTime: string) => {
    const parseTime = (timeStr: string) => {
      const [hours, minutes] = timeStr.split(':').map(Number);
      return hours + minutes / 60;
    };
    return parseTime(endTime) - parseTime(startTime);
  };

  const getAggregation = () => {
    let totalHours = 0;
    const byStudio: Record<string, number> = {};
    const byDepartment: Record<string, number> = {};
    const byUser: Record<string, {name: string, hours: number}> = {};
    const byMonthData: Record<string, number> = {};

    statsData.forEach(booking => {
      const hours = calculateHours(booking.startTime, booking.endTime);
      totalHours += hours;

      byStudio[booking.studioName] = (byStudio[booking.studioName] || 0) + hours;
      
      const dept = booking.userDepartment || 'ไม่ระบุหน่วยงาน';
      byDepartment[dept] = (byDepartment[dept] || 0) + hours;

      byUser[booking.userId] = {
        name: booking.userName,
        hours: (byUser[booking.userId]?.hours || 0) + hours
      };

      if (viewMode === 'year') {
        const month = format(parse(booking.date, 'yyyy-MM-dd', new Date()), 'MMM', { locale: th });
        byMonthData[month] = (byMonthData[month] || 0) + hours;
      }
    });

    return { totalHours, byStudio, byDepartment, byUser, byMonthData };
  };

  const { totalHours, byStudio, byDepartment, byUser, byMonthData } = getAggregation();

  const handleExportCSV = () => {
    const data = statsData.map(b => ({
      'วันที่': b.date,
      'สตูดิโอ': b.studioName,
      'ผู้จอง': b.userName,
      'หน่วยงาน': b.userDepartment || '-',
      'เวลาเริ่ม': b.startTime,
      'เวลาสิ้นสุด': b.endTime,
      'จำนวนชั่วโมง': calculateHours(b.startTime, b.endTime).toFixed(2),
      'หัวข้อ': b.title
    }));

    const summaryRow = {
      'วันที่': 'รวมทั้งหมด',
      'สตูดิโอ': '',
      'ผู้จอง': '',
      'หน่วยงาน': '',
      'เวลาเริ่ม': '',
      'เวลาสิ้นสุด': '',
      'จำนวนชั่วโมง': totalHours.toFixed(2),
      'หัวข้อ': ''
    };

    const csv = Papa.unparse([...data, summaryRow]);
    // add BOM for excel to read thai properly
    const blob = new Blob(["\ufeff" + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `studio_statistics_${viewMode}_${format(currentDate, viewMode === 'month' ? 'yyyy-MM' : 'yyyy')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-surface-container-low p-4 rounded-2xl border border-outline-variant/10">
        <div className="flex bg-surface-container-lowest rounded-xl p-1 border border-outline-variant/20">
          <button 
            onClick={() => setViewMode('month')} 
            className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-colors ${viewMode === 'month' ? 'bg-primary text-on-primary' : 'text-on-surface/60 hover:bg-surface-container-high'}`}
          >
            รายเดือน
          </button>
          <button 
            onClick={() => setViewMode('year')} 
            className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-colors ${viewMode === 'year' ? 'bg-primary text-on-primary' : 'text-on-surface/60 hover:bg-surface-container-high'}`}
          >
            รายปี
          </button>
        </div>

        <div className="flex items-center gap-4">
          <button 
            onClick={() => setCurrentDate(viewMode === 'month' ? subMonths(currentDate, 1) : subYears(currentDate, 1))} 
            className="p-2 hover:bg-surface-container-high rounded-full transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h3 className="font-headline font-bold text-lg min-w-[200px] text-center">
            {viewMode === 'month' ? format(currentDate, 'MMMM yyyy', { locale: th }) : format(currentDate, 'yyyy', { locale: th })}
          </h3>
          <button 
            onClick={() => setCurrentDate(viewMode === 'month' ? addMonths(currentDate, 1) : addYears(currentDate, 1))} 
            className="p-2 hover:bg-surface-container-high rounded-full transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        <button 
          onClick={handleExportCSV}
          className="flex items-center gap-2 px-4 py-2 bg-secondary text-on-secondary rounded-xl font-bold hover:bg-secondary/90 transition-colors"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      {loading ? (
        <div className="py-12 text-center text-outline">กำลังโหลดข้อมูลสถิติ...</div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-surface-container p-6 rounded-2xl border border-outline-variant/10">
              <div className="text-outline text-sm font-bold mb-2">จำนวนชั่วโมงทั้งหมด</div>
              <div className="text-4xl font-extrabold text-primary">{totalHours.toFixed(1)} ชม.</div>
              <div className="text-outline/60 text-xs mt-2">รวมจาก {statsData.length} รายการจอง</div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/10">
              <h4 className="font-bold mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-primary" />
                สถิติตามสตูดิโอ
              </h4>
              <div className="space-y-4">
                {Object.entries(byStudio).sort((a, b) => b[1] - a[1]).map(([name, hours]) => (
                  <div key={name}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium">{name}</span>
                      <span className="font-bold">{hours.toFixed(1)} ชม.</span>
                    </div>
                    <div className="h-2 bg-surface-container w-full rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${totalHours ? (hours / totalHours) * 100 : 0}%` }}></div>
                    </div>
                  </div>
                ))}
                {Object.keys(byStudio).length === 0 && <div className="text-outline text-sm text-center py-4">ไม่มีข้อมูล</div>}
              </div>
            </div>

            <div className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/10">
              <h4 className="font-bold mb-4 flex items-center gap-2">
                <Users className="w-5 h-5 text-secondary" />
                สถิติตามหน่วยงาน
              </h4>
              <div className="space-y-4">
                {Object.entries(byDepartment).sort((a, b) => b[1] - a[1]).map(([name, hours]) => (
                  <div key={name}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium">{name}</span>
                      <span className="font-bold">{hours.toFixed(1)} ชม.</span>
                    </div>
                    <div className="h-2 bg-surface-container w-full rounded-full overflow-hidden">
                      <div className="h-full bg-secondary rounded-full" style={{ width: `${totalHours ? (hours / totalHours) * 100 : 0}%` }}></div>
                    </div>
                  </div>
                ))}
                {Object.keys(byDepartment).length === 0 && <div className="text-outline text-sm text-center py-4">ไม่มีข้อมูล</div>}
              </div>
            </div>

            {viewMode === 'year' && (
              <div className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/10 md:col-span-2">
                <h4 className="font-bold mb-4 flex items-center gap-2">
                  <CalendarIcon className="w-5 h-5 text-tertiary" />
                  สถิติในแต่ละเดือน
                </h4>
                <div className="space-y-4">
                  {Object.entries(byMonthData).map(([name, hours]) => (
                    <div key={name}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium">{name}</span>
                        <span className="font-bold">{hours.toFixed(1)} ชม.</span>
                      </div>
                      <div className="h-2 bg-surface-container w-full rounded-full overflow-hidden">
                        <div className="h-full bg-tertiary rounded-full" style={{ width: `${totalHours ? (hours / totalHours) * 100 : 0}%` }}></div>
                      </div>
                    </div>
                  ))}
                  {Object.keys(byMonthData).length === 0 && <div className="text-outline text-sm text-center py-4">ไม่มีข้อมูล</div>}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
