import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { demoBank, transfer } from './domain'
import { useBank } from './store'
import { readBank, writeBank } from './firebase'

vi.mock('./firebase', () => ({
  authenticate: vi.fn(),
  getSession: () => null,
  signOut: vi.fn(),
  readBank: vi.fn(),
  writeBank: vi.fn(),
  readLegacyRequests: vi.fn(),
}))
const storage = new Map<string, string>()
beforeEach(() => {
  setActivePinia(createPinia())
  storage.clear()
  vi.clearAllMocks()
  const api = {
    getItem: (k: string) => storage.get(k) ?? null,
    setItem: (k: string, v: string) => {
      storage.set(k, v)
    },
    removeItem: (k: string) => {
      storage.delete(k)
    },
  }
  vi.stubGlobal('localStorage', api)
  vi.stubGlobal('sessionStorage', api)
})
describe('store commit behavior', () => {
  it('does not duplicate retried account creation or demo top-ups', async () => {
    const bank = useBank()
    bank.startDemo()
    await bank.openAccount('Test', 'fixed-account')
    await bank.openAccount('Test', 'fixed-account')
    expect(bank.data.accounts.filter((a) => a.id === 'fixed-account')).toHaveLength(1)
    await bank.topUp('fixed-account', 100, 'fixed-topup')
    await bank.topUp('fixed-account', 100, 'fixed-topup')
    expect(bank.data.accounts.find((a) => a.id === 'fixed-account')?.balance).toBe(10000)
  })
  it('persists demo balances and ledger together and restores after refresh', async () => {
    const bank = useBank()
    bank.startDemo()
    await bank.mutate(
      (d) => transfer(d, { id: 'one', from: 'daily', recipient: 'Тест', amount: 10, note: '' }),
      'saved',
    )
    const balance = bank.data.accounts[0].balance
    setActivePinia(createPinia())
    const restored = useBank()
    expect(restored.mode).toBe('demo')
    expect(restored.data.accounts[0].balance).toBe(balance)
    expect(restored.data.transactions[0].id).toBe('one')
  })
  it('keeps current balances unchanged on rejected Firebase save', async () => {
    const bank = useBank()
    bank.startDemo()
    bank.mode = 'firebase'
    const before = JSON.parse(JSON.stringify(bank.data))
    vi.mocked(readBank).mockResolvedValue({ data: demoBank(), etag: 'revision' })
    vi.mocked(writeBank).mockRejectedValue(new Error('permission denied'))
    const result = await bank.mutate(
      (d) => transfer(d, { id: 'one', from: 'daily', recipient: 'Тест', amount: 10, note: '' }),
      'saved',
    )
    expect(result).toBe(false)
    expect(bank.data).toEqual(before)
    expect(bank.notice).toBe('')
    expect(bank.error).toBe('permission denied')
  })
  it('does not update the UI if local persistence fails', async () => {
    const bank = useBank()
    bank.startDemo()
    const before = bank.total
    vi.stubGlobal('localStorage', {
      setItem: () => {
        throw new Error('quota exceeded')
      },
    })
    expect(await bank.topUp('daily', 100)).toBe(false)
    expect(bank.total).toBe(before)
  })
  it('blocks duplicate submission while a commit is pending', async () => {
    const bank = useBank()
    bank.startDemo()
    bank.mode = 'firebase'
    let resolveWrite!: () => void
    vi.mocked(readBank).mockResolvedValue({ data: demoBank(), etag: 'revision' })
    vi.mocked(writeBank).mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveWrite = resolve
        }),
    )
    const first = bank.mutate((d) => {
      d.profile.name = 'Changed'
    }, 'saved')
    await Promise.resolve()
    await Promise.resolve()
    expect(
      await bank.mutate((d) => {
        d.profile.name = 'Duplicate'
      }, 'saved'),
    ).toBe(false)
    resolveWrite()
    await first
    expect(writeBank).toHaveBeenCalledTimes(1)
  })
  it('blocks demo top-ups for Firebase accounts', async () => {
    const bank = useBank()
    bank.startDemo()
    bank.mode = 'firebase'
    vi.mocked(readBank).mockResolvedValue({ data: demoBank(), etag: 'revision' })
    expect(await bank.topUp('daily', 100)).toBe(false)
    expect(writeBank).not.toHaveBeenCalled()
  })
})
