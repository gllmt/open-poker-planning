'use client';

import { useRouter } from 'next/navigation';

import { getPlayerGamesFromCache } from '@/lib/browser-storage';

export function RecentGames() {
  const router = useRouter();
  const recentGames = getPlayerGamesFromCache();

  if (!recentGames.length) {
    return (
      <div className='border border-gray-400 rounded-md shadow-sm p-4 w-full'>
        <h3 className='text-lg font-medium mb-2'>Recent sessions</h3>
        <p className='text-sm'>No recent sessions found</p>
      </div>
    );
  }

  return (
    <div className='border border-gray-400 rounded-md shadow-sm w-full'>
      <div className='text-center -mt-5 mx-auto w-[95%] border-2 bg-white dark:bg-gray-800 border-gray-400 rounded-2xl flex items-center justify-center px-3 py-1'>
        <h3 className='text-lg font-medium truncate'>Recent sessions</h3>
      </div>
      <div className='p-4'>
        <div className='overflow-x-auto' style={{ maxHeight: 250 }}>
          <table className='min-w-full divide-y divide-gray-200'>
            <thead className='bg-gray-50 dark:bg-gray-900'>
              <tr>
                <th className='px-6 py-3 text-left text-xs font-bold tracking-wider'>Name</th>
                <th className='px-6 py-3 text-left text-xs font-bold tracking-wider'>Created By</th>
              </tr>
            </thead>
            <tbody>
              {recentGames.map((g) => (
                <tr
                  key={g.id}
                  className='hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer border-t border-gray-200'
                  onClick={() => router.push(`/game/${g.id}`)}
                >
                  <td className='px-6 py-4 text-sm'>{g.name}</td>
                  <td className='px-6 py-4 text-sm'>{g.createdBy || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
