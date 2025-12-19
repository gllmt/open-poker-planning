import { Loader2Icon } from 'lucide-react';

export function Loading({ size }: { size?: 'small' }) {
  const dimension = size === 'small' ? 16 : 32;
  return (
    <Loader2Icon
      size={dimension}
      className="text-primary animate-spin"
      aria-hidden="true"
    />
  );
}
