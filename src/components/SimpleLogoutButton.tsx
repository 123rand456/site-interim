import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../utils/supabase';

export default function SimpleLogoutButton() {
  const { signOut } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    if (isLoggingOut) {
      console.log('Logout already in progress, ignoring...');
      return;
    }

    setIsLoggingOut(true);
    console.log('🚪 Starting logout process...');

    try {
      // Set a timeout for the entire logout process (5 seconds max)
      const logoutPromise = performLogout();
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Logout timeout')), 5000)
      );

      await Promise.race([logoutPromise, timeoutPromise]);
    } catch (error) {
      console.error('❌ Logout failed:', error);
      console.log('🔄 Forcing logout anyway...');
    } finally {
      // Always force redirect, regardless of what happened
      console.log('🏠 Redirecting to home...');
      localStorage.clear();
      sessionStorage.clear();
      window.location.href = '/';
    }
  };

  const performLogout = async () => {
    try {
      console.log('🔍 Checking session...');

      // Quick session check with 2-second timeout
      const sessionPromise = supabase.auth.getSession();
      const sessionTimeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Session check timeout')), 2000)
      );

      const result = (await Promise.race([
        sessionPromise,
        sessionTimeout,
      ])) as any;
      const {
        data: { session },
        error,
      } = result;

      if (error || !session) {
        console.log('❌ No valid session, skipping Supabase logout');
        return;
      }

      console.log('✅ Valid session found, calling AuthContext signOut...');
      await signOut();
      console.log('✅ AuthContext signOut completed');
    } catch (error) {
      console.warn('⚠️ Session check/logout failed:', error);
      throw error;
    }
  };

  return (
    <button
      onClick={handleLogout}
      disabled={isLoggingOut}
      className={`px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded-lg transition-colors flex items-center space-x-2 ${
        isLoggingOut ? 'cursor-not-allowed' : 'cursor-pointer'
      }`}
    >
      <svg
        className="w-4 h-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013 3v1"
        />
      </svg>
      <span>{isLoggingOut ? 'Signing Out...' : 'Sign Out'}</span>
    </button>
  );
}
