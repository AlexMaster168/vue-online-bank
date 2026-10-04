import { describe, expect, it } from 'vitest'
import {
  accountOf,
  cents,
  contribute,
  csvCell,
  demoBank,
  emptyBank,
  parseBank,
  transfer,
} from './domain'

describe('money validation', () => {
  it('uses integer cents without floating point drift', () => {
    expect(cents(0.29)).toBe(29)
    expect(cents(1234.56)).toBe(123456)
  })
  it.each([0, -1, NaN, Infinity, 1.001, 100000001])('rejects invalid amount %s', (value) =>
    expect(() => cents(value)).toThrow(),
  )
})
describe('ledger transfers', () => {
  const input = { id: 'test', from: 'daily', recipient: 'Клієнт', amount: 500, note: 'Тест' }
  it('debits and credits atomically, preserving total and adding paired ledger entries', () => {
    const data = demoBank()
    const before = data.accounts.reduce((n, a) => n + a.balance, 0)
    transfer(data, { ...input, to: 'reserve' })
    expect(data.accounts.reduce((n, a) => n + a.balance, 0)).toBe(before)
    expect(data.transactions[0].amount).toBe(50000)
    expect(data.transactions[1].amount).toBe(-50000)
    expect(data.transactions[0].category).toBe('Між рахунками')
  })
  it('writes one debit for an external recipient', () => {
    const data = demoBank()
    const before = data.accounts[0].balance
    transfer(data, input)
    expect(data.accounts[0].balance).toBe(before - 50000)
    expect(data.transactions[0].recipient).toBe('Клієнт')
  })
  it('does not duplicate a retried transfer', () => {
    const data = demoBank()
    transfer(data, { ...input, to: 'reserve' })
    const snapshot = structuredClone(data)
    transfer(data, { ...input, to: 'reserve' })
    expect(data).toEqual(snapshot)
  })
  it.each([{ amount: 10000000 }, { to: 'daily' }, { to: 'missing' }, { recipient: '' }])(
    'rejects invalid transfer without changing balances: %s',
    (overrides) => {
      const data = demoBank()
      const snapshot = structuredClone(data)
      expect(() => transfer(data, { ...input, ...overrides })).toThrow()
      expect(data).toEqual(snapshot)
    },
  )
  it('blocks frozen source and destination', () => {
    const data = demoBank()
    data.accounts[0].frozen = true
    expect(() => transfer(data, input)).toThrow('заморожено')
    data.accounts[0].frozen = false
    data.accounts[1].frozen = true
    expect(() => transfer(data, { ...input, to: 'reserve' })).toThrow('заморожено')
  })
  it('rejects missing accounts', () => expect(() => accountOf(emptyBank(), 'none')).toThrow())
})
describe('saving goals', () => {
  it('moves funds from account to goal without changing total assets', () => {
    const data = demoBank()
    const before = data.accounts[0].balance + data.goals[0].saved
    contribute(data, 'trip', 'daily', 150, 'save-1')
    expect(data.accounts[0].balance + data.goals[0].saved).toBe(before)
    expect(data.transactions[0].category).toBe('Накопичення')
    const snapshot = structuredClone(data)
    contribute(data, 'trip', 'daily', 150, 'save-1')
    expect(data).toEqual(snapshot)
  })
  it('rejects overfunding and insufficient funds', () => {
    const data = demoBank()
    expect(() => contribute(data, 'trip', 'daily', 50000, 'test')).toThrow('залишок')
    data.accounts[0].balance = 0
    expect(() => contribute(data, 'trip', 'daily', 100, 'test')).toThrow('недостатньо')
  })
})
describe('persisted data', () => {
  it('normalizes arrays removed by Firebase', () => {
    const raw = {
      version: 1,
      profile: { name: 'Test', email: 'test@example.com', monthlyBudget: 0 },
    }
    expect(parseBank(raw)).toEqual(emptyBank('Test', 'test@example.com'))
  })
  it('accepts demo data', () => expect(parseBank(demoBank())).toBeTruthy())
  it('rejects corrupt schema, sums, dates, duplicate IDs and unknown statuses', () => {
    expect(() => parseBank(null)).toThrow()
    expect(() => parseBank({ version: 5 })).toThrow()
    const data = demoBank()
    data.accounts[0].balance = -1
    expect(() => parseBank(data)).toThrow()
    const dates = demoBank()
    dates.transactions[0].date = 'invalid'
    expect(() => parseBank(dates)).toThrow()
    const duplicates = demoBank()
    duplicates.accounts.push(duplicates.accounts[0])
    expect(() => parseBank(duplicates)).toThrow()
    const status = demoBank()
    Object.assign(status.requests[0], { status: 'bogus' })
    expect(() => parseBank(status)).toThrow()
  })
})
describe('CSV export', () => {
  it('escapes quotes and prevents spreadsheet formula injection', () => {
    expect(csvCell('Hello "world"')).toBe('"Hello ""world"""')
    expect(csvCell('=SUM(A1)')).toBe('"\'=SUM(A1)"')
  })
  it('keeps numeric expenses numeric', () => expect(csvCell(-12.5)).toBe('"-12.5"'))
})
