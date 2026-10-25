export class UtilityService {
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
}
