import { useState, useEffect } from 'react';

function getWidth(): number {
  return typeof window !== 'undefined' ? window.innerWidth : 1200;
}

export function useBreakpoint() {
  const [width, setWidth] = useState(getWidth);

  useEffect(() => {
    const handler = () => setWidth(window.innerWidth);
    window.addEventListener('resize', handler, { passive: true });
    return () => window.removeEventListener('resize', handler);
  }, []);

  return {
    width,
    isMobile: width < 640,
    isTablet: width < 1024,
  };
}
