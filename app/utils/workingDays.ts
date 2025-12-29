import { formatDateEST } from '~/utils'

export type WorkingDayOptions = {
  includeSunday?: boolean
  excludeSaturday?: boolean
}

const DEFAULT_TIMEZONE = 'America/New_York'

const normalizeToMidday = (date: Date) => {
  const d = new Date(date)
  d.setHours(12, 0, 0, 0)
  return d
}

const getWeekdayInTimeZone = (date: Date, timeZone: string) => {
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short'
  }).format(date)
}

export const isSunday = (date: Date) => {
  const weekday = getWeekdayInTimeZone(date, DEFAULT_TIMEZONE)
  return weekday === 'Sun'
}

export const isSaturday = (date: Date) => {
  const weekday = getWeekdayInTimeZone(date, DEFAULT_TIMEZONE)
  return weekday === 'Sat'
}

export const clampToPreviousWorkingDay = (date: Date) => {
  return clampToPreviousBusinessDay(date)
}

export const clampToPreviousBusinessDay = (
  date: Date,
  opts: WorkingDayOptions = {}
) => {
  const base = normalizeToMidday(date)
  const includeSunday = opts.includeSunday ?? false
  const excludeSaturday = opts.excludeSaturday ?? false

  const cursor = new Date(base)
  // Move backwards until the date matches the business-day rules
  while (true) {
    const isNonWorkingSunday = !includeSunday && isSunday(cursor)
    const isNonWorkingSaturday = excludeSaturday && isSaturday(cursor)

    if (!isNonWorkingSunday && !isNonWorkingSaturday) {
      return cursor
    }

    cursor.setDate(cursor.getDate() - 1)
  }
}

export const getWorkingDatesBetween = (
  start: Date,
  end: Date,
  opts: WorkingDayOptions = {}
): Date[] => {
  const includeSunday = opts.includeSunday ?? false
  const excludeSaturday = opts.excludeSaturday ?? false

  const startDay = normalizeToMidday(start)
  const endDay = normalizeToMidday(end)

  const dates: Date[] = []
  const cursor = new Date(startDay)

  while (cursor.getTime() <= endDay.getTime()) {
    const isNonWorkingSunday = !includeSunday && isSunday(cursor)
    const isNonWorkingSaturday = excludeSaturday && isSaturday(cursor)

    if (!isNonWorkingSunday && !isNonWorkingSaturday) {
      dates.push(new Date(cursor))
    }
    cursor.setDate(cursor.getDate() + 1)
  }

  return dates
}

export const getLastNWorkingDates = (
  endInclusive: Date,
  n: number,
  opts: WorkingDayOptions = {}
): Date[] => {
  const end = clampToPreviousBusinessDay(endInclusive, opts)

  const dates: Date[] = []
  const cursor = new Date(end)
  cursor.setHours(12, 0, 0, 0)

  const includeSunday = opts.includeSunday ?? false
  const excludeSaturday = opts.excludeSaturday ?? false

  while (dates.length < n) {
    const isNonWorkingSunday = !includeSunday && isSunday(cursor)
    const isNonWorkingSaturday = excludeSaturday && isSaturday(cursor)

    if (!isNonWorkingSunday && !isNonWorkingSaturday) {
      dates.push(new Date(cursor))
    }
    cursor.setDate(cursor.getDate() - 1)
  }

  return dates.reverse()
}

export const toDateStringsEST = (dates: Date[]): string[] => {
  return dates.map(d => formatDateEST(d))
}

export const splitIntoContiguousDateRanges = (dates: Date[]) => {
  if (!dates.length) return [] as Array<{ start: Date, end: Date }>

  const sorted = [...dates].sort((a, b) => a.getTime() - b.getTime())
  const ranges: Array<{ start: Date, end: Date }> = []

  let rangeStart = sorted[0]!
  let rangeEnd = sorted[0]!

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]!
    const cur = sorted[i]!

    const expectedNext = new Date(prev)
    expectedNext.setDate(expectedNext.getDate() + 1)

    if (cur.getTime() === expectedNext.getTime()) {
      rangeEnd = cur
    } else {
      ranges.push({ start: rangeStart, end: rangeEnd })
      rangeStart = cur
      rangeEnd = cur
    }
  }

  ranges.push({ start: rangeStart, end: rangeEnd })
  return ranges
}

export const getPreviousWorkingDatesForComparison = (currentWorkingDates: Date[]): Date[] => {
  if (!currentWorkingDates.length) return []

  const earliest = currentWorkingDates[0]!
  const previousEnd = new Date(earliest)
  previousEnd.setDate(previousEnd.getDate() - 1)

  return getLastNWorkingDates(previousEnd, currentWorkingDates.length)
}

export const getPreviousBusinessDatesForComparison = (
  currentBusinessDates: Date[],
  opts: WorkingDayOptions = {}
): Date[] => {
  if (!currentBusinessDates.length) return []

  const earliest = currentBusinessDates[0]!
  const previousEnd = new Date(earliest)
  previousEnd.setDate(previousEnd.getDate() - 1)

  return getLastNWorkingDates(previousEnd, currentBusinessDates.length, opts)
}
