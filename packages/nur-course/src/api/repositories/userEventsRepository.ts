import { Database } from 'bun:sqlite';

interface AnalyticsData {
  userId: string;
  pageName: string;
  pageVariant: string;
  timeSpent_sec: number;
  scrollDepth_perc: number;
  finalAction: string;
  navigationPath: any;
  sectionViewTimes: any;
  deviceInfo: any; // Новое поле
}

export class UserEventsRepository {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  public save(data: AnalyticsData): void {
    const stmt = this.db.prepare(`
      INSERT INTO user_events (
          received_at,
          user_id,
          page_name,
          page_variant,
          time_spent_sec,
          scroll_depth_perc,
          final_action,
          navigation_path,
          section_view_times,
          device_info
      ) VALUES (
          datetime('now'),
          @userId,
          @pageName,
          @pageVariant,
          @timeSpent_sec,
          @scrollDepth_perc,
          @finalAction,
          @navigationPath,
          @sectionViewTimes,
          @deviceInfo
      )
    `);

    stmt.run({
      "@userId": data.userId,
      "@pageName": data.pageName,
      "@pageVariant": data.pageVariant,
      "@timeSpent_sec": data.timeSpent_sec,
      "@scrollDepth_perc": data.scrollDepth_perc,
      "@finalAction": data.finalAction,
      "@navigationPath": JSON.stringify(data.navigationPath || []),
      "@sectionViewTimes": JSON.stringify(data.sectionViewTimes || {}),
      "@deviceInfo": JSON.stringify(data.deviceInfo || {}) // Новое поле
    });
  }

  public count(): number {
    const result = this.db.prepare('SELECT COUNT(*) as count FROM user_events').get() as { count: number };
    return result.count;
  }

  public getLatest(limit: number = 10): any[] {
    return this.db.prepare(`SELECT * FROM user_events ORDER BY received_at DESC LIMIT ?`).all(limit);
  }

  public getFilteredEvents(filters: { userId?: string; pageName?: string; limit?: number }): any[] {
    let query = 'SELECT * FROM user_events WHERE 1=1';
    const params: any[] = [];

    if (filters.userId) {
      query += ' AND user_id = ?';
      params.push(filters.userId);
    }

    if (filters.pageName) {
      query += ' AND page_name = ?';
      params.push(filters.pageName);
    }

    query += ' ORDER BY received_at DESC LIMIT ?';
    params.push(filters.limit || 10);

    return this.db.prepare(query).all(...params);
  }
}
