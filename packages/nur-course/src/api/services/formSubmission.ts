import { Database } from 'bun:sqlite';
import { FormSubmissionsRepository } from '../repositories/formSubmissionsRepository';

export async function saveFormData(db: Database, formData: any) {
  // Basic validation
  if (!formData.name || !formData.phone) {
    throw new Error('Имя и телефон являются обязательными полями.');
  }

  const repo = new FormSubmissionsRepository(db);

  // Helper function to stringify arrays, otherwise return as is
  const prepareValue = (value: any) => {
    if (Array.isArray(value)) {
      return JSON.stringify(value);
    }
    return value;
  };

  repo.save({
    userId: formData.userId,
    name: formData.name,
    phone: formData.phone,
    contactMethod: prepareValue(formData.contactMethod),
    howFoundUs: prepareValue(formData.howFoundUs),
    whyInterested: prepareValue(formData.whyInterested),
    programmingExperience: prepareValue(formData.programmingExperience),
    languageInterest: prepareValue(formData.languageInterest),
    learningFormat: prepareValue(formData.learningFormat),
    preferredDay: prepareValue(formData.preferredDay),
    preferredTime: prepareValue(formData.preferredTime)
  });
}
