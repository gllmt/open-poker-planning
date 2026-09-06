'use client';

import { usePostHog } from '@posthog/next';
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
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
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
  const posthog = usePostHog();
  const router = useRouter();
  const { locale, t } = useI18n();

  const [state, dispatch] = useReducer(
    createGameReducer,
    t('createGame.defaultName'),
    initCreateGameState
  );

  useEffect(() => {
    const recent = getRecentPlayerName();
    if (recent) {
      dispatch({ type: 'set-created-by', value: recent });
    }
  }, []);

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

      const { gameId, playerId } = await createGame(payload);

      setRecentPlayerName(state.createdBy);
      upsertPlayerGame({
        id: gameId,
        name: state.gameName,
        createdBy: state.createdBy,
        createdById: playerId,
        playerId,
        isAllowMembersToManageSession: state.allowMembersToManageSession,
      });

      posthog.capture('planning_poker_game_created', {
        cards_count: payload.cards.length,
        game_id: gameId,
        game_type: state.gameType,
        has_member_session_controls: state.allowMembersToManageSession,
        locale,
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
    <form onSubmit={handleSubmit} className="w-full flex justify-center">
      <Card className="w-full max-w-xl glass-card dark:dark-glass-card">
        <CardHeader>
          <CardTitle>{t('createGame.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <FieldGroup className="gap-5">
            <Field>
              <FieldLabel htmlFor="gameName">
                {t('createGame.sessionName')}
              </FieldLabel>
              <Input
                id="gameName"
                required
                type="text"
                value={state.gameName}
                onChange={(event) =>
                  dispatch({ type: 'set-game-name', value: event.target.value })
                }
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="createdBy">
                {t('createGame.yourName')}
              </FieldLabel>
              <Input
                id="createdBy"
                required
                type="text"
                value={state.createdBy}
                onChange={(event) =>
                  dispatch({
                    type: 'set-created-by',
                    value: event.target.value,
                  })
                }
              />
            </Field>

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">
                {t('createGame.sizingType')}
              </legend>
              <div className="flex flex-col gap-2">
                {GAME_TYPE_OPTIONS.map(({ type, labelKey }) => {
                  const preview =
                    type === GameType.Custom
                      ? t('createGame.customHint')
                      : (CARD_PREVIEW_BY_TYPE[type] ?? '');

                  return (
                    <label
                      key={type}
                      className="flex flex-col gap-1 text-sm cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
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
                          <span className="border-input peer-focus-visible:ring-ring/50 peer-focus-visible:ring-offset-background peer-focus-visible:ring-2 peer-focus-visible:ring-offset-2 peer-checked:bg-primary peer-checked:border-primary size-4 rounded-full border transition-all duration-200" />
                          <span className="bg-primary-foreground pointer-events-none absolute size-1.5 rounded-full scale-0 opacity-0 transition-all duration-200 peer-checked:opacity-100 peer-checked:scale-100" />
                        </span>
                        <span>{t(labelKey)}</span>
                      </span>
                      <span className="text-muted-foreground pl-6 text-xs">
                        {preview}
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            {state.gameType === GameType.Custom && (
              <div className="flex flex-wrap gap-2">
                {CUSTOM_OPTION_IDS.map((optionId, index) => (
                  <Input
                    key={optionId}
                    type="text"
                    maxLength={3}
                    className="h-8 w-12 px-2 text-center text-xs"
                    value={state.customOptions[index] ?? ''}
                    onChange={(event) =>
                      handleCustomOptionChange(index, event.target.value)
                    }
                  />
                ))}
              </div>
            )}

            <label className="flex items-center gap-2 text-sm">
              <span className="relative flex size-4 items-center justify-center">
                <input
                  type="checkbox"
                  className="peer sr-only"
                  checked={state.allowMembersToManageSession}
                  onChange={() => dispatch({ type: 'toggle-allow-members' })}
                />
                <span className="border-input peer-focus-visible:ring-ring/50 peer-focus-visible:ring-offset-background peer-focus-visible:ring-2 peer-focus-visible:ring-offset-2 peer-checked:bg-primary peer-checked:border-primary size-4 rounded-sm border transition-all duration-200" />
                <span className="text-primary-foreground pointer-events-none absolute text-[10px] font-semibold leading-none opacity-0 scale-0 transition-all duration-200 peer-checked:opacity-100 peer-checked:scale-100">
                  ✓
                </span>
              </span>
              <span>{t('createGame.allowMembers')}</span>
            </label>

            {state.error && (
              <p className="text-destructive text-xs">{state.error}</p>
            )}
          </FieldGroup>
        </CardContent>

        <CardFooter className="justify-end">
          <Button type="submit" disabled={state.loading}>
            {state.loading ? t('common.creating') : t('common.create')}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
