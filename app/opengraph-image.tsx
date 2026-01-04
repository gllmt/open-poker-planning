import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export const alt = 'Planning Poker - Free real-time estimation for agile teams';

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background:
          'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.95))',
        color: '#f8fafc',
        fontFamily: 'Arial, sans-serif',
        padding: '64px',
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: 64, fontWeight: 700, letterSpacing: '-1px' }}>
        Planning Poker
      </div>
      <div
        style={{
          marginTop: 24,
          fontSize: 28,
          fontWeight: 400,
          color: '#cbd5f5',
          maxWidth: 900,
          lineHeight: 1.3,
        }}
      >
        Free real-time estimation for agile teams
      </div>
    </div>,
    size
  );
}
