import { Database } from 'bun:sqlite';
import { UserEventsRepository } from '../repositories/userEventsRepository'; // New import

export async function saveAnalyticsData(db: Database, data: any) {
  const repo = new UserEventsRepository(db);
  repo.save(data);
}
