import { useI18n } from '@/components/i18n/use-i18n';

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
    <div className="flex flex-col items-center">
      <label
        className={`flex items-center ${
          disabled ? 'cursor-not-allowed' : 'cursor-pointer'
        }`}
      >
        <span className="text-muted-foreground mr-2 text-xs font-medium">
          {t('game.autoReveal')}
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={autoReveal}
          aria-busy={disabled}
          onClick={() => onAutoReveal(!autoReveal)}
          disabled={disabled}
          className={`focus-visible:ring-ring/50 relative inline-flex h-5 w-10 items-center rounded-full transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60 ${
            autoReveal ? 'bg-primary' : 'bg-muted'
          }`}
          style={{ minWidth: '2.5rem' }}
        >
          <span
            className={`bg-background inline-block h-4 w-4 cursor-pointer transform rounded-full shadow transition-transform ${
              autoReveal ? 'translate-x-5' : 'translate-x-1'
            }`}
          />
        </button>
      </label>
    </div>
  );
}
