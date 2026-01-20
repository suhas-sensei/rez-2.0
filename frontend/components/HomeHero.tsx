"use client"

import ColorBends from "@/components/ui/ColorBends"
import LandingNavbar from "@/components/LandingNavbar"

interface HomeHeroProps {
  onLogin: () => void
}

export default function HomeHero({ onLogin }: HomeHeroProps) {
  return (
    <section className="relative w-full h-screen flex items-center justify-center bg-white overflow-hidden isolate">
      {/* Landing Navbar */}
      <LandingNavbar />

      {/* Animated Background */}
      <div className="absolute inset-0 w-full h-full">
        <ColorBends
          colors={[]}
          rotation={45}
          speed={0.2}
          scale={1}
          parallax={0.5}
          mouseInfluence={0.5}
          frequency={1}
          warpStrength={1}
          transparent={false}
          noise={true}
        />
        {/* Translucent white overlay to lighten the background */}
        <div className="absolute inset-0 bg-white/5" />
      </div>

      {/* Content - no z-index to allow proper blending */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center px-8 max-w-[900px]">
          {/* Title with per-pixel invert */}
          <h1
            className="text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-normal mb-0 leading-tight text-white mix-blend-difference pointer-events-none"
          >
            The Future of Perps
          </h1>

          {/* Gradient text with invert effect */}
          <h1
            className="text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-normal mb-8 leading-tight italic mix-blend-difference pointer-events-none"
            style={{
              background: "linear-gradient(135deg, #9333ea, #3b82f6, #06b6d4, #8b5cf6)",
              backgroundSize: "200% auto",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              animation: "aurora 8s ease infinite",
            }}
          >
            is Autonomous
          </h1>

          {/* Description with per-pixel invert */}
          <p className="text-base md:text-lg lg:text-xl mb-10 text-white mix-blend-difference font-inter pointer-events-none">
            Rez is a non-custodial platform that automates perpetual trading using
            AI agents.
          </p>

          {/* Button - isolated from blend */}
          <div className="isolate flex gap-4 justify-center flex-wrap">
            <button
              onClick={onLogin}
              className="px-8 py-3 text-base font-medium bg-black text-white border-none rounded-md cursor-pointer transition-all duration-300 ease-out hover:bg-gray-800 font-inter"
            >
              Launch App
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
