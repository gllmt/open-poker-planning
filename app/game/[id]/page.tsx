import { Poker } from '@/components/poker/poker';

export default function GamePage({ params }: { params: { id: string } }) {
  return (
    <div className='px-2'>
      <Poker gameId={params.id} />
    </div>
  );
}

