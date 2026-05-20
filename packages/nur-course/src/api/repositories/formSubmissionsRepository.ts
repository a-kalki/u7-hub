import { Database } from 'bun:sqlite';

export class FormSubmissionsRepository {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  public save(formData: {
    userId: string;
    name: string;
    phone: string;
    contactMethod: string;
    howFoundUs: string;
    whyInterested: string;
    programmingExperience: string;
    languageInterest: string;
    learningFormat: string;
    preferredDay: string;
    preferredTime: string;
  }): void {
    const stmt = this.db.prepare(`
      INSERT INTO form_submissions (
          submitted_at,
          user_id,
          name,
          phone,
          contact_method,
          how_found_us,
          why_interested,
          programming_experience,
          language_interest,
          learning_format,
          preferred_day,
          preferred_time
      ) VALUES (
          datetime('now'),
          @userId,
          @name,
          @phone,
          @contactMethod,
          @howFoundUs,
          @whyInterested,
          @programmingExperience,
          @languageInterest,
          @learningFormat,
          @preferredDay,
          @preferredTime
      )
    `);

    stmt.run({
      "@userId": formData.userId,
      "@name": formData.name,
      "@phone": formData.phone,
      "@contactMethod": formData.contactMethod,
      "@howFoundUs": formData.howFoundUs,
      "@whyInterested": formData.whyInterested,
      "@programmingExperience": formData.programmingExperience,
      "@languageInterest": formData.languageInterest,
      "@learningFormat": formData.learningFormat,
      "@preferredDay": formData.preferredDay,
      "@preferredTime": formData.preferredTime
    });
  }

  public count(): number {
    const result = this.db.prepare('SELECT COUNT(*) as count FROM form_submissions').get() as { count: number };
    return result.count;
  }

  public getLatest(limit: number = 10): any[] {
    return this.db.prepare(`SELECT * FROM form_submissions ORDER BY submitted_at DESC LIMIT ?`).all(limit);
  }

  public getFilteredSubmissions(filters: { userId?: string; date?: string; limit?: number }): any[] {
    let query = 'SELECT * FROM form_submissions WHERE 1=1';
    const params: any[] = [];

    if (filters.userId) {
      query += ' AND user_id = ?';
      params.push(filters.userId);
    }

    if (filters.date) {
      query += ' AND DATE(submitted_at) = ?';
      params.push(filters.date);
    }

    query += ' ORDER BY submitted_at DESC LIMIT ?';
    params.push(filters.limit || 10);

    return this.db.prepare(query).all(...params);
  }
}
