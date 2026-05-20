import { parsePhoneNumber, isValidPhoneNumber, AsYouType, CountryCode } from 'libphonenumber-js';

export class PhoneValidator {
  /**
   * Parses and formats a phone number to E.164 format.
   * @param phoneNumber The raw phone number string.
   * @param countryCode The country code (e.g., 'KZ' for Kazakhstan).
   * @returns E.164 formatted number (e.g., '+77771234567') or null if invalid.
   */
  public static parseAndFormat(phoneNumber: string, countryCode: CountryCode): string | null {
    try {
      const cleanedNumber = this.cleanNumber(phoneNumber);
      const parsed = parsePhoneNumber(cleanedNumber, countryCode);
      if (parsed && parsed.isValid()) {
        return parsed.number; // Returns E.164 format
      }
    } catch (error) {
      // Invalid number format or country code
    }
    return null;
  }

  /**
   * Checks if a phone number is valid for a given country.
   * @param phoneNumber The raw phone number string.
   * @param countryCode The country code.
   * @returns True if valid, false otherwise.
   */
  public static isValid(phoneNumber: string, countryCode: CountryCode): boolean {
    return isValidPhoneNumber(phoneNumber, countryCode);
  }

  /**
   * Formats a phone number as the user types.
   * @param phoneNumber The raw phone number string.
   * @param countryCode The country code.
   * @returns Formatted number.
   */
  public static asYouType(phoneNumber: string, countryCode: CountryCode): string {
    return new AsYouType(countryCode).input(phoneNumber);
  }

  /**
   * Cleans a phone number string, removing non-digit characters except '+' at the beginning.
   * @param phoneNumber The raw phone number string.
   * @returns Cleaned number.
   */
  public static cleanNumber(phoneNumber: string): string {
    const hasPlus = phoneNumber.startsWith('+');
    let cleaned = phoneNumber.replace(/\D/g, '');
    if (hasPlus) {
      return '+' + cleaned;
    }
    return cleaned;
  }
}
