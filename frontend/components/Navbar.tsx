'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';

export default function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <nav className="bg-white border-b border-gray-200">
      <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 py-3 xl:py-4">
        <div className="flex items-center justify-between relative">
          {/* Logo */}
          <Link href="/" className="flex items-center">
            <Image src="/rez.png" alt="Rez Logo" width={50} height={50} />
          </Link>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="lg:hidden p-2 text-gray-600 hover:text-black"
            aria-label="Toggle menu"
          >
            {isMenuOpen ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>

          {/* Center Navigation - Hidden on mobile */}
          <div className="hidden lg:flex absolute left-1/2 -translate-x-1/2 items-center gap-6 xl:gap-10 2xl:gap-14 text-sm xl:text-xl 2xl:text-2xl font-medium text-black">
            <Link href="/live" className="hover:text-gray-600"></Link>
            <span className="text-gray-300">|</span>
            <Link href="/leaderboard" className="hover:text-gray-600">LEADERBOARD</Link>
            <span className="text-gray-300">|</span>
            <Link href="/blog" className="hover:text-gray-600">BLOG</Link>
            <span className="text-gray-300">|</span>
            <Link href="/about" className="hover:text-gray-600">ABOUT US</Link>
              <span className="text-gray-300">|</span>
          </div>

         
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="lg:hidden mt-4 pb-4 border-t border-gray-200 pt-4">
            <div className="flex flex-col space-y-4">
              <Link href="/live" className="text-base font-medium hover:text-gray-600" onClick={() => setIsMenuOpen(false)}>LIVE</Link>
              <Link href="/leaderboard" className="text-base font-medium hover:text-gray-600" onClick={() => setIsMenuOpen(false)}>LEADERBOARD</Link>
              <Link href="/blog" className="text-base font-medium hover:text-gray-600" onClick={() => setIsMenuOpen(false)}>BLOG</Link>
              <Link href="/about" className="text-base font-medium hover:text-gray-600" onClick={() => setIsMenuOpen(false)}>ABOUT US</Link>
              <hr className="border-gray-200" />
              <Link href="/waitlist" className="text-sm font-medium hover:text-gray-600 flex items-center gap-1 font-inter" onClick={() => setIsMenuOpen(false)}>
                JOIN THE REZ WAITLIST
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </Link>
              <Link href="/about" className="text-sm font-medium hover:text-gray-600 flex items-center gap-1 font-inter" onClick={() => setIsMenuOpen(false)}>
                ABOUT REZ
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </Link>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
