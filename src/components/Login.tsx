import { motion } from 'motion/react';
import { Diamond } from 'lucide-react';
import { useAuth } from '../App';
import { Navigate } from 'react-router-dom';

export default function Login() {
  const { user, signIn, loading } = useAuth();

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  if (user) return <Navigate to="/" />;

  return (
    <div className="bg-background font-body text-on-background min-h-screen flex flex-col items-center selection:bg-primary/10">
      <main className="w-full max-w-7xl px-6 md:px-12 lg:px-20 pt-12 md:pt-20 pb-12 flex-1 flex flex-col items-center justify-center">
        {/* Left Side: Branding and Login */}
        <div className="w-full max-w-md flex flex-col h-full justify-center">
          {/* Logo Branding */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-12 md:mb-16 flex flex-col items-start"
          >
            <div className="mb-4">
              <div className="h-12 w-12 md:h-14 md:w-14 bg-primary flex items-center justify-center rounded-xl shadow-lg shadow-primary/20 rotate-45 transform">
                <Diamond className="text-on-primary -rotate-45 w-6 h-6 md:w-8 md:h-8 fill-current" />
              </div>
            </div>
            <h1 className="font-headline font-black text-3xl md:text-4xl tracking-tighter text-primary leading-none">LDO STUDIO</h1>
          </motion.div>

          {/* Intentional Editorial Asymmetry Section */}
          <div className="space-y-8">
            <motion.header
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
            >
              <h2 className="font-headline font-bold text-4xl md:text-5xl lg:text-6xl text-on-background tracking-tight mb-4">LDO Studio <br/>Booking <br/><span className="text-primary-container">Platform</span></h2>
              <div className="w-16 h-1.5 bg-secondary-container rounded-full mb-6"></div>
              <p className="text-on-surface-variant leading-relaxed font-medium max-w-[320px]">
                Access Bangkok University's creative spaces. Please sign in with your <span className="text-primary font-semibold">@bu.ac.th</span> account to continue.
              </p>
            </motion.header>

            {/* Login Interaction Area */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="space-y-4"
            >
              <button 
                onClick={signIn}
                className="w-full bg-white border border-outline-variant/30 flex items-center justify-center gap-4 py-4 px-6 rounded-xl shadow-sm hover:shadow-md transition-all active:scale-[0.98] duration-200"
              >
                <img 
                  alt="Google Logo" 
                  className="w-6 h-6" 
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuDiqiqtrweYvF-JxhpJ6nPcFP5z4G-wzDvXx9m483h8Rk-O153_COjiszY4csPaGxJU8cP0C3gtYrToPS7QmojAWZCNO1BZ7jj8Y5R1I5XeY2H-MzbmDFTGwyTTLhuCDhF2mTAUnQU8SjUvM8zQ1apYFHhTmVVp5nhL4y3utBlqEuVFrCyv8m3XdAO5Lgmji4dDoSNtJnMUDVj0TENsSxvgY0XAaMKwFTvMPKtw1o1tiEzxqMpkqwP6q-lkdEC7hJv-rwCKEXFTxxg" 
                />
                <span className="font-headline font-bold text-on-surface tracking-tight">Sign in with Google</span>
              </button>
              <div className="flex items-center gap-4 pt-4 opacity-40">
                <div className="h-px flex-1 bg-outline-variant"></div>
                <span className="text-[10px] font-headline font-bold uppercase tracking-[0.2em]">Institutional Access</span>
                <div className="h-px flex-1 bg-outline-variant"></div>
              </div>
            </motion.div>
          </div>
        </div>
      </main>

      {/* Footer Identity */}
      <footer className="w-full max-w-7xl px-6 md:px-12 lg:px-20 py-8 flex items-center justify-between border-t border-surface-container-high bg-surface-container-low/50">
        <div className="flex flex-col">
          <span className="text-[10px] font-headline font-bold text-on-surface-variant uppercase tracking-widest">Created for</span>
          <span className="text-xs font-headline font-black text-primary tracking-tight">BANGKOK UNIVERSITY</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="h-4 w-px bg-outline-variant"></div>
          <span className="text-[10px] font-headline font-bold text-outline uppercase tracking-tighter">v2.4.0</span>
        </div>
      </footer>
    </div>
  );
}
