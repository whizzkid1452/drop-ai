import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import ReactGA from 'react-ga4';

/**
 * SPA 환경에서 라우트가 변경될 때마다 GA4에 페이지뷰를 전송하는 컴포넌트입니다.
 * BrowserRouter 하위에 렌더링되어야 합니다.
 */
export const AnalyticsTracker = () => {
  const location = useLocation();

  useEffect(() => {
    // path와 search를 조합하여 유니크한 페이지 뷰를 전송합니다.
    ReactGA.send({
      hitType: 'pageview',
      page: location.pathname + location.search,
    });
  }, [location]);

  return null;
};
