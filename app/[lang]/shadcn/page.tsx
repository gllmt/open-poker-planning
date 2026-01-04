import type { Metadata } from 'next';

import { ComponentExample } from '@/components/component-example';

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default function Page() {
  return <ComponentExample />;
}
