'use client';

import { useRouter } from 'next/navigation';
import { type FormEvent, useEffect, useReducer } from 'react';
import { sileo } from 'sileo';

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
import { clearGameSession, joinGame } from '@/lib/api/games';
import {
  clearPlayerGameSession,
  getRecentPlayerName,
  setRecentPlayerName,
  upsertPlayerGame,
} from '@/lib/browser-storage';
import { withLocale } from '@/lib/i18n/paths';

type JoinGameState = {
  joinGameId: string;
  inviteToken: string;
  playerName: string;
  error: string | null;
  loading: boolean;
};

type JoinGameAction =
  | { type: 'set-join-game-id'; value: string }
  | { type: 'set-invite-token'; value: string }
  | { type: 'set-player-name'; value: string }
  | { type: 'set-error'; value: string | null }
  | { type: 'set-loading'; value: boolean };

function initJoinGameState({
  initialGameId,
  initialInviteToken,
}: {
  initialGameId?: string;
  initialInviteToken?: string;
}): JoinGameState {
  return {
    joinGameId: initialGameId ?? '',
    inviteToken: initialInviteToken ?? '',
    playerName: '',
    error: null,
    loading: false,
  };
}

function joinGameReducer(
  state: JoinGameState,
  action: JoinGameAction
): JoinGameState {
  switch (action.type) {
    case 'set-join-game-id':
      return { ...state, joinGameId: action.value };
    case 'set-invite-token':
      return { ...state, inviteToken: action.value };
    case 'set-player-name':
      return { ...state, playerName: action.value };
    case 'set-error':
      return { ...state, error: action.value };
    case 'set-loading':
      return { ...state, loading: action.value };
    default:
      return state;
  }
}

export function JoinGame({
  initialGameId,
  initialInviteToken,
  initialReason,
}: {
  initialGameId?: string;
  initialInviteToken?: string;
  initialReason?: 'left' | 'missing-session' | 'removed';
}) {
  const router = useRouter();
  const { locale, t } = useI18n();
  const [state, dispatch] = useReducer(
    joinGameReducer,
    { initialGameId, initialInviteToken },
    initJoinGameState
  );

  useEffect(() => {
    const recent = getRecentPlayerName();
    if (recent && !state.playerName) {
      dispatch({ type: 'set-player-name', value: recent });
    }
  }, [state.playerName]);

  useEffect(() => {
    if (!initialGameId || !initialReason) return;

    clearPlayerGameSession(initialGameId);
    void clearGameSession(initialGameId).catch(() => {});

    const titleByReason = {
      left: t('joinGame.leftSession'),
      'missing-session': t('joinGame.sessionExpired'),
      removed: t('joinGame.removedFromGame'),
    } satisfies Record<typeof initialReason, string>;

    sileo.info({
      title: titleByReason[initialReason],
      position: 'top-center',
    });
  }, [initialGameId, initialReason, t]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    dispatch({ type: 'set-error', value: null });
    dispatch({ type: 'set-loading', value: true });
    try {
      const { playerId, playerTokenHash, joinTokenHash } = await joinGame(
        state.joinGameId,
        state.inviteToken,
        state.playerName
      );
      setRecentPlayerName(state.playerName);

      // We don't know the full game metadata yet; it will be fetched on the game page.
      upsertPlayerGame({
        id: state.joinGameId,
        name: state.joinGameId,
        createdBy: '',
        createdById: '',
        playerId,
        joinToken: state.inviteToken,
        joinTokenHash,
        playerTokenHash,
      });

      router.push(withLocale(`/game/${state.joinGameId}`, locale));
    } catch (e) {
      dispatch({
        type: 'set-error',
        value: e instanceof Error ? e.message : t('joinGame.errorJoinFailed'),
      });
    } finally {
      dispatch({ type: 'set-loading', value: false });
    }
  };

  return (
    <div className="w-full">
      <form onSubmit={handleSubmit} className="w-full flex justify-center">
        <Card className="w-full max-w-lg">
          <CardHeader className="text-center">
            <CardTitle>{t('joinGame.title')}</CardTitle>
          </CardHeader>
          <CardContent>
            <FieldGroup className="gap-5">
              <Field>
                <FieldLabel htmlFor="sessionId">
                  {t('joinGame.sessionId')}
                </FieldLabel>
                <Input
                  id="sessionId"
                  required
                  type="text"
                  placeholder={t('joinGame.sessionIdPlaceholder')}
                  value={state.joinGameId}
                  onChange={(event) =>
                    dispatch({
                      type: 'set-join-game-id',
                      value: event.target.value,
                    })
                  }
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="inviteToken">
                  {t('joinGame.inviteToken')}
                </FieldLabel>
                <Input
                  id="inviteToken"
                  required
                  type="text"
                  placeholder={t('joinGame.inviteTokenPlaceholder')}
                  value={state.inviteToken}
                  onChange={(event) =>
                    dispatch({
                      type: 'set-invite-token',
                      value: event.target.value,
                    })
                  }
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="playerName">
                  {t('joinGame.yourName')}
                </FieldLabel>
                <Input
                  id="playerName"
                  required
                  type="text"
                  placeholder={t('joinGame.yourNamePlaceholder')}
                  value={state.playerName}
                  onChange={(event) =>
                    dispatch({
                      type: 'set-player-name',
                      value: event.target.value,
                    })
                  }
                />
              </Field>

              {state.error && (
                <p className="text-destructive text-xs">{state.error}</p>
              )}
            </FieldGroup>
          </CardContent>
          <CardFooter className="justify-end">
            <Button type="submit" disabled={state.loading}>
              {state.loading ? t('common.joining') : t('common.join')}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}
