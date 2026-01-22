"use client"

import { useState } from "react"
import ColorBends from "@/components/ui/ColorBends"
import LandingNavbar from "@/components/LandingNavbar"

interface HomeHeroProps {
  onLogin: () => void
}

export default function HomeHero({ onLogin }: HomeHeroProps) {
  const [inviteCode, setInviteCode] = useState("")
  const [isValidating, setIsValidating] = useState(false)
  const [error, setError] = useState("")

  const handleLaunch = async () => {
    if (!inviteCode.trim()) {
      setError("Please enter an invite code")
      return
    }

    setIsValidating(true)
    setError("")

    try {
      const response = await fetch("/api/validate-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteCode: inviteCode.trim() }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || "Invalid invite code")
        setIsValidating(false)
        return
      }

      // Success - proceed to app
      onLogin()
    } catch (err) {
      setError("Failed to validate invite code")
      setIsValidating(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleLaunch()
    }
  }

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

          {/* Invite Code Input */}
          <div className="isolate flex flex-col items-center gap-3">
            <div className="flex gap-3 items-center">
              <input
                type="text"
                value={inviteCode}
                onChange={(e) => {
                  setInviteCode(e.target.value.toUpperCase())
                  setError("")
                }}
                onKeyDown={handleKeyDown}
                placeholder="Enter invite code"
                maxLength={4}
                className="px-4 py-3 text-base font-medium bg-white/10 backdrop-blur-sm text-white border border-white/20 rounded-md outline-none focus:border-white/50 transition-all duration-300 font-inter w-40 text-center uppercase tracking-widest placeholder:text-white/40 placeholder:normal-case placeholder:tracking-normal"
              />
              <button
                onClick={handleLaunch}
                disabled={isValidating}
                className="px-8 py-3 text-base font-medium bg-black text-white border-none rounded-md cursor-pointer transition-all duration-300 ease-out hover:bg-gray-800 font-inter disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isValidating ? "Validating..." : "Launch App"}
              </button>
            </div>
            {error && (
              <p className="text-red-400 text-sm font-inter">{error}</p>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
