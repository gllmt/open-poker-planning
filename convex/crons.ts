import { cronJobs } from 'convex/server';
import { internal } from './_generated/api';

const crons = cronJobs();
crons.daily(
  'purge inactive games',
  { hourUTC: 3, minuteUTC: 17 },
  internal.retention.purgeInactiveGames,
  {}
);
export default crons;
