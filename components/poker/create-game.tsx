'use client';

import { ChevronRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { type FormEvent, useEffect, useReducer } from 'react';

import { useI18n } from '@/components/i18n/use-i18n';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { createGame } from '@/lib/api/games';
import {
  getRecentPlayerName,
  setRecentPlayerName,
  upsertPlayerGame,
} from '@/lib/browser-storage';
import { withLocale } from '@/lib/i18n/paths';
import { GameType, type NewGame } from '@/types/game';
import { getCards, getCustomCards } from './card-configs';

const GAME_TYPE_OPTIONS = [
  { type: GameType.Fibonacci, labelKey: 'createGame.fibonacci' },
  { type: GameType.ShortFibonacci, labelKey: 'createGame.shortFibonacci' },
  { type: GameType.TShirt, labelKey: 'createGame.tshirt' },
  { type: GameType.TShirtAndNumber, labelKey: 'createGame.tshirtNumbers' },
  { type: GameType.Custom, labelKey: 'createGame.custom' },
] as const;

const CUSTOM_OPTION_IDS = Array.from(
  { length: 15 },
  (_, index) => `custom-option-${index + 1}`
);

const CARD_PREVIEW_BY_TYPE: Partial<Record<GameType, string>> = {
  [GameType.Fibonacci]: getCards(GameType.Fibonacci)
    .map((card) => card.displayValue)
    .join(' · '),
  [GameType.ShortFibonacci]: getCards(GameType.ShortFibonacci)
    .map((card) => card.displayValue)
    .join(' · '),
  [GameType.TShirt]: getCards(GameType.TShirt)
    .map((card) => card.displayValue)
    .join(' · '),
  [GameType.TShirtAndNumber]: getCards(GameType.TShirtAndNumber)
    .map((card) => card.displayValue)
    .join(' · '),
};

type CreateGameState = {
  gameName: string;
  createdBy: string;
  gameType: GameType;
  allowMembersToManageSession: boolean;
  customOptions: string[];
  loading: boolean;
  error: string | null;
};

type CreateGameAction =
  | { type: 'set-game-name'; value: string }
  | { type: 'set-created-by'; value: string }
  | { type: 'set-game-type'; value: GameType }
  | { type: 'toggle-allow-members' }
  | { type: 'set-custom-option'; index: number; value: string }
  | { type: 'set-loading'; value: boolean }
  | { type: 'set-error'; value: string | null };

function initCreateGameState(defaultName: string): CreateGameState {
  return {
    gameName: defaultName,
    createdBy: '',
    gameType: GameType.Fibonacci,
    allowMembersToManageSession: false,
    customOptions: Array(15).fill(''),
    loading: false,
    error: null,
  };
}

function createGameReducer(
  state: CreateGameState,
  action: CreateGameAction
): CreateGameState {
  switch (action.type) {
    case 'set-game-name':
      return { ...state, gameName: action.value };
    case 'set-created-by':
      return { ...state, createdBy: action.value };
    case 'set-game-type':
      return { ...state, gameType: action.value };
    case 'toggle-allow-members':
      return {
        ...state,
        allowMembersToManageSession: !state.allowMembersToManageSession,
      };
    case 'set-custom-option': {
      const next = [...state.customOptions];
      next[action.index] = action.value;
      return { ...state, customOptions: next };
    }
    case 'set-loading':
      return { ...state, loading: action.value };
    case 'set-error':
      return { ...state, error: action.value };
    default:
      return state;
  }
}

export function CreateGame() {
  const router = useRouter();
  const { locale, t } = useI18n();

  const [state, dispatch] = useReducer(
    createGameReducer,
    t('createGame.defaultName'),
    initCreateGameState
  );

  useEffect(() => {
    const recent = getRecentPlayerName();
    if (recent && !state.createdBy) {
      dispatch({ type: 'set-created-by', value: recent });
    }
  }, [state.createdBy]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    dispatch({ type: 'set-error', value: null });

    if (state.gameType === GameType.Custom) {
      const count = state.customOptions.reduce(
        (acc, option) => (option?.trim() ? acc + 1 : acc),
        0
      );
      if (count < 2) {
        dispatch({
          type: 'set-error',
          value: t('createGame.errorCustomOptions'),
        });
        return;
      }
    }

    dispatch({ type: 'set-loading', value: true });
    try {
      const payload: NewGame = {
        name: state.gameName,
        createdBy: state.createdBy,
        gameType: state.gameType,
        isAllowMembersToManageSession: state.allowMembersToManageSession,
        cards:
          state.gameType === GameType.Custom
            ? getCustomCards(state.customOptions)
            : getCards(state.gameType),
      };

      const {
        gameId,
        joinToken,
        joinTokenHash,
        playerId,
        playerTokenHash,
        adminTokenHash,
      } = await createGame(payload);

      setRecentPlayerName(state.createdBy);
      upsertPlayerGame({
        id: gameId,
        name: state.gameName,
        createdBy: state.createdBy,
        createdById: playerId,
        playerId,
        joinToken,
        joinTokenHash,
        playerTokenHash,
        adminTokenHash,
        isAllowMembersToManageSession: state.allowMembersToManageSession,
      });

      router.push(withLocale(`/game/${gameId}`, locale));
    } catch (e) {
      dispatch({
        type: 'set-error',
        value:
          e instanceof Error ? e.message : t('createGame.errorCreateFailed'),
      });
    } finally {
      dispatch({ type: 'set-loading', value: false });
    }
  };

  const handleCustomOptionChange = (index: number, value: string) => {
    dispatch({ type: 'set-custom-option', index, value });
  };

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <Card className="ring-primary/15 w-full border border-border/70 bg-card/95 shadow-sm">
        <CardHeader className="border-b border-border/60 pb-5">
          <CardTitle className="text-xl font-semibold tracking-tight md:text-2xl">
            {t('createGame.title')}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="space-y-6">
            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2">
                <label
                  className="block pb-1 text-sm font-medium"
                  htmlFor="gameName"
                >
                  {t('createGame.sessionName')}{' '}
                  <span className="text-destructive" aria-hidden="true">
                    *
                  </span>
                </label>
                <Input
                  id="gameName"
                  name="gameName"
                  required
                  type="text"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder={`${t('createGame.defaultName')}…`}
                  className="h-11 rounded-xl border-border/70 bg-background/70 px-4"
                  value={state.gameName}
                  onChange={(event) =>
                    dispatch({
                      type: 'set-game-name',
                      value: event.target.value,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <label
                  className="block pb-1 text-sm font-medium"
                  htmlFor="createdBy"
                >
                  {t('createGame.yourName')}{' '}
                  <span className="text-destructive" aria-hidden="true">
                    *
                  </span>
                </label>
                <Input
                  id="createdBy"
                  name="createdBy"
                  required
                  type="text"
                  autoComplete="nickname"
                  placeholder="Alex…"
                  className="h-11 rounded-xl border-border/70 bg-background/70 px-4"
                  value={state.createdBy}
                  onChange={(event) =>
                    dispatch({
                      type: 'set-created-by',
                      value: event.target.value,
                    })
                  }
                />
              </div>
            </div>

            <fieldset className="space-y-3">
              <legend className="text-sm font-medium tracking-wide">
                {t('createGame.sizingType')}
              </legend>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {GAME_TYPE_OPTIONS.map(({ type, labelKey }) => {
                  const preview =
                    type === GameType.Custom
                      ? t('createGame.customHint')
                      : (CARD_PREVIEW_BY_TYPE[type] ?? '');
                  const selected = state.gameType === type;

                  return (
                    <label
                      key={type}
                      className={`ring-primary/40 focus-within:ring-primary/50 flex cursor-pointer flex-col gap-1 rounded-2xl border p-4 text-sm transition-colors focus-within:ring-2 ${
                        selected
                          ? 'border-primary/60 bg-primary/10'
                          : 'border-border/70 bg-background/60 hover:border-primary/35 hover:bg-primary/5'
                      }`}
                    >
                      <span className="flex items-center gap-2 font-semibold">
                        <span className="relative flex size-4 items-center justify-center">
                          <input
                            type="radio"
                            className="peer sr-only"
                            name="gameType"
                            value={type}
                            checked={state.gameType === type}
                            onChange={() =>
                              dispatch({ type: 'set-game-type', value: type })
                            }
                          />
                          <span className="border-input peer-focus-visible:ring-ring/50 peer-focus-visible:ring-offset-background peer-focus-visible:ring-2 peer-focus-visible:ring-offset-2 peer-checked:bg-primary peer-checked:border-primary size-4 rounded-full border transition-colors" />
                          <span className="bg-primary-foreground pointer-events-none absolute size-1.5 rounded-full opacity-0 transition peer-checked:opacity-100" />
                        </span>
                        <span>{t(labelKey)}</span>
                      </span>
                      <span className="text-muted-foreground min-h-[2.25rem] pl-6 text-xs">
                        {preview}
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            {state.gameType === GameType.Custom && (
              <div className="bg-muted/35 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-1 space-y-3 rounded-xl border border-border/70 p-4">
                <p className="text-sm font-medium">
                  {t('createGame.customHint')}
                </p>
                <div className="grid grid-cols-5 gap-2 sm:grid-cols-6">
                  {CUSTOM_OPTION_IDS.map((optionId, index) => (
                    <Input
                      key={optionId}
                      name={optionId}
                      type="text"
                      maxLength={3}
                      autoComplete="off"
                      placeholder={`${index + 1}`}
                      className="h-9 rounded-lg border-border/70 bg-background text-center text-xs"
                      value={state.customOptions[index] ?? ''}
                      onChange={(event) =>
                        handleCustomOptionChange(index, event.target.value)
                      }
                    />
                  ))}
                </div>
              </div>
            )}

            <label
              htmlFor="allow-members"
              className="text-foreground/95 inline-flex items-center gap-2 text-sm font-medium"
            >
              <span className="relative flex size-4 items-center justify-center">
                <input
                  id="allow-members"
                  name="allowMembersToManageSession"
                  type="checkbox"
                  className="peer sr-only"
                  checked={state.allowMembersToManageSession}
                  onChange={() => dispatch({ type: 'toggle-allow-members' })}
                />
                <span className="border-input peer-focus-visible:ring-ring/50 peer-focus-visible:ring-offset-background peer-focus-visible:ring-2 peer-focus-visible:ring-offset-2 peer-checked:bg-primary peer-checked:border-primary size-4 rounded-sm border transition" />
                <span className="text-primary-foreground pointer-events-none absolute text-[10px] font-semibold leading-none opacity-0 transition peer-checked:opacity-100">
                  ✓
                </span>
              </span>
              <span>{t('createGame.allowMembers')}</span>
            </label>

            {state.error && (
              <output
                aria-live="polite"
                className="text-destructive block rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs"
              >
                {state.error}
              </output>
            )}
          </div>
        </CardContent>

        <CardFooter className="justify-start border-t border-border/60">
          <Button
            type="submit"
            size="lg"
            disabled={state.loading}
            className="group h-11 rounded-4xl px-6"
          >
            {state.loading ? (
              <>
                <span
                  className="size-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent"
                  aria-hidden="true"
                />
                {t('common.creating')}
              </>
            ) : (
              <>
                {t('common.create')}
                <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </>
            )}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
