'use client';

import { useRouter } from 'next/navigation';
import { type FormEvent, useEffect, useState } from 'react';

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
import { GameType, type NewGame } from '@/types/game';
import { getCards, getCustomCards } from './card-configs';

export function CreateGame() {
  const router = useRouter();

  const [gameName, setGameName] = useState('New session');
  const [createdBy, setCreatedBy] = useState<string>('');
  const [gameType, setGameType] = useState<GameType>(GameType.Fibonacci);
  const [allowMembersToManageSession, setAllowMembersToManageSession] =
    useState(false);
  const [customOptions, setCustomOptions] = useState(Array(15).fill(''));
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
        setError('Please enter at least two custom options.');
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

      router.push(`/game/${gameId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create session');
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
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <CardTitle>Create new session</CardTitle>
        </CardHeader>
        <CardContent>
          <FieldGroup className="gap-5">
            <Field>
              <FieldLabel htmlFor="gameName">Session name</FieldLabel>
              <Input
                id="gameName"
                required
                type="text"
                value={gameName}
                onChange={(event) => setGameName(event.target.value)}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="createdBy">Your name</FieldLabel>
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
                Session sizing type
              </legend>
              <div className="flex flex-col gap-2">
                {[
                  { type: GameType.Fibonacci, label: 'Fibonacci' },
                  { type: GameType.ShortFibonacci, label: 'Short Fibonacci' },
                  { type: GameType.TShirt, label: 'T-Shirt' },
                  {
                    type: GameType.TShirtAndNumber,
                    label: 'T-Shirt & Numbers',
                  },
                  { type: GameType.Custom, label: 'Custom' },
                ].map(({ type, label }) => {
                  const preview =
                    type === GameType.Custom
                      ? 'Choose your own values below (min 2).'
                      : getCards(type)
                          .map((card) => card.displayValue)
                          .join(' · ');

                  return (
                    <label
                      key={type}
                      className="flex flex-col gap-1 text-sm"
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
                        <span>{label}</span>
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
              <span>Allow members to manage session</span>
            </label>

            {error && <p className="text-destructive text-xs">{error}</p>}
          </FieldGroup>
        </CardContent>

        <CardFooter className="justify-end">
          <Button type="submit" disabled={loading}>
            {loading ? 'Creating…' : 'Create'}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
