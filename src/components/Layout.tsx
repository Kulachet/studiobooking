import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Calendar as CalendarIcon, ClipboardList, UserIcon, Menu, HelpCircle, ShieldCheck, Lock, LogOut } from 'lucide-react';
import { useAuth } from '../App';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { getDepartmentName } from '../constants';

export default function Layout({ children }: { children: React.ReactNode }) {
  const { profile, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const [showAdminPrompt, setShowAdminPrompt] = React.useState(false);
  const [adminPassword, setAdminPassword] = React.useState('');
  const [error, setError] = React.useState('');

  const handleAdminClick = (e: React.MouseEvent) => {
    e.preventDefault();
    const isAdmin = profile?.role === 'admin' || 
                    profile?.email?.toLowerCase() === 'kulachet.l@bu.ac.th' ||
                    sessionStorage.getItem('admin_auth') === 'true';
    if (isAdmin) {
      navigate('/admin');
    } else {
      setShowAdminPrompt(true);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/login');
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  const verifyAdmin = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminPassword === 'ldo2569') {
      sessionStorage.setItem('admin_auth', 'true');
      setShowAdminPrompt(false);
      setAdminPassword('');
      setError('');
      navigate('/admin');
    } else {
      setError('Incorrect password');
    }
  };

  const navItems = [
    { path: '/', label: 'Home', icon: Home },
    { path: '/my-bookings', label: 'Bookings', icon: ClipboardList },
    { path: '/admin', label: 'Admin', icon: ShieldCheck, onClick: handleAdminClick },
  ];

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      {/* Top Bar */}
      <header className="fixed top-0 w-full z-50 glass-header shadow-sm flex justify-between items-center px-4 md:px-8 py-4">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="md:hidden text-primary hover:opacity-80 transition-opacity scale-95 active:scale-90 transition-transform"
          >
            <Menu className="w-6 h-6" />
          </button>
          <Link to="/" className="flex items-center gap-2">
            <h1 className="text-xl md:text-2xl font-extrabold text-primary tracking-tighter font-headline">LDO Studio</h1>
          </Link>
        </div>
        <div className="flex items-center gap-4 md:gap-8">
          <nav className="hidden md:flex gap-6 lg:gap-10">
            {navItems.map((item) => (
              <Link 
                key={item.path}
                to={item.path} 
                onClick={item.onClick}
                className={`text-on-surface hover:text-primary transition-colors font-semibold text-sm uppercase tracking-wider ${location.pathname === item.path ? 'text-primary' : ''}`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex flex-col items-end mr-1">
              <span className="text-xs font-bold text-on-surface leading-none">{profile?.displayName || 'ผู้ใช้งาน'}</span>
              <span className="text-[10px] text-primary font-bold">{getDepartmentName(profile?.department || '') || profile?.position || 'Student'}</span>
              {profile?.code && <span className="text-[9px] text-on-surface-variant font-medium">{profile.code}</span>}
            </div>
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-full overflow-hidden bg-surface-container-highest border-2 border-primary/10">
                {profile?.photoURL ? (
                  <img src={profile.photoURL} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-primary/10 text-primary font-bold">
                    {profile?.displayName?.[0] || 'U'}
                  </div>
                )}
              </div>
              <button 
                onClick={handleSignOut}
                className="hidden md:flex items-center justify-center p-2 text-on-surface-variant hover:text-error hover:bg-error/10 rounded-xl transition-all"
                title="Sign Out"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {isMenuOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMenuOpen(false)}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] md:hidden"
            />
            <motion.div 
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 left-0 bottom-0 w-[280px] bg-background z-[70] md:hidden shadow-2xl p-6 flex flex-col"
            >
              <div className="flex items-center justify-between mb-10">
                <h2 className="text-2xl font-black text-primary tracking-tighter font-headline">LDO Studio</h2>
                <button onClick={() => setIsMenuOpen(false)} className="p-2 text-outline hover:text-primary">
                  <Menu className="w-6 h-6 rotate-90" />
                </button>
              </div>
              
              <nav className="flex flex-col gap-2 flex-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.path;
                  return (
                    <Link 
                      key={item.path}
                      to={item.path}
                      onClick={(e) => {
                        if (item.onClick) {
                          item.onClick(e as any);
                        }
                        setIsMenuOpen(false);
                      }}
                      className={`flex items-center gap-4 p-4 rounded-2xl transition-all ${
                        isActive 
                          ? 'bg-primary text-white shadow-lg shadow-primary/20' 
                          : 'text-on-surface hover:bg-surface-container-high'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      <span className="font-bold tracking-tight">{item.label}</span>
                    </Link>
                  );
                })}
              </nav>

              <div className="mt-auto pt-6 border-t border-outline-variant/20">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-primary/10">
                    {profile?.photoURL ? (
                      <img src={profile.photoURL} alt="User" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-primary/10 text-primary font-bold">
                        {profile?.displayName?.[0]}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col">
                    <span className="font-bold text-on-surface leading-tight">{profile?.displayName}</span>
                    <div className="flex flex-col mt-1 space-y-0.5">
                      {profile?.code && <span className="text-[10px] text-on-surface-variant font-medium">รหัส: {profile.code}</span>}
                      <span className="text-[10px] text-primary font-bold">{profile?.position || 'Student'}</span>
                      {profile?.department && <span className="text-[10px] text-on-surface-variant font-medium">หน่วยงาน: {getDepartmentName(profile.department)}</span>}
                      {profile?.phone && <span className="text-[10px] text-on-surface-variant font-medium">โทร: {profile.phone}</span>}
                      <span className="text-[10px] text-on-surface-variant/70">{profile?.email}</span>
                    </div>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    handleSignOut();
                    setIsMenuOpen(false);
                  }}
                  className="w-full py-4 bg-surface-container-high text-error font-bold rounded-xl hover:bg-error/10 transition-colors"
                >
                  Sign Out
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <main className="flex-1 pt-24 pb-32 md:pb-12">
        {children}
      </main>

      {/* Bottom Nav (Mobile) */}
      <nav className="md:hidden fixed bottom-0 w-full z-50 rounded-t-3xl bg-background/70 backdrop-blur-md shadow-[0_-4px_20px_rgba(28,27,27,0.06)] flex justify-around items-center px-4 pb-6 pt-3">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={item.onClick}
              className={`flex flex-col items-center justify-center px-5 py-2 transition-all duration-200 ${
                isActive
                  ? 'bg-gradient-to-br from-primary to-primary-container text-white rounded-2xl scale-105 shadow-lg'
                  : 'text-on-surface/60'
              }`}
            >
              <Icon className={`w-6 h-6 mb-1 ${isActive ? 'fill-current' : ''}`} />
              <span className="font-body text-[10px] font-medium uppercase tracking-widest">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Admin Password Modal */}
      <AnimatePresence>
        {showAdminPrompt && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAdminPrompt(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-sm bg-surface-container-low z-[110] rounded-3xl p-8 shadow-2xl border border-outline-variant/10"
            >
              <div className="flex flex-col items-center text-center mb-6">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                  <Lock className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-2xl font-black text-on-surface tracking-tight font-headline">Admin Access</h3>
                <p className="text-sm text-on-surface-variant mt-2">Please enter the administrator password to continue.</p>
              </div>

              <form onSubmit={verifyAdmin} className="space-y-4">
                <div className="space-y-2">
                  <input 
                    type="password" 
                    autoFocus
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="Enter password"
                    className={`w-full bg-surface-container-lowest border ${error ? 'border-error' : 'border-outline-variant/20'} rounded-2xl px-6 py-4 text-center text-lg font-bold tracking-widest focus:ring-2 focus:ring-primary/20 outline-none transition-all`}
                  />
                  {error && <p className="text-xs text-error font-bold text-center">{error}</p>}
                </div>
                <div className="flex gap-3">
                  <button 
                    type="button"
                    onClick={() => setShowAdminPrompt(false)}
                    className="flex-1 py-4 bg-surface-container-high text-on-surface font-bold rounded-2xl hover:bg-surface-container-highest transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="flex-[2] py-4 bg-primary text-white font-bold rounded-2xl shadow-lg shadow-primary/20 hover:bg-primary-container transition-all active:scale-95"
                  >
                    Unlock
                  </button>
                </div>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Footer (Desktop) */}
      <footer className="hidden md:flex w-full max-w-7xl mx-auto px-8 py-8 items-center justify-between border-t border-surface-container-high bg-surface-container-low/50 mt-auto">
        <div className="flex flex-col">
          <span className="text-[10px] font-headline font-bold text-on-surface-variant uppercase tracking-widest">Created for</span>
          <span className="text-xs font-headline font-black text-primary tracking-tight">BANGKOK UNIVERSITY</span>
        </div>
        <div className="flex items-center gap-4">
          <HelpCircle className="text-outline w-5 h-5" />
          <div className="h-4 w-px bg-outline-variant"></div>
          <span className="text-[10px] font-headline font-bold text-outline uppercase tracking-tighter">v2.4.0</span>
        </div>
      </footer>
    </div>
  );
}
