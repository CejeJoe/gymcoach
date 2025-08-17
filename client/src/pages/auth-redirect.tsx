import { useEffect } from 'react';
import { authStorage } from '@/lib/auth';
import { useLocation } from 'wouter';

export default function AuthRedirect() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    // Clear any existing tokens
    authStorage.clear();
    
    // Redirect to login
    setLocation('/login');
  }, [setLocation]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-black to-gray-900">
      <div className="text-center">
        <div className="text-thrst-green text-xl font-bold mb-2">THRST</div>
        <p className="text-white">Redirecting to login...</p>
      </div>
    </div>
  );
}