"use client";

import { useEffect, useState } from 'react';
import MarketingNavbar from './MarketingNavbar';
import MarketingHero from './MarketingHero';
import MarketingWhyRez from './MarketingWhyRez';
import MarketingMission from './MarketingMission';
import MarketingBigText from './MarketingBigText';
import MarketingFooter from './MarketingFooter';

interface MarketingLandingProps {
  onLogin: () => void;
}

export default function MarketingLanding({ onLogin }: MarketingLandingProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  return (
    <div className="marketing-page">
      {isMounted && (
        <>
          <MarketingNavbar />
          <MarketingHero onLogin={onLogin} />
          <MarketingWhyRez />
          <MarketingMission />
          <MarketingBigText />
          <MarketingFooter />
        </>
      )}
    </div>
  );
}
