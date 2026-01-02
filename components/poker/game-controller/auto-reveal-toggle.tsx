import { useI18n } from '@/components/i18n/use-i18n';

export function AutoRevealToggle({
  autoReveal,
  onAutoReveal,
}: {
  autoReveal: boolean;
  onAutoReveal: (autoReveal: boolean) => void;
}) {
  const { t } = useI18n();
  return (
    <div className="flex flex-col items-center">
      <label className="flex items-center cursor-pointer">
        <span className="text-muted-foreground mr-2 text-xs">
          {t('game.autoReveal')}
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={autoReveal}
          onClick={() => onAutoReveal(!autoReveal)}
          className={`bg-muted focus-visible:ring-ring/50 relative inline-flex h-4 w-8 items-center rounded-full transition-colors focus-visible:ring-2 focus-visible:outline-none ${
            autoReveal ? 'bg-primary' : 'bg-muted'
          }`}
          style={{ minWidth: '2rem' }}
        >
          <span
            className={`bg-background inline-block h-3 w-3 cursor-pointer transform rounded-full shadow transition-transform ${
              autoReveal ? 'translate-x-4' : 'translate-x-1'
            }`}
          />
        </button>
      </label>
    </div>
  );
}
