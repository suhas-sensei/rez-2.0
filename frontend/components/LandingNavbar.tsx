"use client";

import Image from 'next/image';
import Link from 'next/link';

export default function LandingNavbar() {
  return (
    <nav className="absolute top-0 left-0 right-0 z-50 bg-white/70 backdrop-blur-sm ">
      <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 py-3 xl:py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <Image src="/rez1.png" alt="Rez Logo" width={40} height={40} />
            
          </Link>

          {/* Center Navigation - Hidden on mobile */}
          <div className="hidden md:flex items-center gap-6 lg:gap-10 text-sm lg:text-base font-medium text-black uppercase tracking-wide">
            <button className="hover:text-gray-600 transition-colors">Why Rez</button>
            <Link href="/manifesto" className="hover:text-gray-600 transition-colors">Manifesto</Link>
            <Link href="/roadmap" className="hover:text-gray-600 transition-colors">Roadmap</Link>
          </div>

          {/* Right - Read Litepaper Button */}
          <div className="flex items-center">
            <a
              href="https://www.papermark.com/view/cmj2tgzzd0004lb043vi5a6zb"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 text-sm font-medium bg-black text-white rounded-md hover:bg-gray-800 transition-colors uppercase tracking-wide"
            >
              Read Litepaper
            </a>
          </div>
        </div>
      </div>
    </nav>
  );
}
