import React, { useEffect, useState, createContext, useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { onAuthStateChanged, User, GoogleAuthProvider } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db, signInWithGoogle, logOut } from './firebase';
import { UserProfile, AllowedUser } from './types';
import { getDepartmentName, ADMIN_EMAILS } from './constants';
import Login from './components/Login';
import Calendar from './components/Calendar';
import BookingForm from './components/BookingForm';
import MyBookings from './components/MyBookings';
import AdminDashboard from './components/AdminDashboard';
import Layout from './components/Layout';
import { AnimatePresence, motion } from 'motion/react';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  accessToken: string | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(sessionStorage.getItem('google_access_token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        setUser(user);
        if (user) {
          // If we have a user but no token in state, check session storage
          if (!accessToken) {
            const storedToken = sessionStorage.getItem('google_access_token');
            if (storedToken) setAccessToken(storedToken);
          }
          const emailId = user.email?.toLowerCase().replace(/\./g, '_') || '';
          const allowedDoc = await getDoc(doc(db, 'allowed_users', emailId));
          const allowedData = allowedDoc.exists() ? allowedDoc.data() as AllowedUser : null;
          const isAdmin = user.email && ADMIN_EMAILS.includes(user.email.toLowerCase());

          if (!allowedData && !isAdmin) {
            await logOut();
            alert('อีเมลของคุณไม่ได้รับอนุญาตให้เข้าใช้งานระบบ กรุณาติดต่อผู้ดูแลระบบ');
            setLoading(false);
            return;
          }

          const userDoc = await getDoc(doc(db, 'users', user.uid));
          const existingProfile = userDoc.exists() ? userDoc.data() as UserProfile : null;

          // Sync profile with allowed_users data if available
          const updatedProfile: UserProfile = {
            uid: user.uid,
            email: user.email,
            photoURL: user.photoURL,
            displayName: allowedData?.name || user.displayName || 'ผู้ใช้งาน',
            department: getDepartmentName(allowedData?.department || existingProfile?.department || ''),
            phone: allowedData?.phone || existingProfile?.phone || '',
            position: allowedData?.position || existingProfile?.position || 'บุคลากร',
            code: allowedData?.code || existingProfile?.code || '',
            role: isAdmin ? 'admin' : (existingProfile?.role || 'student'),
          };

          // Update Firestore if profile is new or data changed
          if (!existingProfile || 
              existingProfile.displayName !== updatedProfile.displayName ||
              existingProfile.department !== updatedProfile.department ||
              existingProfile.phone !== updatedProfile.phone ||
              existingProfile.position !== updatedProfile.position ||
              existingProfile.code !== updatedProfile.code) {
            try {
              await setDoc(doc(db, 'users', user.uid), updatedProfile, { merge: true });
            } catch (err) {
              console.error('Failed to update user profile in Firestore:', err);
              // We continue even if this fails, so the user can still use the app.
              // This can happen if Firestore rules are not updated yet.
            }
          }

          setProfile(updatedProfile);
        } else {
          setProfile(null);
          setAccessToken(null);
        }
      } catch (error) {
        console.error('Error in auth state change:', error);
      } finally {
        setLoading(false);
      }
    });
    return unsubscribe;
  }, []);

  const signIn = async () => {
    try {
      const result = await signInWithGoogle();
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential && credential.accessToken) {
        setAccessToken(credential.accessToken);
        sessionStorage.setItem('google_access_token', credential.accessToken);
      }
    } catch (error: any) {
      console.error('Sign in error:', error);
      // Ignore common benign errors that don't need to be alerted to the user
      if (error.code === 'auth/cancelled-popup-request' || 
          error.code === 'auth/popup-closed-by-user') {
        return;
      }
      alert(`Sign in failed: ${error.message}\nCode: ${error.code}`);
    }
  };

  const signOut = async () => {
    try {
      await logOut();
      sessionStorage.removeItem('google_access_token');
      setAccessToken(null);
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, accessToken, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  return user ? <>{children}</> : <Navigate to="/login" />;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { profile, loading } = useAuth();
  const isAdminSession = sessionStorage.getItem('admin_auth') === 'true';
  
  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  
  const isAdmin = profile?.email && ADMIN_EMAILS.includes(profile.email.toLowerCase());
  if (profile?.role === 'admin' || isAdmin || isAdminSession) {
    return <>{children}</>;
  }
  
  return <Navigate to="/" />;
}

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <motion.div key={location.pathname} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        <Routes location={location}>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<PrivateRoute><Layout><Calendar /></Layout></PrivateRoute>} />
          <Route path="/book/:studioId" element={<PrivateRoute><Layout><BookingForm /></Layout></PrivateRoute>} />
          <Route path="/my-bookings" element={<PrivateRoute><Layout><MyBookings /></Layout></PrivateRoute>} />
          <Route path="/admin" element={<AdminRoute><Layout><AdminDashboard /></Layout></AdminRoute>} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </motion.div>
    </AnimatePresence>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <AnimatedRoutes />
      </Router>
    </AuthProvider>
  );
}
