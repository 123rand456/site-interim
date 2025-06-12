import React from 'react';
import { AuthProvider } from '../contexts/AuthContext';
import AuthButton from './AuthButton';

export default function AuthButtonWrapper() {
  return (
    <AuthProvider>
      <AuthButton />
    </AuthProvider>
  );
}
