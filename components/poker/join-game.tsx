'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { type FormEvent, useEffect, useMemo, useState } from 'react';

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
import { fetchGameState, joinGame } from '@/lib/api/games';
import {
  getCurrentPlayerId,
  getRecentPlayerName,
  setRecentPlayerName,
  upsertPlayerGame,
} from '@/lib/browser-storage';

export function JoinGame({ initialGameId }: { initialGameId?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialToken = useMemo(
    () => searchParams.get('token') || '',
    [searchParams]
  );

  const [joinGameId, setJoinGameId] = useState(initialGameId || '');
  const [inviteToken, setInviteToken] = useState(initialToken);
  const [playerName, setPlayerName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const recent = getRecentPlayerName();
    if (recent && !playerName) setPlayerName(recent);
  }, [playerName]);

  useEffect(() => {
    if (!joinGameId) return;
    const existingPlayerId = getCurrentPlayerId(joinGameId);
    if (!existingPlayerId) return;

    fetchGameState({ gameId: joinGameId, playerId: existingPlayerId })
      .then(() => router.push(`/game/${joinGameId}`))
      .catch(() => {});
  }, [joinGameId, router]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { playerId } = await joinGame(joinGameId, inviteToken, playerName);
      setRecentPlayerName(playerName);

      // We don’t know the full game metadata yet; it will be fetched on the game page.
      upsertPlayerGame({
        id: joinGameId,
        name: joinGameId,
        createdBy: '',
        createdById: '',
        playerId,
        joinToken: inviteToken,
      });

      router.push(`/game/${joinGameId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to join session');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full">
      <form onSubmit={handleSubmit} className="w-full flex justify-center">
        <Card className="w-full max-w-lg">
          <CardHeader className="text-center">
            <CardTitle>Join a Session</CardTitle>
          </CardHeader>
          <CardContent>
            <FieldGroup className="gap-5">
              <Field>
                <FieldLabel htmlFor="sessionId">Session ID</FieldLabel>
                <Input
                  id="sessionId"
                  required
                  type="text"
                  placeholder="UUID…"
                  value={joinGameId}
                  onChange={(e) => setJoinGameId(e.target.value)}
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="inviteToken">Invite token</FieldLabel>
                <Input
                  id="inviteToken"
                  required
                  type="text"
                  placeholder="Paste the token from the invite link"
                  value={inviteToken}
                  onChange={(e) => setInviteToken(e.target.value)}
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="playerName">Your Name</FieldLabel>
                <Input
                  id="playerName"
                  required
                  type="text"
                  placeholder="Enter your name"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                />
              </Field>

              {error && <p className="text-destructive text-xs">{error}</p>}
            </FieldGroup>
          </CardContent>
          <CardFooter className="justify-end">
            <Button type="submit" disabled={loading}>
              {loading ? 'Joining…' : 'Join'}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}
