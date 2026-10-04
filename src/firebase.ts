import { emptyBank, parseBank } from './domain'
import type { BankData } from './domain'

interface Session {
  uid: string
  email: string
  idToken: string
  refreshToken: string
  expiresAt: number
}
const SESSION_KEY = 'north-firebase-session'
// Firebase web configuration is public. Defaults keep hosted builds usable without env overrides.
const apiKey =
  (import.meta.env.VITE_FIREBASE_API_KEY as string | undefined)?.trim() ||
  'AIzaSyAV7pJxsiaL8dunzXzzG-P20f122eiwP_Y'
const database = (
  (import.meta.env.VITE_FIREBASE_DATABASE_URL as string | undefined)?.trim() ||
  'https://vue-online-bank-414c1-default-rtdb.firebaseio.com'
).replace(/\/$/, '')
let session: Session | null = null
try {
  const raw = sessionStorage.getItem(SESSION_KEY)
  if (raw) session = JSON.parse(raw) as Session
} catch {
  session = null
}
export const getSession = () => session
function saveSession(value: Session | null) {
  session = value
  if (value) sessionStorage.setItem(SESSION_KEY, JSON.stringify(value))
  else sessionStorage.removeItem(SESSION_KEY)
}
const authErrors: Record<string, string> = {
  INVALID_LOGIN_CREDENTIALS: 'Неправильний email або пароль.',
  EMAIL_NOT_FOUND: 'Неправильний email або пароль.',
  INVALID_PASSWORD: 'Неправильний email або пароль.',
  EMAIL_EXISTS: 'Цей email уже зареєстровано.',
  TOO_MANY_ATTEMPTS_TRY_LATER: 'Забагато спроб. Спробуйте пізніше.',
  USER_DISABLED: 'Доступ до облікового запису вимкнено.',
  OPERATION_NOT_ALLOWED: 'Увімкніть Email/Password у налаштуваннях Firebase Authentication.',
}
async function authRequest(endpoint: string, body: object) {
  if (!apiKey) throw new Error('Налаштуйте Firebase у .env.local. Інструкція є в README.')
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:${endpoint}?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    },
  )
  const data = await response.json()
  if (!response.ok) {
    const code = String(data.error?.message ?? '').split(' : ')[0]
    throw new Error(
      authErrors[code] ?? 'Не вдалося увійти. Перевірте налаштування Firebase та підключення.',
    )
  }
  return data
}
export async function authenticate(email: string, password: string, register = false) {
  const data = await authRequest(register ? 'signUp' : 'signInWithPassword', {
    email,
    password,
    returnSecureToken: true,
  })
  saveSession({
    uid: data.localId,
    email,
    idToken: data.idToken,
    refreshToken: data.refreshToken,
    expiresAt: Date.now() + Number(data.expiresIn) * 1000,
  })
}
export async function resetPassword(email: string) {
  await authRequest('sendOobCode', { requestType: 'PASSWORD_RESET', email })
}
export function signOut() {
  saveSession(null)
}
let refreshing: Promise<string> | null = null
async function token(): Promise<string> {
  if (!session) throw new Error('Увійдіть до облікового запису Firebase.')
  if (session.expiresAt > Date.now() + 60000) return session.idToken
  if (refreshing) return refreshing
  const current = session
  refreshing = (async () => {
    const response = await fetch(`https://securetoken.googleapis.com/v1/token?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: current.refreshToken,
      }),
      signal: AbortSignal.timeout(15000),
    })
    if (!response.ok) {
      signOut()
      throw new Error('Сесія завершилася. Увійдіть знову.')
    }
    const data = await response.json()
    if (session?.uid !== current.uid) throw new Error('Сесія змінилася. Повторіть вхід.')
    saveSession({
      ...current,
      idToken: data.id_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + Number(data.expires_in) * 1000,
    })
    return data.id_token as string
  })()
  try {
    return await refreshing
  } finally {
    refreshing = null
  }
}
async function bankUrl() {
  if (!database || !session) throw new Error('Firebase не налаштовано або вхід не виконано.')
  const idToken = await token()
  return `${database}/users/${encodeURIComponent(session!.uid)}/bank.json?auth=${encodeURIComponent(idToken)}`
}
async function check(response: Response) {
  if (response.ok) return
  if (response.status === 412)
    throw new Error('Дані змінилися в іншій вкладці. Оновіть кабінет і повторіть операцію.')
  if (response.status === 401 || response.status === 403)
    throw new Error('Firebase відхилив доступ. Перевірте вхід і правила бази даних із README.')
  throw new Error('Firebase не зберіг дані. Перевірте з’єднання та повторіть операцію.')
}
export async function readBank(): Promise<{ data: BankData; etag: string }> {
  const response = await fetch(await bankUrl(), {
    headers: { 'X-Firebase-ETag': 'true' },
    signal: AbortSignal.timeout(15000),
  })
  await check(response)
  const raw: unknown = await response.json()
  return {
    data: raw == null ? emptyBank(session!.email.split('@')[0], session!.email) : parseBank(raw),
    etag: response.headers.get('ETag') ?? 'null_etag',
  }
}
// Conditional whole-state write commits balances and ledger together and prevents lost updates.
export async function writeBank(data: BankData, etag: string): Promise<void> {
  const response = await fetch(await bankUrl(), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'If-Match': etag },
    body: JSON.stringify(data),
    signal: AbortSignal.timeout(15000),
  })
  await check(response)
}
export async function readLegacyRequests(): Promise<unknown> {
  if (!database) throw new Error('Firebase не налаштовано.')
  const response = await fetch(
    `${database}/requests.json?auth=${encodeURIComponent(await token())}`,
    { signal: AbortSignal.timeout(15000) },
  )
  await check(response)
  return response.json()
}
