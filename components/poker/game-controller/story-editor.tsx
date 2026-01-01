import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { updateStory } from '@/lib/api/games';

export function StoryEditor({
  gameId,
  playerId,
  storyName,
}: {
  gameId: string;
  playerId: string;
  storyName: string;
}) {
  const serverStoryName = storyName ?? '';
  const storyInputRef = useRef<HTMLInputElement>(null);
  const storyEditInitialRef = useRef<string>(serverStoryName);

  const [isEditingStory, setIsEditingStory] = useState(false);
  const [storyDraft, setStoryDraft] = useState(serverStoryName);
  const [storySaving, setStorySaving] = useState(false);
  const [storyError, setStoryError] = useState<string | null>(null);
  const [storyPendingSync, setStoryPendingSync] = useState(false);

  const storyIsDirty =
    isEditingStory && storyDraft.trim() !== storyEditInitialRef.current.trim();

  useEffect(() => {
    if (isEditingStory) return;

    // If we just saved locally, keep the optimistic value until the refreshed game state catches up.
    if (storyPendingSync) {
      if (serverStoryName === storyDraft) setStoryPendingSync(false);
      return;
    }

    if (serverStoryName !== storyDraft) setStoryDraft(serverStoryName);
  }, [serverStoryName, storyDraft, isEditingStory, storyPendingSync]);

  useEffect(() => {
    if (!isEditingStory) return;
    storyInputRef.current?.focus();
    storyInputRef.current?.select();
  }, [isEditingStory]);

  const startStoryEdit = () => {
    storyEditInitialRef.current = storyDraft;
    setStoryError(null);
    setIsEditingStory(true);
  };

  const cancelStoryEdit = () => {
    setStoryDraft(storyEditInitialRef.current);
    setStoryError(null);
    setIsEditingStory(false);
  };

  const saveStoryEdit = async () => {
    if (storySaving) return;

    const nextValue = storyDraft.trim();
    if (nextValue === storyEditInitialRef.current.trim()) {
      setStoryError(null);
      setIsEditingStory(false);
      return;
    }

    setStorySaving(true);
    setStoryError(null);
    try {
      await updateStory(gameId, nextValue, playerId);
      setStoryDraft(nextValue);
      storyEditInitialRef.current = nextValue;
      setStoryPendingSync(true);
      setIsEditingStory(false);
    } catch (e) {
      setStoryError(e instanceof Error ? e.message : 'Failed to update story');
    } finally {
      setStorySaving(false);
    }
  };

  return (
    <div className="w-full text-xs mt-2">
      <div className="flex items-center justify-between gap-2">
        <label className="font-semibold" htmlFor="storyName">
          Story Name:
        </label>

        {!isEditingStory ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={startStoryEdit}
          >
            Edit
          </Button>
        ) : (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={cancelStoryEdit}
              disabled={storySaving}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={saveStoryEdit}
              disabled={storySaving || !storyIsDirty}
            >
              {storySaving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        )}
      </div>
      <Input
        id="storyName"
        ref={storyInputRef}
        placeholder="Enter story name or number"
        className="italic mt-2"
        type="text"
        value={storyDraft}
        readOnly={!isEditingStory}
        aria-readonly={!isEditingStory}
        onChange={(e) => setStoryDraft(e.target.value)}
        onKeyDown={(e) => {
          if (!isEditingStory) return;
          if (e.key === 'Enter') {
            e.preventDefault();
            void saveStoryEdit();
            return;
          }
          if (e.key === 'Escape') {
            e.preventDefault();
            cancelStoryEdit();
          }
        }}
      />
      {storyError && (
        <p className="text-destructive text-xs mt-2">{storyError}</p>
      )}
    </div>
  );
}
