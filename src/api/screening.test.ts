import { scorePHQ9, scoreGAD7 } from './screening'

describe('scorePHQ9', () => {
  it('none: score 0 (minimum)', () => {
    expect(scorePHQ9([0, 0, 0, 0, 0, 0, 0, 0, 0])).toEqual({ score: 0, severity: 'none' })
  })
  it('none: score 4 (upper boundary)', () => {
    expect(scorePHQ9([0, 1, 1, 1, 1, 0, 0, 0, 0])).toEqual({ score: 4, severity: 'none' })
  })
  it('mild: score 5 (lower boundary)', () => {
    expect(scorePHQ9([1, 1, 1, 1, 1, 0, 0, 0, 0])).toEqual({ score: 5, severity: 'mild' })
  })
  it('mild: score 9 (upper boundary)', () => {
    expect(scorePHQ9([1, 1, 1, 1, 1, 1, 1, 1, 1])).toEqual({ score: 9, severity: 'mild' })
  })
  it('moderate: score 10 (lower boundary)', () => {
    expect(scorePHQ9([2, 2, 2, 1, 1, 1, 1, 0, 0])).toEqual({ score: 10, severity: 'moderate' })
  })
  it('moderate: score 14 (upper boundary)', () => {
    expect(scorePHQ9([2, 2, 2, 2, 2, 2, 2, 0, 0])).toEqual({ score: 14, severity: 'moderate' })
  })
  it('moderately_severe: score 15 (lower boundary)', () => {
    expect(scorePHQ9([3, 2, 2, 2, 2, 2, 2, 0, 0])).toEqual({ score: 15, severity: 'moderately_severe' })
  })
  it('moderately_severe: score 19 (upper boundary)', () => {
    expect(scorePHQ9([3, 3, 3, 3, 3, 2, 2, 0, 0])).toEqual({ score: 19, severity: 'moderately_severe' })
  })
  it('severe: score 20 (lower boundary)', () => {
    expect(scorePHQ9([3, 3, 3, 3, 3, 3, 2, 0, 0])).toEqual({ score: 20, severity: 'severe' })
  })
  it('severe: score 27 (maximum — all 3s)', () => {
    expect(scorePHQ9([3, 3, 3, 3, 3, 3, 3, 3, 3])).toEqual({ score: 27, severity: 'severe' })
  })
})

describe('scoreGAD7', () => {
  it('none: score 0 (minimum)', () => {
    expect(scoreGAD7([0, 0, 0, 0, 0, 0, 0])).toEqual({ score: 0, severity: 'none' })
  })
  it('none: score 4 (upper boundary)', () => {
    expect(scoreGAD7([1, 1, 1, 1, 0, 0, 0])).toEqual({ score: 4, severity: 'none' })
  })
  it('mild: score 5 (lower boundary)', () => {
    expect(scoreGAD7([1, 1, 1, 1, 1, 0, 0])).toEqual({ score: 5, severity: 'mild' })
  })
  it('mild: score 9 (upper boundary)', () => {
    expect(scoreGAD7([2, 2, 2, 1, 1, 1, 0])).toEqual({ score: 9, severity: 'mild' })
  })
  it('moderate: score 10 (lower boundary)', () => {
    expect(scoreGAD7([2, 2, 2, 2, 1, 1, 0])).toEqual({ score: 10, severity: 'moderate' })
  })
  it('moderate: score 14 (upper boundary)', () => {
    expect(scoreGAD7([2, 2, 2, 2, 2, 2, 2])).toEqual({ score: 14, severity: 'moderate' })
  })
  it('severe: score 15 (lower boundary)', () => {
    expect(scoreGAD7([3, 2, 2, 2, 2, 2, 2])).toEqual({ score: 15, severity: 'severe' })
  })
  it('severe: score 21 (maximum — all 3s)', () => {
    expect(scoreGAD7([3, 3, 3, 3, 3, 3, 3])).toEqual({ score: 21, severity: 'severe' })
  })
})
