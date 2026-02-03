'use client';

export default function Loading() {
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center">
      <img
        src="/rez.png"
        alt="Loading..."
        className="w-16 h-16 animate-pulse"
      />
    </div>
  );
}
