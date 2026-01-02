import { useI18n } from '@/components/i18n/use-i18n';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

export function AverageBadge({
  label,
  isVisible,
}: {
  label: string;
  isVisible: boolean;
}) {
  const { t } = useI18n();
  if (!isVisible) return null;

  return (
    <>
      <Separator orientation="vertical" className="h-6 mx-2" />
      <span className="text-sm font-medium">{t('common.avgWithColon')}</span>
      <Badge variant="secondary" className="font-semibold ml-1">
        {label}
      </Badge>
    </>
  );
}
