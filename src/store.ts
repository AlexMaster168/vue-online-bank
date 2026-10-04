import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { accountOf, cents, demoBank, emptyBank, parseBank, uid } from './domain'
import type { BankData, CreditRequest } from './domain'
import {
  authenticate,
  getSession,
  readBank,
  readLegacyRequests,
  signOut,
  writeBank,
} from './firebase'

const DEMO_KEY = 'north-demo-v2'
export const useBank = defineStore('bank', () => {
  const data = ref<BankData>(emptyBank())
  const mode = ref<'demo' | 'firebase' | null>(getSession() ? 'firebase' : null)
  const busy = ref(false)
  const loading = ref(false)
  const error = ref('')
  const notice = ref('')
  const syncedAt = ref('')
  const total = computed(() => data.value.accounts.reduce((sum, a) => sum + a.balance, 0))
  const savings = computed(() => data.value.goals.reduce((sum, g) => sum + g.saved, 0))
  async function login(email: string, password: string, register: boolean) {
    if (busy.value) return
    busy.value = true
    error.value = ''
    try {
      await authenticate(email, password, register)
      sessionStorage.removeItem('north-demo-active')
      mode.value = 'firebase'
      data.value = (await readBank()).data
      syncedAt.value = new Date().toISOString()
    } catch (e) {
      error.value = message(e)
    } finally {
      busy.value = false
    }
  }
  function startDemo() {
    signOut()
    mode.value = 'demo'
    error.value = ''
    notice.value = ''
    try {
      sessionStorage.setItem('north-demo-active', '1')
      const raw = localStorage.getItem(DEMO_KEY)
      data.value = raw ? parseBank(JSON.parse(raw)) : demoBank()
    } catch {
      data.value = demoBank()
      error.value = 'Локальні дані пошкоджені або недоступні. Завантажено демоприклад.'
    }
  }
  async function refresh() {
    if (!mode.value || loading.value || busy.value) return
    loading.value = true
    error.value = ''
    try {
      if (mode.value === 'firebase') {
        data.value = (await readBank()).data
        syncedAt.value = new Date().toISOString()
      } else {
        const raw = localStorage.getItem(DEMO_KEY)
        if (raw) data.value = parseBank(JSON.parse(raw))
      }
    } catch (e) {
      error.value = message(e)
    } finally {
      loading.value = false
    }
  }
  async function mutate(action: (draft: BankData) => void, success: string): Promise<boolean> {
    if (busy.value || loading.value || !mode.value) return false
    busy.value = true
    error.value = ''
    notice.value = ''
    try {
      const remote = mode.value === 'firebase' ? await readBank() : null
      const draft = structuredClone(
        remote?.data ?? (JSON.parse(JSON.stringify(data.value)) as BankData),
      )
      action(draft)
      parseBank(draft)
      if (remote) await writeBank(draft, remote.etag)
      else localStorage.setItem(DEMO_KEY, JSON.stringify(draft))
      data.value = draft
      syncedAt.value = new Date().toISOString()
      notice.value = success
      return true
    } catch (e) {
      error.value = message(e)
      return false
    } finally {
      busy.value = false
    }
  }
  async function importLegacy() {
    if (busy.value || mode.value !== 'firebase') return
    busy.value = true
    error.value = ''
    let requests: CreditRequest[] = []
    try {
      const raw = await readLegacyRequests()
      requests = Object.entries(raw ?? {}).map(([id, item]) => {
        const r = item as {
          fio: string
          phone: string
          amount: number
          status: CreditRequest['status']
        }
        return {
          id: `legacy-${id}`,
          fio: r.fio,
          phone: r.phone,
          amount: cents(Number(r.amount)),
          status: r.status,
          date: new Date().toISOString(),
        }
      })
    } catch (e) {
      error.value = message(e)
      return
    } finally {
      busy.value = false
    }
    await mutate((draft) => {
      for (const r of requests)
        if (!draft.requests.some((existing) => existing.id === r.id)) draft.requests.push(r)
    }, `Імпортовано заявок: ${requests.length}`)
  }
  async function openAccount(name: string, id: string = uid()) {
    return mutate((draft) => {
      if (draft.accounts.some((account) => account.id === id)) return
      if (!name.trim()) throw new Error('Укажіть назву рахунку.')
      if (draft.accounts.length >= 10) throw new Error('Можна відкрити до 10 рахунків.')
      draft.accounts.push({
        id,
        name: name.trim(),
        balance: 0,
        currency: 'UAH',
        number: String(Math.floor(1000 + Math.random() * 9000)),
        frozen: false,
      })
    }, 'Рахунок відкрито. Номер картки в цьому кабінеті — ілюстрація, а не банківський реквізит.')
  }
  async function topUp(accountId: string, value: number, id: string = uid()) {
    return mutate((draft) => {
      if (mode.value !== 'demo') throw new Error('Поповнення доступне лише в деморежимі.')
      if (draft.transactions.some((transaction) => transaction.id === id)) return
      const amount = cents(value)
      accountOf(draft, accountId).balance += amount
      draft.transactions.unshift({
        id,
        accountId,
        recipient: 'Демопоповнення',
        amount,
        category: 'Надходження',
        date: new Date().toISOString(),
        note: '',
      })
    }, 'Деморахунок поповнено')
  }
  function logout() {
    if (busy.value || loading.value) return
    signOut()
    sessionStorage.removeItem('north-demo-active')
    mode.value = null
    data.value = emptyBank()
    error.value = ''
    notice.value = ''
  }
  try {
    if (!mode.value && sessionStorage.getItem('north-demo-active')) startDemo()
  } catch {
    /* Storage may be disabled by browser privacy settings. */
  }
  return {
    data,
    mode,
    busy,
    loading,
    error,
    notice,
    syncedAt,
    total,
    savings,
    login,
    startDemo,
    refresh,
    mutate,
    importLegacy,
    openAccount,
    topUp,
    logout,
  }
})
function message(error: unknown) {
  return error instanceof Error ? error.message : 'Не вдалося виконати операцію.'
}
