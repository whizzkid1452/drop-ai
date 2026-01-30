import { useState, useRef, useEffect } from 'react';

export const useInfiniteScroll = (initialBuffer = 300) => {
  const [extraDuration, setExtraDuration] = useState(initialBuffer);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setExtraDuration((prev) => prev + 300);
        }
      },
      {
        root: null,
        rootMargin: '0px',
        threshold: 0.1,
      }
    );

    if (sentinelRef.current) {
      observer.observe(sentinelRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, []);

  return { extraDuration, sentinelRef };
};
