import { addBusinessDays, addCalendarDays } from './tcm'

// Reference dates (UTC day-of-week, verified):
// '2026-05-22' = Friday    (UTC)
// '2026-05-23' = Saturday  (UTC)
// '2026-05-25' = Monday    (UTC)
// '2026-05-26' = Tuesday   (UTC)
// '2026-05-27' = Wednesday (UTC)
// '2026-05-28' = Thursday  (UTC)
// '2026-05-30' = Saturday  (UTC)
// '2026-06-02' = Tuesday   (UTC)
// All date arithmetic uses UTC methods; test block pins TZ=UTC via vite.config.ts.

describe('addBusinessDays — advances date by N business days, skipping Saturday and Sunday', () => {
  it('adds 2 business days from Monday — no weekend crossed', () => {
    // 2026-05-25 (Monday UTC) + 2 business days = 2026-05-27 (Wednesday)
    expect(addBusinessDays('2026-05-25', 2)).toBe('2026-05-27')
  })
  it('adds 1 business day from Friday — skips Saturday, lands on Monday', () => {
    // 2026-05-22 (Friday UTC) + 1 business day — Sat skipped → 2026-05-25 (Monday)
    expect(addBusinessDays('2026-05-22', 1)).toBe('2026-05-25')
  })
  it('adds 2 business days from Friday — skips Saturday and Sunday, lands on Tuesday', () => {
    // 2026-05-22 (Friday UTC) + 2 business days — Sat+Sun skipped → 2026-05-26 (Tuesday)
    expect(addBusinessDays('2026-05-22', 2)).toBe('2026-05-26')
  })
  it('adds 1 business day from Saturday — skips Sunday, lands on Monday', () => {
    // 2026-05-23 (Saturday UTC) + 1 business day — Sun skipped → 2026-05-25 (Monday)
    expect(addBusinessDays('2026-05-23', 1)).toBe('2026-05-25')
  })
  it('adds 0 business days — returns same date unchanged', () => {
    // Loop does not execute; date returned as-is
    expect(addBusinessDays('2026-05-26', 0)).toBe('2026-05-26')
  })
})

describe('addCalendarDays — advances date by N calendar days including weekends', () => {
  it('adds 3 calendar days from Monday — simple weekday arithmetic', () => {
    // 2026-05-25 (Monday UTC) + 3 = 2026-05-28 (Thursday)
    expect(addCalendarDays('2026-05-25', 3)).toBe('2026-05-28')
  })
  it('adds 3 calendar days from Friday — crosses weekend, Saturday and Sunday count', () => {
    // 2026-05-22 (Friday UTC) + 3 calendar days = 2026-05-25 (Monday)
    expect(addCalendarDays('2026-05-22', 3)).toBe('2026-05-25')
  })
  it('adds 3 calendar days crossing a month boundary', () => {
    // 2026-05-30 (Saturday UTC) + 3 = 2026-06-02 (Tuesday)
    expect(addCalendarDays('2026-05-30', 3)).toBe('2026-06-02')
  })
  it('subtracts days when days is negative', () => {
    // 2026-05-25 (Monday UTC) - 3 = 2026-05-22 (Friday)
    expect(addCalendarDays('2026-05-25', -3)).toBe('2026-05-22')
  })
})
