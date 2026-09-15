import { Input as InputPrimitive } from '@base-ui/react/input';
import type * as React from 'react';
import { cn } from '@/lib/utils';

const inputVariantClasses = {
  default: '',
  timer:
    'text-foreground disabled:text-muted-foreground disabled:opacity-100 h-7 w-10 border-none bg-transparent p-0 text-center text-base md:text-lg focus-visible:ring-0 focus-visible:ring-offset-0',
  compact: 'h-8 w-12 px-2 text-center text-xs',
} as const;

function Input({
  className,
  type,
  variant = 'default',
  ...props
}: React.ComponentProps<'input'> & {
  variant?: keyof typeof inputVariantClasses;
}) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        'bg-input/30 border-input focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 h-9 rounded-xl border px-3 py-1 text-base transition duration-200 file:h-7 file:text-sm file:font-medium focus-visible:ring-[3px] aria-invalid:ring-[3px] md:text-sm file:text-foreground placeholder:text-muted-foreground w-full min-w-0 outline-none file:inline-flex file:border-0 file:bg-transparent disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
        inputVariantClasses[variant],
        className
      )}
      {...props}
    />
  );
}

export { Input };
