import { Poker } from '@/components/poker/poker';

export default async function GamePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div className="px-2">
      <Poker gameId={id} />
    </div>
  );
}
