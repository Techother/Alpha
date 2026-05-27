import { cpt99454Met, cpt99457Met, cpt99458Count } from './billing'

describe('cpt99454Met — RPM check-in days qualification (threshold: 16 days)', () => {
  it('false when checkin days = 15 (below threshold)', () => {
    expect(cpt99454Met(15)).toBe(false)
  })
  it('true when checkin days = 16 (exactly at threshold)', () => {
    expect(cpt99454Met(16)).toBe(true)
  })
  it('true when checkin days = 20 (above threshold)', () => {
    expect(cpt99454Met(20)).toBe(true)
  })
})

describe('cpt99457Met — RPM time qualification (threshold: 20 minutes)', () => {
  it('false when rpm minutes = 19 (below threshold)', () => {
    expect(cpt99457Met(19)).toBe(false)
  })
  it('true when rpm minutes = 20 (exactly at threshold)', () => {
    expect(cpt99457Met(20)).toBe(true)
  })
  it('true when rpm minutes = 45 (above threshold)', () => {
    expect(cpt99457Met(45)).toBe(true)
  })
})

describe('cpt99458Count — additional RPM time units (each additional 20 min after first 20)', () => {
  it('0 when not qualifying (< 20 minutes)', () => {
    expect(cpt99458Count(19)).toBe(0)
  })
  it('0 add-ons when exactly 20 minutes (qualifying, no additional units)', () => {
    expect(cpt99458Count(20)).toBe(0)
  })
  it('0 add-ons when 39 minutes (qualifying, not enough for 1 additional unit)', () => {
    expect(cpt99458Count(39)).toBe(0)
  })
  it('1 add-on when 40 minutes', () => {
    expect(cpt99458Count(40)).toBe(1)
  })
  it('2 add-ons when 60 minutes', () => {
    expect(cpt99458Count(60)).toBe(2)
  })
  it('caps at 2 add-ons when 80 minutes (CMS limit — floor would be 3)', () => {
    expect(cpt99458Count(80)).toBe(2)
  })
  it('caps at 2 add-ons when 100 minutes (CMS limit — floor would be 4)', () => {
    expect(cpt99458Count(100)).toBe(2)
  })
})
