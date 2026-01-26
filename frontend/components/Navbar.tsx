'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';

export default function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <nav className="bg-white border-b border-gray-200">
      <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 py-2">
        <div className="flex items-center justify-between relative">
          {/* Logo */}
          <Link href="/" className="flex items-center">
            <Image src="/rez1.png" alt="Rez Logo" width={32} height={32} />
          </Link>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="lg:hidden p-1 text-gray-600 hover:text-black"
            aria-label="Toggle menu"
          >
            {isMenuOpen ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>

          {/* Center Navigation - Hidden on mobile */}
          <div className="hidden lg:flex absolute left-1/2 -translate-x-1/2 items-center gap-12 xl:gap-15 text-sm xl:text-base font-medium text-black font-inter">
            <Link href="/live" className="hover:text-gray-600"></Link>
   
            <Link href="/leaderboard" className="hover:text-gray-600">LEADERBOARD</Link>
        
            <Link href="/blog" className="hover:text-gray-600">BLOG</Link>
     
            <Link href="/about" className="hover:text-gray-600">ABOUT US</Link>
          
          </div>

         
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="lg:hidden mt-2 pb-2 border-t border-gray-200 pt-2">
            <div className="flex flex-col space-y-3 font-inter">
              <Link href="/leaderboard" className="text-sm font-medium text-black hover:text-gray-600 transition-colors" onClick={() => setIsMenuOpen(false)}>LEADERBOARD</Link>
              <Link href="/blog" className="text-sm font-medium text-black hover:text-gray-600 transition-colors" onClick={() => setIsMenuOpen(false)}>BLOG</Link>
              <Link href="/about" className="text-sm font-medium text-black hover:text-gray-600 transition-colors" onClick={() => setIsMenuOpen(false)}>ABOUT US</Link>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
