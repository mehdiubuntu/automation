export class UtilityService {
  // stringify transformer for database
  static readonly to = (value?: unknown): string | null => {
    if (value === undefined || value === null) {
      return null
    }
    return JSON.stringify(value)
  }

  // stringify transformer for database
  static readonly from = (value?: string | null): string | null => {
    if (!value) {
      return null
    }

    try {
      return JSON.parse(value)
    } catch {
      return null
    }
  }

  // bigint column transformer: TypeORM reads bigint as string; national codes / deposit
  // numbers are <= 10 digits (well within Number.MAX_SAFE_INTEGER) so Number() is lossless.
  static readonly bigintTransformer = {
    to: (value?: number | null): number | null => (value === undefined || value === null ? null : value),
    from: (value?: string | null): number | null => (value === undefined || value === null ? null : Number(value)),
  }

  static parseDateToUTC(dateStr: string): Date {
    const [year, month, day] = dateStr.split('-').map(Number)
    return new Date(Date.UTC(year, month - 1, day))
  }

  static formatUTCDate(date: Date): string {
    return date.toISOString().slice(0, 10)
  }

  static toIranStartOfDayUtcDate(input: string | Date): Date {
    const date = new Date(input)

    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Tehran',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })

    const iranDate = formatter.format(date) // YYYY-MM-DD
    const [year, month, day] = iranDate.split('-').map(Number)
    return new Date(Date.UTC(year, month - 1, day))
  }
  static removeNationalCodeZeroFromStart = (nationalCode: string) => nationalCode.replace(/^0+/, '')

  /**
   * 🗓️ Convert a Gregorian date to a numeric Jalali (Persian calendar) date (YYYYMMDD)
   */
  static convertToPersianDateNumeric(dateStr: string): string {
    if (!dateStr) return ''

    const normalized = dateStr.replace('IRDT', '+00:00').replace('IRST', '+00:00')

    const date = new Date(normalized)
    if (isNaN(date.getTime())) return ''

    return new Intl.DateTimeFormat('fa-IR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      numberingSystem: 'latn',
    })
      .format(date)
      .replaceAll('/', '')
  }
}
