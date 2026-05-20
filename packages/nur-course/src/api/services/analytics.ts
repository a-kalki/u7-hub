import { Database } from 'bun:sqlite';
import { UserEventsRepository } from '@u7-hub/core/repositories/userEventsRepository';

export async function saveAnalyticsData(db: Database, data: any) {
  const repo = new UserEventsRepository(db);
  repo.save(data);
}
