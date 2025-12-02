import { container, card } from './styles/components.css.ts';
import { Daw } from './components/DAW';
// import { AudioEngineTest } from './components/test'; // 개발용 테스트 컴포넌트 (필요시 주석 해제)
import './styles/global.css';
import { ardourPalette } from './styles/ardourTheme';

function app() {
  return (
    <div className={container}>
      <header
        style={{
          padding: '24px 0',
          borderBottom: `1px solid ${ardourPalette.border}`,
          marginBottom: '40px',
        }}
      >
        <h1
          style={{
            fontSize: '2rem',
            fontWeight: 'bold',
            color: ardourPalette.textPrimary,
          }}
        >
          Drop.ai
        </h1>
        <p
          style={{
            color: ardourPalette.textMuted,
            marginTop: '8px',
          }}
        >
          브라우저 기반 오디오 편집 도구
        </p>
      </header>

      <main style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
        <div className={card}>
          <Daw />
        </div>

        {/* 개발용 테스트 컴포넌트 (필요시 주석 해제) */}
        {/* <div className={card}>
          <h2 style={{ marginBottom: '16px', fontSize: '1.5rem' }}>오디오 엔진 테스트</h2>
          <AudioEngineTest />
        </div> */}
      </main>
    </div>
  );
}

export default app;
