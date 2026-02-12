import React, { useState } from 'react';

import ColorBends from './ui/ColorBends';
import { AuroraText } from './ui/aurora-text';

interface HeroProps {
    onLogin?: () => void;
}

const Hero = ({ onLogin }: HeroProps) => {
    const [inviteCode, setInviteCode] = useState("");
    const [isValidating, setIsValidating] = useState(false);
    const [error, setError] = useState("");

    const handleLaunch = async () => {
        if (!inviteCode.trim()) {
            setError("Please enter an invite code");
            return;
        }

        setIsValidating(true);
        setError("");

        try {
            const response = await fetch("/api/validate-invite", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ inviteCode: inviteCode.trim() }),
            });

            const data = await response.json();

            if (!response.ok) {
                setError(data.error || "Invalid invite code");
                setIsValidating(false);
                return;
            }

            // Success - proceed to app
            if (onLogin) {
                onLogin();
            }
        } catch (err) {
            setError("Failed to validate invite code");
            setIsValidating(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
            handleLaunch();
        }
    };

    return (
        <section className="marketing-hero relative overflow-hidden" id="hero">
            <div className="absolute inset-0 z-0">
                <ColorBends
                    colors={["#757575ff"]}
                    rotation={30}
                    speed={0.3}
                    scale={1.2}
                    frequency={1.4}
                    warpStrength={1}
                    mouseInfluence={0.8}
                    parallax={0.5}
                    noise={0.1}
                // transparent
                />
            </div>
            <div className="container mx-auto relative z-10 flex items-center justify-center h-full">
                <div className="text-center">
                    <h1 className="marketing-hero-title">
                        The Future of Perps<br />
                        <span className="italic">
                            <AuroraText
                                colors={['#4B5563', '#6B7280', '#9CA3AF', '#71717A', '#52525B']}
                                speed={1.2}
                            >
                                is Autonomous
                            </AuroraText>
                        </span>
                    </h1>
                    <p className="marketing-hero-subtitle">
                        Rez is a non-custodial platform that automates perpetual trading using AI agents.
                    </p>
                    <div className="isolate flex flex-col items-center gap-2 min-[360px]:gap-3 mt-5 min-[360px]:mt-8">
                        <div className="flex gap-2 min-[360px]:gap-3 items-center">
                            <div className="relative w-32 min-[360px]:w-40">
                                <input
                                    type="text"
                                    value={inviteCode}
                                    onChange={(e) => {
                                        setInviteCode(e.target.value.toUpperCase());
                                        setError("");
                                    }}
                                    onKeyDown={handleKeyDown}
                                    placeholder="Enter invite code"
                                    maxLength={4}
                                    className="px-3 min-[360px]:px-4 py-2 min-[360px]:py-3 text-sm min-[360px]:text-base font-medium bg-white/10 backdrop-blur-sm text-transparent caret-gray-700 border border-gray-300 rounded-md outline-none focus:border-black transition-all duration-300 font-inter w-32 min-[360px]:w-40 text-center uppercase tracking-widest placeholder:text-gray-400 placeholder:normal-case placeholder:tracking-normal selection:bg-gray-200"
                                />
                                {inviteCode.length > 0 && (
                                    <span className="absolute inset-0 flex items-center justify-center text-sm min-[360px]:text-base font-medium text-gray-700 pointer-events-none tracking-widest font-inter">
                                        {'*'.repeat(inviteCode.length)}
                                    </span>
                                )}
                            </div>
                            <button
                                onClick={handleLaunch}
                                disabled={isValidating}
                                className="px-5 min-[360px]:px-8 py-2 min-[360px]:py-3 text-sm min-[360px]:text-base font-medium bg-black text-white border-none rounded-md cursor-pointer transition-all duration-300 ease-out hover:bg-gray-800 font-inter disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isValidating ? "Validating..." : "Launch App"}
                            </button>
                        </div>
                        {error && (
                            <p className="text-red-600 text-sm font-inter">{error}</p>
                        )}
                    </div>
                </div>
            </div>

        </section>
    );
};

export default Hero;
