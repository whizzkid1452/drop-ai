import { useState, type ReactNode } from 'react';
import { CliTerminal } from '@/layers/apps/cli/ui/CliTerminal';

interface WebLayoutProps {
  children: ReactNode;
}

export const WebLayout = ({ children }: WebLayoutProps) => {
  const [isCliOpen, setIsCliOpen] = useState(true);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        width: '100vw',
        overflow: 'hidden',
        backgroundColor: '#121212',
        color: '#e0e0e0',
      }}
    >
      {/* Header */}
      <header
        style={{
          height: '48px',
          borderBottom: '1px solid #333',
          display: 'flex',
          alignItems: 'center',
          padding: '0 16px',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        <div style={{ fontWeight: 'bold', fontSize: '1.2rem' }}>
          Drop AI DAW
        </div>
        <button
          onClick={() => setIsCliOpen(!isCliOpen)}
          style={{
            background: isCliOpen ? '#333' : 'transparent',
            border: '1px solid #444',
            color: '#fff',
            padding: '4px 12px',
            cursor: 'pointer',
            borderRadius: '4px',
          }}
        >
          {isCliOpen ? 'Hide CLI' : 'Show CLI'}
        </button>
      </header>

      {/* Main Body */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Main Content (DAW) */}
        <main
          style={{
            flex: 1,
            position: 'relative',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {children}
        </main>

        {/* Right Panel (CLI) */}
        {isCliOpen && (
          <aside
            style={{
              width: '400px',
              borderLeft: '1px solid #333',
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: '#1e1e1e',
              transition: 'width 0.2s',
            }}
          >
            <div
              style={{
                padding: '8px',
                borderBottom: '1px solid #333',
                fontSize: '0.9rem',
                fontWeight: 'bold',
                backgroundColor: '#252525',
              }}
            >
              Command Line Interface
            </div>
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <CliTerminal />
            </div>
          </aside>
        )}
      </div>
    </div>
  );
};
