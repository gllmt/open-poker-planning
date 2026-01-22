'use client';

import { useRouter } from 'next/navigation';
import { type FormEvent, useEffect, useState } from 'react';

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

export function CreateGame() {
  const router = useRouter();
  const { locale, t } = useI18n();

  const [gameName, setGameName] = useState(() => t('createGame.defaultName'));
  const [createdBy, setCreatedBy] = useState<string>('');
  const [gameType, setGameType] = useState<GameType>(GameType.Fibonacci);
  const [allowMembersToManageSession, setAllowMembersToManageSession] =
    useState(false);
  const [customOptions, setCustomOptions] = useState(() => Array(15).fill(''));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const recent = getRecentPlayerName();
    if (recent && !createdBy) setCreatedBy(recent);
  }, [createdBy]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    if (gameType === GameType.Custom) {
      const count = customOptions.reduce(
        (acc, option) => (option?.trim() ? acc + 1 : acc),
        0
      );
      if (count < 2) {
        setError(t('createGame.errorCustomOptions'));
        return;
      }
    }

    setLoading(true);
    try {
      const payload: NewGame = {
        name: gameName,
        createdBy,
        gameType,
        isAllowMembersToManageSession: allowMembersToManageSession,
        cards:
          gameType === GameType.Custom
            ? getCustomCards(customOptions)
            : getCards(gameType),
      };

      const { gameId, joinToken, playerId } = await createGame(payload);

      setRecentPlayerName(createdBy);
      upsertPlayerGame({
        id: gameId,
        name: gameName,
        createdBy,
        createdById: playerId,
        playerId,
        joinToken,
        isAllowMembersToManageSession: allowMembersToManageSession,
      });

      router.push(withLocale(`/game/${gameId}`, locale));
    } catch (e) {
      setError(
        e instanceof Error ? e.message : t('createGame.errorCreateFailed')
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCustomOptionChange = (index: number, value: string) => {
    const next = [...customOptions];
    next[index] = value;
    setCustomOptions(next);
  };

  return (
    <form onSubmit={handleSubmit} className="w-full flex justify-center">
      <Card className="w-full max-w-xl">
        <CardHeader className="text-center">
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
                value={gameName}
                onChange={(event) => setGameName(event.target.value)}
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
                value={createdBy}
                onChange={(event) => setCreatedBy(event.target.value)}
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
                            checked={gameType === type}
                            onChange={() => setGameType(type)}
                          />
                          <span className="border-input peer-focus-visible:ring-ring/50 peer-focus-visible:ring-offset-background peer-focus-visible:ring-2 peer-focus-visible:ring-offset-2 peer-checked:bg-primary peer-checked:border-primary size-4 rounded-full border transition" />
                          <span className="bg-primary-foreground pointer-events-none absolute size-1.5 rounded-full opacity-0 transition peer-checked:opacity-100" />
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

            {gameType === GameType.Custom && (
              <div className="flex flex-wrap gap-2">
                {customOptions.map((option, index) => (
                  <Input
                    key={index}
                    type="text"
                    maxLength={3}
                    className="h-8 w-12 px-2 text-center text-xs"
                    value={option}
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
                  checked={allowMembersToManageSession}
                  onChange={() => setAllowMembersToManageSession((v) => !v)}
                />
                <span className="border-input peer-focus-visible:ring-ring/50 peer-focus-visible:ring-offset-background peer-focus-visible:ring-2 peer-focus-visible:ring-offset-2 peer-checked:bg-primary peer-checked:border-primary size-4 rounded-sm border transition" />
                <span className="text-primary-foreground pointer-events-none absolute text-[10px] font-semibold leading-none opacity-0 transition peer-checked:opacity-100">
                  ✓
                </span>
              </span>
              <span>{t('createGame.allowMembers')}</span>
            </label>

            {error && <p className="text-destructive text-xs">{error}</p>}
          </FieldGroup>
        </CardContent>

        <CardFooter className="justify-end">
          <Button type="submit" disabled={loading}>
            {loading ? t('common.creating') : t('common.create')}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
