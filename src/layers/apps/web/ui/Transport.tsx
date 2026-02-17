import {
  TransportBpmControl,
  TransportControls,
  TransportLoopControl,
  TransportMasterVolume,
  TransportTimeDisplay,
} from './components/transport';

export const Transport = () => {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        padding: '8px 16px',
        background: '#252525',
        borderBottom: '1px solid #333',
        color: '#fff',
        fontSize: '13px',
      }}
    >
      <TransportControls />

      <div style={{ width: '1px', height: '24px', background: '#444' }} />

      <TransportTimeDisplay />

      <div style={{ width: '1px', height: '24px', background: '#444' }} />

      <TransportBpmControl />

      <div style={{ width: '1px', height: '24px', background: '#444' }} />

      <TransportLoopControl />

      <div style={{ width: '1px', height: '24px', background: '#444' }} />

      <TransportMasterVolume />
    </div>
  );
};
