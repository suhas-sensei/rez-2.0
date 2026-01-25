"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { gsap } from 'gsap';
import { ScrollToPlugin } from 'gsap/ScrollToPlugin';
import { AnimatedShinyText } from './ui/animated-shiny-text';

gsap.registerPlugin(ScrollToPlugin);

const Navbar = () => {
    const [scrolled, setScrolled] = useState(false);
    const pathname = usePathname();

    useEffect(() => {
        const handleScroll = () => {
            const isScrolled = window.scrollY > 50;
            if (isScrolled !== scrolled) {
                setScrolled(isScrolled);
            }
        };

        window.addEventListener('scroll', handleScroll);
        return () => {
            window.removeEventListener('scroll', handleScroll);
        };
    }, [scrolled]);

    const scrollToSection = (id: string) => {
        if (pathname !== '/') {
            if (id === '#hero') {
                window.location.href = '/';
            } else {
                window.location.href = `/${id}`;
            }
            return;
        }
        gsap.to(window, { duration: 1, scrollTo: id, ease: 'power2.out' });
    };

    return (
        <nav className={`navbar ${scrolled ? 'scrolled' : ''}`}>
            <div className="navbar-content">
                <div className="navbar-left">
                    <div className="navbar-brand" onClick={() => scrollToSection('#hero')}>
                        <img src="/assets/rez.png" alt="Rez Logo" className="brand-logo" />
                        <span className="brand-name">Rez</span>
                    </div>
                </div>

                <div className="navbar-center">
                    <div className="navbar-links">
                        <button onClick={() => scrollToSection('#why-rez')} className="nav-link">Why Rez</button>
                        <Link href="/manifesto" className="nav-link"><AnimatedShinyText>Manifesto</AnimatedShinyText></Link>
                        <Link href="/roadmap" className="nav-link">Roadmap</Link>
                        {/* <a href="https://www.papermark.com/view/cmj2tgzzd0004lb043vi5a6zb" target="_blank" rel="noopener noreferrer" className="nav-link">Litepaper</a> */}
                    </div>
                </div>

                <div className="navbar-right">
                    <a href="https://www.papermark.com/view/cmj2tgzzd0004lb043vi5a6zb" target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-light launch-app-btn">Read Litepaper</a>
                </div>
            </div>
        </nav>
    );
};

export default Navbar;
