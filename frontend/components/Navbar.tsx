import Link from 'next/link';
import Image from 'next/image';

export default function Navbar() {
  return (
    <nav className="bg-white border-b border-gray-200">
      <div className="max-w-[1920px] mx-auto px-8 py-3">
        <div className="flex items-center justify-between relative">
          {/* Logo */}
          <Link href="/" className="flex items-center">
            <Image src="/rez.png" alt="Rez Logo" width={50} height={50} />
          </Link>

          {/* Center Navigation - Absolutely centered */}
          <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-12 text-l font-medium text-black">
            <Link href="/live" className="hover:text-gray-600">LIVE</Link>
            <span className="text-gray-300">|</span>
            <Link href="/leaderboard" className="hover:text-gray-600">LEADERBOARD</Link>
            <span className="text-gray-300">|</span>
            <Link href="/blog" className="hover:text-gray-600">BLOG</Link>
            <span className="text-gray-300">|</span>
            <Link href="/models" className="hover:text-gray-600">MODELS</Link>
          </div>

          {/* Right Links */}
          <div className="flex items-center gap-6 text-[10px] font-medium text-black font-inter">
            <Link href="/waitlist" className="hover:text-gray-600 flex items-center gap-1">
              JOIN THE REZ WAITLIST
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </Link>
            <Link href="/about" className="hover:text-gray-600 flex items-center gap-1">
              ABOUT REZ
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
