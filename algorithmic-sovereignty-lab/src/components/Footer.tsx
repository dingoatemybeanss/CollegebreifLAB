import React from 'react';
import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="bg-gray-50 border-t border-gray-200 py-8 mt-12">
      <div className="container mx-auto px-4 max-w-5xl text-center text-gray-500 text-sm">
        <p className="mb-2">
          &copy; {new Date().getFullYear()} Algorithmic Sovereignty Lab.
        </p>
        <p>
          Designed for institutional risk assessment in small democracies.
        </p>
        <div className="mt-4 flex justify-center space-x-4">
          <Link href="/framework" className="hover:text-gray-800">Framework</Link>
          <Link href="/research" className="hover:text-gray-800">Research</Link>
        </div>
      </div>
    </footer>
  );
}
