import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';

export default function Navbar() {
  const [user, setUser] = useState<User | null>(null);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
    router.push('/');
  };

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200">
      <div className="container mx-auto px-4 max-w-5xl h-16 flex items-center justify-between">
        <div className="flex items-center space-x-6">
          <Link href="/" className="font-bold text-xl text-blue-700 tracking-tight">
            Algorithmic Sovereignty Lab
          </Link>
          <div className="hidden md:flex space-x-4">
            <Link href="/framework" className="text-gray-600 hover:text-blue-600 font-medium">Framework</Link>
            <Link href="/toolkit" className="text-gray-600 hover:text-blue-600 font-medium">Toolkit</Link>
            <Link href="/profiler" className="text-gray-600 hover:text-blue-600 font-medium">Profiler</Link>
            <Link href="/research" className="text-gray-600 hover:text-blue-600 font-medium">Research</Link>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          {user ? (
            <>
              <Link href="/dashboard" className="text-gray-600 hover:text-blue-600 font-medium">Dashboard</Link>
              <button onClick={handleLogout} className="text-sm text-gray-500 hover:text-gray-800">
                Logout
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="text-gray-600 hover:text-blue-600 font-medium">Login</Link>
              <Link href="/signup" className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors">
                Sign up
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
