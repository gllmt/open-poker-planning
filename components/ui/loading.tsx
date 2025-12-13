export function Loading({ size }: { size?: 'small' }) {
  const dimension = size === 'small' ? 16 : 32;
  return (
    <svg
      width={dimension}
      height={dimension}
      viewBox='0 0 32 32'
      fill='none'
      xmlns='http://www.w3.org/2000/svg'
      aria-hidden='true'
    >
      <rect x='12' y='12' width='8' height='8' rx='2' fill='#60a5fa' />
      <g className='poker-spinner-heads'>
        <circle cx='16' cy='6' r='4' fill='#fbbf24' stroke='#fff' strokeWidth='1.5' />
        <circle cx='16' cy='26' r='4' fill='#34d399' stroke='#fff' strokeWidth='1.5' />
        <circle cx='6' cy='16' r='4' fill='#a78bfa' stroke='#fff' strokeWidth='1.5' />
        <circle cx='26' cy='16' r='4' fill='#f472b6' stroke='#fff' strokeWidth='1.5' />
      </g>
    </svg>
  );
}

