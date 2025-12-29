import { formatDateEST } from '~/utils'
import { splitIntoContiguousDateRanges } from '~/utils/workingDays'

export type DateRange = { start: Date, end: Date }

export type SupabaseChunkFetcher<T> = (range: {
  dateFrom: string
  dateTo: string
  limit?: number
  offset?: number
}) => Promise<{ data: T[] | null, error: any, count?: number | null }>

export const fetchByContiguousRanges = async <T>(
  dates: Date[],
  fetcher: SupabaseChunkFetcher<T>,
  opts?: { pageSize?: number }
) => {
  const ranges = splitIntoContiguousDateRanges(dates)
  const pageSize = opts?.pageSize ?? 10000

  const all: T[] = []

  for (const r of ranges) {
    const dateFrom = formatDateEST(r.start)
    const dateTo = formatDateEST(r.end)

    const { data, error } = await fetcher({
      dateFrom,
      dateTo,
      limit: pageSize,
      offset: 0
    })

    if (error) {
      return { data: null as T[] | null, error }
    }

    if (data?.length) {
      all.push(...data)
    }
  }

  return { data: all, error: null }
}
