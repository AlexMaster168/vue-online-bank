export type RequestStatus = 'pending' | 'active' | 'done' | 'cancelled'
export interface Account {
  id: string
  name: string
  balance: number
  currency: 'UAH'
  number: string
  frozen: boolean
}
export interface Transaction {
  id: string
  accountId: string
  recipient: string
  amount: number
  category: string
  date: string
  note: string
}
export interface Goal {
  id: string
  name: string
  target: number
  saved: number
}
export interface CreditRequest {
  id: string
  fio: string
  phone: string
  amount: number
  status: RequestStatus
  date: string
}
export interface BankData {
  version: 1
  profile: { name: string; email: string; monthlyBudget: number }
  accounts: Account[]
  transactions: Transaction[]
  goals: Goal[]
  requests: CreditRequest[]
}
export const statuses: Record<RequestStatus, string> = {
  pending: 'На розгляді',
  active: 'Активна',
  done: 'Виплачена',
  cancelled: 'Скасована',
}
export const money = (value: number) =>
  new Intl.NumberFormat('uk-UA', {
    style: 'currency',
    currency: 'UAH',
    currencyDisplay: 'narrowSymbol',
    maximumFractionDigits: 2,
  }).format(value / 100)
export const dateLabel = (value: string) =>
  new Intl.DateTimeFormat('uk-UA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Europe/Kyiv',
  }).format(new Date(value))
export const uid = () => crypto.randomUUID()
export function cents(value: number): number {
  if (
    !Number.isFinite(value) ||
    value <= 0 ||
    value > 100_000_000 ||
    Math.abs(value * 100 - Math.round(value * 100)) > 0.00001
  )
    throw new Error('Введіть суму від 0,01 до 100 000 000 ₴, не більше двох знаків після коми.')
  return Math.round(value * 100)
}
export function emptyBank(name = 'Клієнт', email = ''): BankData {
  return {
    version: 1,
    profile: { name, email, monthlyBudget: 0 },
    accounts: [],
    transactions: [],
    goals: [],
    requests: [],
  }
}
export function demoBank(): BankData {
  const data = emptyBank('Олександр', 'alex@example.com')
  data.profile.monthlyBudget = 2500000
  data.accounts = [
    {
      id: 'daily',
      name: 'На щодень',
      balance: 8452050,
      currency: 'UAH',
      number: '4821',
      frozen: false,
    },
    {
      id: 'reserve',
      name: 'Резервний рахунок',
      balance: 12500000,
      currency: 'UAH',
      number: '9036',
      frozen: false,
    },
  ]
  data.goals = [
    { id: 'trip', name: 'Подорож до Японії', target: 12000000, saved: 7200000 },
    { id: 'buffer', name: 'Фінансова подушка', target: 20000000, saved: 9500000 },
  ]
  const now = new Date()
  data.transactions = [
    ['Сільпо', -124050, 'Продукти'],
    ['Зарплата', 6500000, 'Надходження'],
    ['Netflix', -29900, 'Підписки'],
    ['Кав’ярня Honey', -18500, 'Ресторани'],
    ['Таксі', -24000, 'Транспорт'],
    ['Rozetka', -249900, 'Покупки'],
  ].map(([recipient, amount, category], index) => ({
    id: `seed-${index}`,
    accountId: 'daily',
    recipient: String(recipient),
    amount: Number(amount),
    category: String(category),
    date: new Date(now.getTime() - index * 86400000).toISOString(),
    note: '',
  }))
  data.requests = [
    {
      id: 'credit-1',
      fio: 'Олександр Коваленко',
      phone: '+380501234567',
      amount: 15000000,
      status: 'pending',
      date: now.toISOString(),
    },
  ]
  return data
}
export function accountOf(data: BankData, id: string): Account {
  const account = data.accounts.find((item) => item.id === id)
  if (!account) throw new Error('Оберіть наявний рахунок.')
  if (account.frozen) throw new Error('Картку заморожено. Розморозьте її перед операцією.')
  return account
}
export function transfer(
  data: BankData,
  input: { id: string; from: string; to?: string; recipient: string; amount: number; note: string },
) {
  if (data.transactions.some((item) => item.id === input.id)) return
  const amount = cents(input.amount)
  const from = accountOf(data, input.from)
  if (from.balance < amount) throw new Error('На рахунку недостатньо коштів.')
  if (input.to === input.from) throw new Error('Оберіть інший рахунок для переказу.')
  if (!input.recipient.trim()) throw new Error('Укажіть отримувача.')
  const to = input.to ? accountOf(data, input.to) : undefined
  from.balance -= amount
  if (to) to.balance += amount
  const date = new Date().toISOString()
  data.transactions.unshift({
    id: input.id,
    accountId: from.id,
    recipient: input.recipient.trim(),
    amount: -amount,
    category: to ? 'Між рахунками' : 'Перекази',
    date,
    note: input.note.trim(),
  })
  if (to)
    data.transactions.unshift({
      id: `${input.id}-in`,
      accountId: to.id,
      recipient: from.name,
      amount,
      category: 'Між рахунками',
      date,
      note: input.note.trim(),
    })
}
export function contribute(
  data: BankData,
  goalId: string,
  accountId: string,
  amountValue: number,
  id: string,
) {
  if (data.transactions.some((item) => item.id === id)) return
  const goal = data.goals.find((item) => item.id === goalId)
  if (!goal) throw new Error('Ціль не знайдена.')
  const amount = cents(amountValue)
  const account = accountOf(data, accountId)
  if (amount > goal.target - goal.saved) throw new Error('Сума перевищує залишок до цілі.')
  if (amount > account.balance) throw new Error('На рахунку недостатньо коштів.')
  account.balance -= amount
  goal.saved += amount
  data.transactions.unshift({
    id,
    accountId,
    recipient: goal.name,
    amount: -amount,
    category: 'Накопичення',
    date: new Date().toISOString(),
    note: 'Поповнення цілі',
  })
}
// Firebase removes empty arrays. Normalize absent collections and reject malformed data.
export function parseBank(raw: unknown): BankData {
  if (!raw || typeof raw !== 'object') throw new Error('Некоректні дані кабінету.')
  const data = raw as BankData
  if (
    data.version !== 1 ||
    typeof data.profile?.name !== 'string' ||
    typeof data.profile.email !== 'string' ||
    !Number.isSafeInteger(data.profile.monthlyBudget) ||
    data.profile.monthlyBudget < 0
  )
    throw new Error('Формат даних кабінету не підтримується.')
  for (const key of ['accounts', 'transactions', 'goals', 'requests'] as const) {
    if (data[key] == null) Object.assign(data, { [key]: [] })
    if (!Array.isArray(data[key])) throw new Error('Некоректна колекція даних.')
    const ids = new Set<string>()
    for (const item of data[key]) {
      if (!item || typeof item.id !== 'string' || ids.has(item.id))
        throw new Error('Некоректний ідентифікатор даних.')
      ids.add(item.id)
    }
  }
  if (
    data.accounts.some(
      (a) =>
        typeof a.name !== 'string' ||
        !Number.isSafeInteger(a.balance) ||
        a.balance < 0 ||
        a.currency !== 'UAH' ||
        typeof a.number !== 'string' ||
        typeof a.frozen !== 'boolean',
    ) ||
    data.transactions.some(
      (t) =>
        !Number.isSafeInteger(t.amount) ||
        typeof t.accountId !== 'string' ||
        typeof t.recipient !== 'string' ||
        typeof t.category !== 'string' ||
        typeof t.note !== 'string' ||
        !validDate(t.date),
    ) ||
    data.goals.some(
      (g) =>
        typeof g.name !== 'string' ||
        !Number.isSafeInteger(g.target) ||
        g.target <= 0 ||
        !Number.isSafeInteger(g.saved) ||
        g.saved < 0 ||
        g.saved > g.target,
    ) ||
    data.requests.some(
      (r) =>
        typeof r.fio !== 'string' ||
        typeof r.phone !== 'string' ||
        !Number.isSafeInteger(r.amount) ||
        r.amount <= 0 ||
        !Object.hasOwn(statuses, r.status) ||
        !validDate(r.date),
    )
  )
    throw new Error('Дані містять некоректні суми або поля.')
  return data
}
function validDate(value: unknown): boolean {
  return typeof value === 'string' && Number.isFinite(Date.parse(value))
}
export function csvCell(value: string | number): string {
  const text = String(value)
  return `"${(typeof value === 'string' && /^[=+@\-\t\r]/.test(text) ? "'" : '') + text.replaceAll('"', '""')}"`
}
