import { addBusinessDays, addCalendarDays } from './tcm'

// Reference dates (local timezone UTC-7, verified day-of-week):
// '2026-05-23' = Friday  (locally)
// '2026-05-24' = Saturday (locally)
// '2026-05-26' = Monday  (locally)
// ISO date strings are parsed as UTC midnight; getDay() uses local time.

describe('addBusinessDays — advances date by N business days, skipping Saturday and Sunday', () => {
  it('adds 2 business days from Monday — no weekend crossed', () => {
    // 2026-05-26 (Monday locally) + 2 business days = 2026-05-28 (Wednesday)
    expect(addBusinessDays('2026-05-26', 2)).toBe('2026-05-28')
  })
  it('adds 1 business day from Friday — skips Saturday, lands on Monday', () => {
    // 2026-05-23 (Friday locally) + 1 business day — Sat is skipped → 2026-05-26 (Monday)
    expect(addBusinessDays('2026-05-23', 1)).toBe('2026-05-26')
  })
  it('adds 2 business days from Friday — skips Saturday and Sunday, lands on Tuesday', () => {
    // 2026-05-23 (Friday locally) + 2 business days — Sat+Sun skipped → 2026-05-27 (Tuesday)
    expect(addBusinessDays('2026-05-23', 2)).toBe('2026-05-27')
  })
  it('adds 1 business day from Saturday — skips Sunday, lands on Monday', () => {
    // 2026-05-24 (Saturday locally) + 1 business day — Sun is skipped → 2026-05-26 (Monday)
    expect(addBusinessDays('2026-05-24', 1)).toBe('2026-05-26')
  })
  it('adds 0 business days — returns same date unchanged', () => {
    // Loop does not execute; date returned as-is
    expect(addBusinessDays('2026-05-26', 0)).toBe('2026-05-26')
  })
})

describe('addCalendarDays — advances date by N calendar days including weekends', () => {
  it('adds 3 calendar days from Monday — simple weekday arithmetic', () => {
    // 2026-05-26 (Monday locally) + 3 = 2026-05-29 (Thursday)
    expect(addCalendarDays('2026-05-26', 3)).toBe('2026-05-29')
  })
  it('adds 3 calendar days from Friday — crosses weekend, Saturday and Sunday count', () => {
    // 2026-05-23 (Friday locally) + 3 calendar days = 2026-05-26 (Monday)
    expect(addCalendarDays('2026-05-23', 3)).toBe('2026-05-26')
  })
  it('adds 3 calendar days crossing a month boundary', () => {
    // 2026-05-30 + 3 = 2026-06-02
    expect(addCalendarDays('2026-05-30', 3)).toBe('2026-06-02')
  })
  it('subtracts days when days is negative', () => {
    // 2026-05-26 - 3 = 2026-05-23
    expect(addCalendarDays('2026-05-26', -3)).toBe('2026-05-23')
  })
})
