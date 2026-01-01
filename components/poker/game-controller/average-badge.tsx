import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

export function AverageBadge({
  label,
  isVisible,
}: {
  label: string;
  isVisible: boolean;
}) {
  if (!isVisible) return null;

  return (
    <>
      <Separator orientation="vertical" className="h-6 mx-2" />
      <span className="text-sm font-medium">Avg:</span>
      <Badge variant="secondary" className="font-semibold ml-1">
        {label}
      </Badge>
    </>
  );
}
