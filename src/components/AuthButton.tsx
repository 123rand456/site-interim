import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { base } from '../utils/constants';

export default function AuthButton() {
  const { admin, signIn, signOut, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage(null);

    try {
      await signIn(email);
      setMessage({
        type: 'success',
        text: 'Check your email for the login link!',
      });
      setShowForm(false);
    } catch (error) {
      setMessage({
        type: 'error',
        text: `Failed to send login link: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center w-8 h-8">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
      </div>
    );
  }

  if (admin) {
    return (
      <div className="relative group">
        <button
          onClick={() => signOut()}
          className="flex items-center justify-center w-8 h-8 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
          title="Sign Out"
        >
          <img
            src={`${base}admin-sign-in.svg`}
            alt="Admin"
            className="h-5 w-5"
          />
        </button>
        <span className="settings-tooltip group-hover:opacity-100">
          Signed in as {admin.email}
        </span>
      </div>
    );
  }

  return (
    <div className="relative group">
      <button
        onClick={() => setShowForm(!showForm)}
        className="flex items-center justify-center w-8 h-8 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
      >
        <img src={`${base}admin-sign-in.svg`} alt="Admin" className="h-5 w-5" />
      </button>
      <span className="settings-tooltip group-hover:opacity-100">
        Admin Sign In
      </span>

      {showForm && (
        <>
          <div
            role="button"
            tabIndex={0}
            className="fixed inset-0 bg-black bg-opacity-50 z-40"
            onClick={() => setShowForm(false)}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') {
                setShowForm(false);
              }
            }}
          ></div>
          <div className="absolute right-full md:right-full bottom-full md:bottom-auto md:top-0 mb-2 md:mr-2 w-72 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 border border-gray-200 dark:border-gray-700 z-50">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Admin Email
                </label>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm"
                  required
                />
              </div>

              {message && (
                <div
                  className={`p-2 text-sm rounded ${
                    message.type === 'success'
                      ? 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-400'
                      : 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-400'
                  }`}
                >
                  {message.text}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {isSubmitting ? 'Sending...' : 'Send Magic Link'}
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
