import { beforeEach, describe, expect, it, vi } from 'vitest'
import { emptyBank } from './domain'

const fetchMock = vi.fn()
const storage = new Map<string, string>()
beforeEach(() => {
  vi.resetModules()
  storage.clear()
  fetchMock.mockReset()
  vi.stubEnv('VITE_FIREBASE_API_KEY', 'test-public-key')
  vi.stubEnv('VITE_FIREBASE_DATABASE_URL', 'https://test.firebaseio.com')
  vi.stubGlobal('sessionStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  })
  vi.stubGlobal('fetch', fetchMock)
})
async function loggedIn(expiresIn = '3600') {
  const firebase = await import('./firebase')
  fetchMock.mockResolvedValueOnce(
    Response.json({ localId: 'user-1', idToken: 'token', refreshToken: 'refresh', expiresIn }),
  )
  await firebase.authenticate('user@example.com', 'password')
  return firebase
}
describe('Firebase persistence', () => {
  it('uses the restored Firebase project when hosting has no env variables', async () => {
    vi.stubEnv('VITE_FIREBASE_API_KEY', '')
    vi.stubEnv('VITE_FIREBASE_DATABASE_URL', '')
    const firebase = await loggedIn()
    expect(fetchMock.mock.calls[0][0]).toContain('accounts:signInWithPassword?key=AIzaSy')
    fetchMock.mockResolvedValueOnce(Response.json(null))
    await firebase.readBank()
    expect(fetchMock.mock.calls[1][0]).toContain(
      'https://vue-online-bank-414c1-default-rtdb.firebaseio.com/users/user-1/bank.json',
    )
  })
  it('submits registration to Firebase signUp', async () => {
    const firebase = await import('./firebase')
    fetchMock.mockResolvedValueOnce(
      Response.json({
        localId: 'new-user',
        idToken: 'new-token',
        refreshToken: 'refresh',
        expiresIn: '3600',
      }),
    )
    await firebase.authenticate('new@example.com', 'test-password', true)
    expect(fetchMock.mock.calls[0][0]).toContain('accounts:signUp?key=test-public-key')
    expect(firebase.getSession()?.uid).toBe('new-user')
  })
  it('loads user-scoped data and ETag', async () => {
    const firebase = await loggedIn()
    fetchMock.mockResolvedValueOnce(Response.json(emptyBank(), { headers: { ETag: 'revision-1' } }))
    expect((await firebase.readBank()).etag).toBe('revision-1')
    expect(fetchMock.mock.calls[1][0]).toContain('/users/user-1/bank.json?auth=token')
    expect(fetchMock.mock.calls[1][1].headers).toEqual({ 'X-Firebase-ETag': 'true' })
  })
  it('creates an empty real account state without sample balances', async () => {
    const firebase = await loggedIn()
    fetchMock.mockResolvedValueOnce(Response.json(null))
    const result = await firebase.readBank()
    expect(result.data.accounts).toEqual([])
    expect(result.data.profile.email).toBe('user@example.com')
  })
  it('uses conditional PUT for whole-state atomic commits', async () => {
    const firebase = await loggedIn()
    fetchMock.mockResolvedValueOnce(Response.json(emptyBank()))
    await firebase.writeBank(emptyBank(), 'revision-1')
    const options = fetchMock.mock.calls[1][1]
    expect(options.method).toBe('PUT')
    expect(options.headers['If-Match']).toBe('revision-1')
    expect(JSON.parse(options.body)).toEqual(emptyBank())
  })
  it('reports stale writes and permission failures', async () => {
    const firebase = await loggedIn()
    fetchMock.mockResolvedValueOnce(new Response('', { status: 412 }))
    await expect(firebase.writeBank(emptyBank(), 'old')).rejects.toThrow('іншій вкладці')
    fetchMock.mockResolvedValueOnce(new Response('', { status: 401 }))
    await expect(firebase.readBank()).rejects.toThrow('відхилив доступ')
  })
  it('refreshes expired tokens using returned id_token', async () => {
    const firebase = await loggedIn('0')
    fetchMock.mockResolvedValueOnce(
      Response.json({ id_token: 'fresh', refresh_token: 'refresh-2', expires_in: '3600' }),
    )
    fetchMock.mockResolvedValueOnce(Response.json(null))
    await firebase.readBank()
    expect(fetchMock.mock.calls[2][0]).toContain('auth=fresh')
    expect(firebase.getSession()?.refreshToken).toBe('refresh-2')
  })
  it('clears rejected expired sessions', async () => {
    const firebase = await loggedIn('0')
    fetchMock.mockResolvedValueOnce(new Response('', { status: 400 }))
    await expect(firebase.readBank()).rejects.toThrow('Сесія завершилася')
    expect(firebase.getSession()).toBeNull()
  })
  it('maps auth errors without exposing raw backend errors', async () => {
    const firebase = await import('./firebase')
    fetchMock.mockResolvedValueOnce(
      Response.json({ error: { message: 'INVALID_LOGIN_CREDENTIALS' } }, { status: 400 }),
    )
    await expect(firebase.authenticate('bad@example.com', 'bad')).rejects.toThrow(
      'Неправильний email або пароль',
    )
  })
  it('removes tokens on logout', async () => {
    const firebase = await loggedIn()
    firebase.signOut()
    expect(storage.size).toBe(0)
    expect(firebase.getSession()).toBeNull()
  })
})
