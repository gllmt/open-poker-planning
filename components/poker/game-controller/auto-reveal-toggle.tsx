import { useI18n } from '@/components/i18n/use-i18n';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

export function AutoRevealToggle({
  autoReveal,
  onAutoReveal,
  disabled = false,
}: {
  autoReveal: boolean;
  onAutoReveal: (autoReveal: boolean) => void;
  disabled?: boolean;
}) {
  const { t } = useI18n();
  return (
    <div className="flex items-center gap-2">
      <Label
        htmlFor="auto-reveal"
        className="text-muted-foreground text-xs cursor-pointer"
      >
        {t('game.autoReveal')}
      </Label>
      <Switch
        id="auto-reveal"
        checked={autoReveal}
        onCheckedChange={onAutoReveal}
        disabled={disabled}
        aria-busy={disabled}
      />
    </div>
  );
}
