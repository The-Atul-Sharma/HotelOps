import { useEffect, useState } from 'react';

const MOBILE_QUERY = '(max-width: 767px)';

function getIsMobile() {
  return typeof window !== 'undefined' && window.matchMedia(MOBILE_QUERY).matches;
}

export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(getIsMobile);

  useEffect(() => {
    const mql = window.matchMedia(MOBILE_QUERY);
    const onChange = () => setIsMobile(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return isMobile;
}
