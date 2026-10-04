<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useBank } from '../store'
import { cents, contribute, csvCell, dateLabel, money, statuses, transfer, uid } from '../domain'
import type { CreditRequest, RequestStatus } from '../domain'
import AppIcon from '../components/AppIcon.vue'
import AppDialog from '../components/AppDialog.vue'
import TransactionList from '../components/TransactionList.vue'

const bank = useBank()
const route = useRoute()
const page = computed(() => (route.path === '/' ? 'overview' : route.path.slice(1)))
const period = ref(30)
const query = ref('')
const category = ref('')
const accountFilter = ref('')
const direction = ref('')
const fromDate = ref('')
const toDate = ref('')
const currentPage = ref(1)
const requestQuery = ref('')
const requestStatus = ref('')
const modal = ref<
  '' | 'account' | 'topup' | 'goal' | 'contribute' | 'request' | 'deleteRequest' | 'freeze'
>('')
const form = reactive({
  id: '',
  operationId: '',
  frozenTarget: false,
  name: '',
  phone: '',
  amount: '',
  accountId: '',
  status: 'pending' as RequestStatus,
})
const profile = reactive({
  name: bank.data.profile.name,
  budget: bank.data.profile.monthlyBudget / 100,
})
const payment = reactive({
  from: '',
  to: '',
  recipient: '',
  amount: '',
  note: '',
  type: 'external',
})
const confirmation = ref(false)
const transferId = ref('')
const modalTitles = {
  account: 'Новий рахунок',
  topup: 'Демопоповнення',
  goal: 'Нова ціль',
  contribute: 'Поповнити накопичення',
  request: 'Кредитна заявка',
  deleteRequest: 'Видалити заявку?',
  freeze: 'Змінити статус картки?',
}

const cutoff = computed(() => Date.now() - period.value * 86400000)
const recent = computed(() =>
  bank.data.transactions.filter(
    (t) =>
      Date.parse(t.date) >= cutoff.value &&
      t.category !== 'Між рахунками' &&
      t.category !== 'Накопичення',
  ),
)
const income = computed(() =>
  recent.value.filter((t) => t.amount > 0).reduce((n, t) => n + t.amount, 0),
)
const expenses = computed(() =>
  recent.value.filter((t) => t.amount < 0).reduce((n, t) => n - t.amount, 0),
)
const monthlyExpenses = computed(() => {
  const month = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Kyiv',
    year: 'numeric',
    month: '2-digit',
  })
  const current = month.format(new Date())
  return bank.data.transactions
    .filter(
      (t) =>
        t.amount < 0 &&
        !['Між рахунками', 'Накопичення'].includes(t.category) &&
        month.format(new Date(t.date)) === current,
    )
    .reduce((n, t) => n - t.amount, 0)
})
const budgetPercent = computed(() =>
  bank.data.profile.monthlyBudget
    ? Math.min(100, Math.round((monthlyExpenses.value / bank.data.profile.monthlyBudget) * 100))
    : 0,
)
const spending = computed(() => {
  const groups: Record<string, number> = {}
  for (const t of recent.value)
    if (t.amount < 0) groups[t.category] = (groups[t.category] ?? 0) - t.amount
  return Object.entries(groups)
    .sort((a, b) => b[1] - a[1])
    .map(([name, amount], index) => ({
      name,
      amount,
      percent: expenses.value ? (amount / expenses.value) * 100 : 0,
      color: ['#1e5547', '#91b5a1', '#c6d7a3', '#e7ba91', '#dcd6cb'][index % 5],
    }))
})
const donut = computed(() => {
  let start = 0
  return `conic-gradient(${
    spending.value
      .map((c) => {
        const previous = start
        start += c.percent
        return `${c.color} ${previous}% ${start}%`
      })
      .join(',') || '#e8eee9 0% 100%'
  })`
})
const chart = computed(() => {
  const days = Math.min(period.value, 14)
  const keys = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Kyiv',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const values = Array.from({ length: days }, (_, i) => {
    const day = new Date(Date.now() - (days - 1 - i) * 86400000)
    const amount = recent.value
      .filter((t) => t.amount < 0 && keys.format(new Date(t.date)) === keys.format(day))
      .reduce((n, t) => n - t.amount, 0)
    return {
      amount,
      day: new Intl.DateTimeFormat('uk-UA', {
        day: 'numeric',
        month: 'short',
        timeZone: 'Europe/Kyiv',
      }).format(day),
    }
  })
  const max = Math.max(...values.map((d) => d.amount), 100)
  return values.map((d) => ({ ...d, height: Math.max(d.amount ? 3 : 0, (d.amount / max) * 100) }))
})
const filtered = computed(() =>
  bank.data.transactions
    .filter((t) => {
      const searchable = `${t.recipient} ${t.category} ${t.note}`.toLocaleLowerCase()
      return (
        searchable.includes(query.value.toLocaleLowerCase()) &&
        (!category.value || t.category === category.value) &&
        (!accountFilter.value || t.accountId === accountFilter.value) &&
        (!direction.value || (direction.value === 'income' ? t.amount > 0 : t.amount < 0)) &&
        (!fromDate.value ||
          Date.parse(t.date) >= new Date(`${fromDate.value}T00:00:00`).getTime()) &&
        (!toDate.value || Date.parse(t.date) <= new Date(`${toDate.value}T23:59:59.999`).getTime())
      )
    })
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date)),
)
const paginated = computed(() =>
  filtered.value.slice((currentPage.value - 1) * 10, currentPage.value * 10),
)
const pageCount = computed(() => Math.max(1, Math.ceil(filtered.value.length / 10)))
const categories = computed(() =>
  [...new Set(bank.data.transactions.map((t) => t.category))].sort(),
)
const requests = computed(() =>
  bank.data.requests.filter(
    (r) =>
      `${r.fio} ${r.phone}`.toLocaleLowerCase().includes(requestQuery.value.toLocaleLowerCase()) &&
      (!requestStatus.value || r.status === requestStatus.value),
  ),
)
const selectedGoal = computed(() => bank.data.goals.find((g) => g.id === form.id))
const selectedAccount = computed(() => bank.data.accounts.find((a) => a.id === form.id))
const activeAccounts = computed(() => bank.data.accounts.filter((a) => !a.frozen))
watch([query, category, accountFilter, direction, fromDate, toDate], () => {
  currentPage.value = 1
})
watch(
  () => bank.data.profile,
  (p) => {
    profile.name = p.name
    profile.budget = p.monthlyBudget / 100
  },
)
watch(
  () => route.path,
  () => {
    modal.value = ''
    confirmation.value = false
  },
)

function open(type: typeof modal.value, id = '') {
  bank.error = ''
  form.id = id
  form.operationId = uid()
  form.frozenTarget = !bank.data.accounts.find((a) => a.id === id)?.frozen
  form.name = ''
  form.phone = ''
  form.amount = ''
  form.accountId = activeAccounts.value[0]?.id ?? ''
  form.status = 'pending'
  if (type === 'request' && id) {
    const r = bank.data.requests.find((r) => r.id === id)
    if (r) {
      form.name = r.fio
      form.phone = r.phone
      form.amount = String(r.amount / 100)
      form.status = r.status
    }
  }
  modal.value = type
}
watch(
  () => route.query.request,
  (id) => {
    if (typeof id === 'string') open('request', id)
  },
  { immediate: true },
)
async function saveModal() {
  let ok = false
  try {
    if (modal.value === 'account') ok = await bank.openAccount(form.name, form.operationId)
    else if (modal.value === 'topup')
      ok = await bank.topUp(form.accountId, Number(form.amount), form.operationId)
    else if (modal.value === 'contribute') {
      const id = form.operationId
      ok = await bank.mutate(
        (d) => contribute(d, form.id, form.accountId, Number(form.amount), id),
        'Накопичення поповнено',
      )
    } else if (modal.value === 'goal') {
      const id = form.operationId
      ok = await bank.mutate((d) => {
        if (d.goals.some((goal) => goal.id === id)) return
        if (!form.name.trim()) throw new Error('Укажіть назву цілі.')
        d.goals.push({ id, name: form.name.trim(), target: cents(Number(form.amount)), saved: 0 })
      }, 'Нову ціль створено')
    } else if (modal.value === 'request') {
      const id = form.id || form.operationId
      ok = await bank.mutate((d) => {
        if (form.name.trim().length < 3)
          throw new Error('Введіть повне ім’я, щонайменше 3 символи.')
        if (!/^\+?[\d\s()-]{10,20}$/.test(form.phone) || form.phone.replace(/\D/g, '').length < 10)
          throw new Error('Введіть правильний номер телефону.')
        const existing = d.requests.find((r) => r.id === id)
        const request: CreditRequest = {
          id,
          fio: form.name.trim(),
          phone: form.phone.trim(),
          amount: cents(Number(form.amount)),
          status: form.status,
          date: existing?.date ?? new Date().toISOString(),
        }
        if (existing) Object.assign(existing, request)
        else d.requests.unshift(request)
      }, 'Заявку збережено')
    } else if (modal.value === 'deleteRequest')
      ok = await bank.mutate((d) => {
        d.requests = d.requests.filter((r) => r.id !== form.id)
      }, 'Заявку видалено')
    else if (modal.value === 'freeze')
      ok = await bank.mutate((d) => {
        const account = d.accounts.find((a) => a.id === form.id)
        if (!account) throw new Error('Рахунок не знайдено.')
        account.frozen = form.frozenTarget
      }, 'Статус картки оновлено')
    if (ok) modal.value = ''
  } catch (e) {
    bank.error = e instanceof Error ? e.message : 'Перевірте введені дані.'
  }
}
function setPaymentType(type: 'external' | 'internal') {
  payment.type = type
  confirmation.value = false
}
function paymentInput() {
  return {
    id: transferId.value,
    from: payment.from,
    to: payment.type === 'internal' ? payment.to : undefined,
    recipient:
      payment.type === 'internal'
        ? (bank.data.accounts.find((a) => a.id === payment.to)?.name ?? '')
        : payment.recipient,
    amount: Number(payment.amount),
    note: payment.note,
  }
}
function preparePayment() {
  bank.error = ''
  try {
    transferId.value = uid()
    transfer(JSON.parse(JSON.stringify(bank.data)), paymentInput())
    confirmation.value = true
  } catch (e) {
    bank.error = e instanceof Error ? e.message : 'Перевірте переказ.'
  }
}
async function sendPayment() {
  const input = paymentInput()
  const ok = await bank.mutate(
    (d) => transfer(d, input),
    'Переказ записано. Баланс та історію оновлено.',
  )
  if (ok) {
    confirmation.value = false
    payment.amount = ''
    payment.recipient = ''
    payment.note = ''
  }
}
async function saveProfile() {
  await bank.mutate((d) => {
    if (profile.name.trim().length < 2) throw new Error('Введіть ім’я, щонайменше 2 символи.')
    if (!Number.isFinite(profile.budget) || profile.budget < 0)
      throw new Error('Бюджет має бути додатним або дорівнювати нулю.')
    d.profile.name = profile.name.trim()
    d.profile.monthlyBudget = profile.budget ? cents(profile.budget) : 0
  }, 'Налаштування збережено')
}
function download(content: string, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
function exportCsv() {
  const rows = [
    ['Дата', 'Отримувач', 'Категорія', 'Сума UAH', 'Рахунок', 'Примітка'],
    ...filtered.value.map((t) => [
      t.date,
      t.recipient,
      t.category,
      t.amount / 100,
      bank.data.accounts.find((a) => a.id === t.accountId)?.name ?? t.accountId,
      t.note,
    ]),
  ]
  download(
    '\uFEFF' + rows.map((row) => row.map(csvCell).join(';')).join('\r\n'),
    'north-transactions.csv',
    'text/csv;charset=utf-8',
  )
}
const faqs = [
  [
    'Де зберігаються мої дані?',
    'Після входу через Firebase дані зберігаються в Realtime Database в окремій гілці вашого облікового запису. У деморежимі дані залишаються лише в цьому браузері.',
  ],
  [
    'Це справжні банківські перекази?',
    'Це фінансовий кабінет для обліку та моделювання. Операції оновлюють баланс та історію в базі, але не надсилають гроші до банківської мережі. Номери карток ілюстративні.',
  ],
  [
    'Як відкрити перший рахунок?',
    'Перейдіть до «Рахунки та картки» й натисніть «Відкрити рахунок». Новий рахунок створюється з нульовим балансом. У деморежимі можна скористатися демопоповненням.',
  ],
  [
    'Як перенести попередні заявки?',
    'У розділі «Кредитні заявки» доступний імпорт із попередньої колекції Firebase /requests. Потрібен доступ до читання цієї колекції. Повторний імпорт не дублює однакові заявки.',
  ],
  [
    'Що робити в разі конфлікту збереження?',
    'Якщо дані змінилися в іншій вкладці, кабінет зупинить збереження. Натисніть «Оновити», перевірте нові суми й повторіть операцію.',
  ],
]
</script>

<template>
  <template v-if="page === 'overview'">
    <div class="overview-top">
      <section class="balance-panel">
        <div class="section-head">
          <span>Загальний баланс рахунків</span><span class="balance-symbol">↗</span>
        </div>
        <h2>{{ money(bank.total) }}</h2>
        <p>На {{ bank.data.accounts.length }} рахунках · Українська гривня</p>
        <div class="balance-actions">
          <RouterLink class="button light" to="/payments"
            ><AppIcon name="payments" :size="18" />Переказати</RouterLink
          ><button
            class="button ghost"
            :disabled="bank.busy"
            @click="open(bank.mode === 'demo' ? 'topup' : 'account')"
          >
            <AppIcon name="plus" :size="18" />{{
              bank.mode === 'demo' ? 'Поповнити' : 'Відкрити рахунок'
            }}
          </button>
        </div>
        <span class="balance-decoration"></span>
      </section>
      <section class="panel stat-panel">
        <div class="stat-icon mint">↙</div>
        <p>Надходження за {{ period }} днів</p>
        <h2>{{ money(income) }}</h2>
        <small>За історією операцій</small>
        <div class="mini-bars">
          <span
            v-for="(d, i) in chart.slice(-7)"
            :key="i"
            :style="{ height: `${12 + d.height * 0.45}px` }"
          ></span>
        </div>
      </section>
      <section class="panel stat-panel">
        <div class="stat-icon peach">↗</div>
        <p>Витрати за {{ period }} днів</p>
        <h2>{{ money(expenses) }}</h2>
        <small>Без переміщень і накопичень</small>
        <div class="mini-bars expense">
          <span
            v-for="(d, i) in chart.slice(-7)"
            :key="i"
            :style="{ height: `${12 + d.height * 0.45}px` }"
          ></span>
        </div>
      </section>
    </div>
    <div class="section-head standalone">
      <h2>Швидкі дії</h2>
      <span class="muted small-text">Менше кроків. Більше часу для себе.</span>
    </div>
    <div class="quick-actions">
      <RouterLink to="/payments"
        ><span class="quick-icon mint"><AppIcon name="payments" /></span
        ><strong>Переказати гроші</strong><AppIcon name="arrow" :size="18" /></RouterLink
      ><RouterLink to="/goals"
        ><span class="quick-icon lavender"><AppIcon name="goals" /></span
        ><strong>Відкласти на ціль</strong><AppIcon name="arrow" :size="18" /></RouterLink
      ><RouterLink to="/requests"
        ><span class="quick-icon peach"><AppIcon name="requests" /></span
        ><strong>Подати заявку</strong><AppIcon name="arrow" :size="18"
      /></RouterLink>
    </div>
    <div class="two-columns analytics-grid">
      <section class="panel">
        <div class="section-head">
          <div>
            <h2>Фінансовий пульс</h2>
            <p class="muted small-text">Витрати за останні {{ chart.length }} днів</p>
          </div>
          <select v-model.number="period" aria-label="Період аналітики">
            <option :value="7">7 днів</option>
            <option :value="30">30 днів</option>
            <option :value="90">90 днів</option>
          </select>
        </div>
        <div
          class="chart"
          role="img"
          :aria-label="chart.map((d) => `${d.day}: ${money(d.amount)}`).join('; ')"
        >
          <div v-for="(d, i) in chart" :key="i" class="chart-column">
            <div class="chart-track">
              <div
                class="chart-bar"
                :style="{ height: `${d.height}%` }"
                :title="`${d.day}: ${money(d.amount)}`"
              ></div>
            </div>
            <small v-if="i % 3 === 0 || i === chart.length - 1">{{ d.day }}</small
            ><small v-else aria-hidden="true">&nbsp;</small>
          </div>
        </div>
        <div class="chart-footer">
          <span><i></i>Витрати</span
          ><strong
            >{{ money(expenses) }} <small>за {{ period }} днів</small></strong
          >
        </div>
      </section>
      <section class="panel spending-panel">
        <div class="section-head">
          <h2>Куди йдуть гроші</h2>
          <AppIcon name="overview" :size="18" />
        </div>
        <div class="spending-content">
          <div class="donut" :style="{ background: donut }">
            <div>
              <span>Усього витрат</span><strong>{{ money(expenses) }}</strong>
            </div>
          </div>
          <div class="spending-legend">
            <div v-for="c in spending.slice(0, 5)" :key="c.name">
              <span><i :style="{ background: c.color }"></i>{{ c.name }}</span
              ><strong>{{ Math.round(c.percent) }}%</strong>
            </div>
            <p v-if="!spending.length" class="muted">Витрат за цей період немає.</p>
          </div>
        </div>
      </section>
    </div>
    <div class="two-columns bottom-grid">
      <section class="panel">
        <div class="section-head">
          <h2>Останні операції</h2>
          <RouterLink class="text-link" to="/transactions">Усі операції ↗</RouterLink>
        </div>
        <TransactionList :transactions="bank.data.transactions.slice(0, 5)" />
      </section>
      <section class="panel">
        <div class="section-head">
          <h2>Ближче до ваших цілей</h2>
          <RouterLink class="text-link" to="/goals">Усі цілі ↗</RouterLink>
        </div>
        <div v-for="g in bank.data.goals.slice(0, 2)" :key="g.id" class="goal-preview">
          <div class="goal-preview-head">
            <span class="quick-icon mint"><AppIcon name="goals" /></span>
            <div>
              <strong>{{ g.name }}</strong
              ><small>{{ Math.round((g.saved / g.target) * 100) }}% шляху вже пройдено</small>
            </div>
          </div>
          <div class="progress">
            <span :style="{ width: `${(g.saved / g.target) * 100}%` }"></span>
          </div>
          <div class="goal-amounts">
            <strong>{{ money(g.saved) }}</strong
            ><span>із {{ money(g.target) }}</span>
          </div>
        </div>
        <div v-if="!bank.data.goals.length" class="empty">
          <h3>Кожен план має початок</h3>
          <RouterLink to="/goals" class="text-link">Створити першу ціль →</RouterLink>
        </div>
        <div class="budget-note">
          <span>Бюджет на місяць</span
          ><strong>{{
            bank.data.profile.monthlyBudget ? `${budgetPercent}% використано` : 'Не задано'
          }}</strong>
          <div class="progress"><span :style="{ width: `${budgetPercent}%` }"></span></div>
          <RouterLink to="/settings">Налаштувати бюджет ↗</RouterLink>
        </div>
      </section>
    </div>
  </template>

  <template v-else-if="page === 'accounts'">
    <div class="section-head standalone">
      <div>
        <h2>Ваші рахунки</h2>
        <p class="muted">Доступний баланс {{ money(bank.total) }}</p>
      </div>
      <button class="button primary" :disabled="bank.busy" @click="open('account')">
        <AppIcon name="plus" />Відкрити рахунок
      </button>
    </div>
    <div v-if="!bank.data.accounts.length" class="panel empty">
      <h2>Почніть із першого рахунку</h2>
      <p>Створіть рахунок для щоденних витрат або накопичень.</p>
      <button class="button primary" @click="open('account')">Відкрити рахунок</button>
    </div>
    <div class="account-grid">
      <section v-for="(a, i) in bank.data.accounts" :key="a.id" class="panel account-panel">
        <div class="bank-card" :class="{ alternate: i % 2, frozen: a.frozen }">
          <div class="section-head">
            <strong>north.</strong><span>{{ a.frozen ? 'ЗАМОРОЖЕНА' : 'ЩОДНЯ' }}</span>
          </div>
          <span class="card-chip">▥</span>
          <h2>{{ money(a.balance) }}</h2>
          <div class="section-head">
            <span>•••• &nbsp; •••• &nbsp; •••• &nbsp; {{ a.number }}</span
            ><strong>UAH</strong>
          </div>
        </div>
        <div class="section-head account-title">
          <h3>{{ a.name }}</h3>
          <span class="badge" :class="a.frozen ? 'cancelled' : 'active'">{{
            a.frozen ? 'Заморожена' : 'Активна'
          }}</span>
        </div>
        <p class="muted small-text">Ілюстративна картка · Не є платіжним реквізитом</p>
        <div class="account-buttons">
          <RouterLink class="button secondary small" to="/payments">Переказати ↗</RouterLink
          ><button class="text-button" :disabled="bank.busy" @click="open('freeze', a.id)">
            {{ a.frozen ? 'Розморозити' : 'Заморозити' }}
          </button>
        </div>
      </section>
    </div>
  </template>

  <template v-else-if="page === 'payments'">
    <div class="two-columns payment-layout">
      <section class="panel payment-panel">
        <h2>Новий переказ</h2>
        <p class="muted">Оберіть рахунок і вкажіть суму.</p>
        <div class="tabs">
          <button
            :class="{ active: payment.type === 'external' }"
            :disabled="bank.busy"
            @click="setPaymentType('external')"
          >
            Отримувачу</button
          ><button
            :class="{ active: payment.type === 'internal' }"
            :disabled="bank.busy"
            @click="setPaymentType('internal')"
          >
            Між рахунками
          </button>
        </div>
        <form v-if="!confirmation" @submit.prevent="preparePayment">
          <label
            >З рахунку<select v-model="payment.from" required>
              <option disabled value="">Оберіть рахунок</option>
              <option v-for="a in activeAccounts" :key="a.id" :value="a.id">
                {{ a.name }} · {{ money(a.balance) }}
              </option>
            </select></label
          ><label v-if="payment.type === 'internal'"
            >На рахунок<select v-model="payment.to" required>
              <option disabled value="">Оберіть рахунок</option>
              <option
                v-for="a in activeAccounts.filter((a) => a.id !== payment.from)"
                :key="a.id"
                :value="a.id"
              >
                {{ a.name }}
              </option>
            </select></label
          ><label v-else
            >Отримувач<input
              v-model="payment.recipient"
              required
              maxlength="100"
              placeholder="Ім’я або назва організації" /></label
          ><label
            >Сума, ₴<input
              v-model="payment.amount"
              type="number"
              required
              min="0.01"
              max="100000000"
              step="0.01"
              placeholder="0,00"
              inputmode="decimal" /></label
          ><label
            >Коментар <span class="muted">· необов’язково</span
            ><input v-model="payment.note" maxlength="200" placeholder="Призначення переказу"
          /></label>
          <p class="inline-info">
            Переказ створює запис у кабінеті та змінює обліковий баланс. Справжні гроші не
            надсилаються.
          </p>
          <button class="button primary full" :disabled="bank.busy || !activeAccounts.length">
            Продовжити <AppIcon name="arrow" />
          </button>
        </form>
        <div v-else class="transfer-confirm">
          <span class="tag">Перевірте переказ</span>
          <h2>{{ money(cents(Number(payment.amount))) }}</h2>
          <dl>
            <dt>Отримувач</dt>
            <dd>{{ paymentInput().recipient }}</dd>
            <dt>З рахунку</dt>
            <dd>{{ bank.data.accounts.find((a) => a.id === payment.from)?.name }}</dd>
            <dt>Коментар</dt>
            <dd>{{ payment.note || '—' }}</dd>
            <dt>Комісія в кабінеті</dt>
            <dd>0 ₴</dd>
          </dl>
          <button class="button primary full" :disabled="bank.busy" @click="sendPayment">
            {{ bank.busy ? 'Зберігаємо…' : 'Підтвердити переказ' }}</button
          ><button class="text-button full" :disabled="bank.busy" @click="confirmation = false">
            Змінити дані
          </button>
        </div>
      </section>
      <aside>
        <section class="panel payment-tip">
          <span class="quick-icon mint"><AppIcon name="shield" :size="24" /></span>
          <h2>Спокій у деталях</h2>
          <p>
            Перед підтвердженням перевірте отримувача та суму. Облікова операція з’явиться в історії
            одразу після збереження.
          </p>
          <div class="tip-divider"></div>
          <h3>Між власними рахунками</h3>
          <p>
            Баланс оновлюється на обох рахунках одночасно. Такі переміщення не враховуються як
            витрати.
          </p>
          <RouterLink class="text-link" to="/transactions">Переглянути історію ↗</RouterLink>
        </section>
        <section class="help-note">
          <h3>Потрібна допомога?</h3>
          <p>Відповіді на поширені запитання завжди поруч.</p>
          <RouterLink to="/help">Відкрити допомогу →</RouterLink>
        </section>
      </aside>
    </div>
  </template>

  <template v-else-if="page === 'transactions'">
    <section class="panel">
      <div class="section-head">
        <div>
          <h2>Історія операцій</h2>
          <p class="muted small-text">Знайдено: {{ filtered.length }}</p>
        </div>
        <button class="button secondary small" :disabled="!filtered.length" @click="exportCsv">
          <AppIcon name="download" :size="16" />Експорт CSV
        </button>
      </div>
      <div class="filter-grid">
        <label>Пошук<input v-model="query" placeholder="Отримувач, категорія, коментар" /></label
        ><label
          >Рахунок<select v-model="accountFilter">
            <option value="">Усі рахунки</option>
            <option v-for="a in bank.data.accounts" :key="a.id" :value="a.id">{{ a.name }}</option>
          </select></label
        ><label
          >Категорія<select v-model="category">
            <option value="">Усі категорії</option>
            <option v-for="c in categories" :key="c">{{ c }}</option>
          </select></label
        ><label
          >Тип<select v-model="direction">
            <option value="">Усі операції</option>
            <option value="income">Надходження</option>
            <option value="expense">Витрати</option>
          </select></label
        ><label>Від дати<input v-model="fromDate" type="date" :max="toDate || undefined" /></label
        ><label>До дати<input v-model="toDate" type="date" :min="fromDate || undefined" /></label>
      </div>
      <TransactionList :transactions="paginated" />
      <div class="pagination">
        <span class="muted">Сторінка {{ currentPage }} із {{ pageCount }}</span>
        <div>
          <button
            class="button secondary small"
            :disabled="currentPage <= 1"
            @click="currentPage--"
          >
            ← Назад</button
          ><button
            class="button secondary small"
            :disabled="currentPage >= pageCount"
            @click="currentPage++"
          >
            Далі →
          </button>
        </div>
      </div>
    </section>
  </template>

  <template v-else-if="page === 'goals'">
    <div class="section-head standalone">
      <div>
        <h2>Плани стають ближчими</h2>
        <p class="muted">
          Усього відкладено {{ money(bank.savings) }} · окремо від балансу рахунків
        </p>
      </div>
      <button class="button primary" :disabled="bank.busy" @click="open('goal')">
        <AppIcon name="plus" />Створити ціль
      </button>
    </div>
    <div v-if="!bank.data.goals.length" class="panel empty">
      <span class="empty-icon">◎</span>
      <h2>На що ви мрієте накопичити?</h2>
      <p>Задайте суму й рухайтеся до цілі у своєму темпі.</p>
      <button class="button primary" @click="open('goal')">Створити першу ціль</button>
    </div>
    <div class="goal-grid">
      <section v-for="(g, i) in bank.data.goals" :key="g.id" class="panel goal-card">
        <div class="goal-illustration" :class="i % 2 ? 'lavender' : 'mint'">
          <AppIcon name="goals" :size="64" /><span>{{
            g.saved === g.target ? 'ЦІЛІ ДОСЯГНУТО' : 'ВАШ НАСТУПНИЙ КРОК'
          }}</span>
        </div>
        <h2>{{ g.name }}</h2>
        <div class="goal-amounts">
          <strong>{{ money(g.saved) }}</strong
          ><span>із {{ money(g.target) }}</span>
        </div>
        <div class="progress">
          <span :style="{ width: `${(g.saved / g.target) * 100}%` }"></span>
        </div>
        <p class="muted small-text">
          {{ Math.round((g.saved / g.target) * 100) }}% накопичено · залишилося
          {{ money(g.target - g.saved) }}
        </p>
        <button
          class="button secondary full"
          :disabled="bank.busy || g.saved === g.target || !activeAccounts.length"
          @click="open('contribute', g.id)"
        >
          {{ g.saved === g.target ? 'Готово ✓' : 'Поповнити накопичення' }}
        </button>
      </section>
    </div>
  </template>

  <template v-else-if="page === 'requests'">
    <div class="request-stats">
      <section class="panel">
        <span>Усього заявок</span><strong>{{ bank.data.requests.length }}</strong>
      </section>
      <section class="panel">
        <span>На розгляді</span
        ><strong>{{ bank.data.requests.filter((r) => r.status === 'pending').length }}</strong>
      </section>
      <section class="panel">
        <span>Сума активних</span
        ><strong>{{
          money(
            bank.data.requests
              .filter((r) => r.status === 'active')
              .reduce((n, r) => n + r.amount, 0),
          )
        }}</strong>
      </section>
    </div>
    <section class="panel">
      <div class="section-head">
        <h2>Кредитні заявки</h2>
        <button class="button primary small" :disabled="bank.busy" @click="open('request')">
          <AppIcon name="plus" :size="16" />Нова заявка
        </button>
      </div>
      <div class="filters">
        <label>Пошук<input v-model="requestQuery" placeholder="Ім’я або телефон" /></label
        ><label
          >Статус<select v-model="requestStatus">
            <option value="">Усі статуси</option>
            <option v-for="(label, key) in statuses" :key="key" :value="key">{{ label }}</option>
          </select></label
        >
      </div>
      <div v-if="!requests.length" class="empty">
        <h3>Заявок не знайдено</h3>
        <p>Змініть фільтри або створіть нову заявку.</p>
      </div>
      <div v-else class="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Клієнт</th>
              <th>Сума</th>
              <th>Статус</th>
              <th>Дата</th>
              <th>Дії</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in requests" :key="r.id">
              <td>
                <strong>{{ r.fio }}</strong
                ><small>{{ r.phone }}</small>
              </td>
              <td class="nowrap">{{ money(r.amount) }}</td>
              <td>
                <span class="badge" :class="r.status">{{ statuses[r.status] }}</span>
              </td>
              <td class="nowrap">{{ dateLabel(r.date) }}</td>
              <td>
                <div class="table-actions">
                  <button
                    class="text-button"
                    :disabled="bank.busy"
                    :aria-label="`Змінити заявку ${r.fio}`"
                    @click="open('request', r.id)"
                  >
                    Змінити</button
                  ><button
                    class="text-button danger-text"
                    :disabled="bank.busy"
                    :aria-label="`Видалити заявку ${r.fio}`"
                    @click="open('deleteRequest', r.id)"
                  >
                    Видалити
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-if="bank.mode === 'firebase'" class="legacy-note">
        <p>Є заявки з попередньої версії кабінету?</p>
        <button class="text-button" :disabled="bank.busy" @click="bank.importLegacy">
          Імпортувати з Firebase /requests ↗
        </button>
      </div>
    </section>
  </template>

  <template v-else-if="page === 'settings'">
    <div class="two-columns payment-layout">
      <section class="panel">
        <h2>Ваш профіль</h2>
        <p class="muted">Особисті налаштування фінансового кабінету.</p>
        <form @submit.prevent="saveProfile">
          <label
            >Ім’я<input
              v-model="profile.name"
              required
              minlength="2"
              maxlength="80"
              autocomplete="name" /></label
          ><label>Email<input :value="bank.data.profile.email || 'Демопрофіль'" disabled /></label
          ><label
            >Бюджет витрат на місяць, ₴<input
              v-model.number="profile.budget"
              type="number"
              min="0"
              max="100000000"
              step="0.01"
              required
          /></label>
          <p class="muted small-text">
            Укажіть 0, щоб вимкнути бюджет. Переміщення між рахунками та накопичення не включаються
            до витрат.
          </p>
          <button class="button primary" :disabled="bank.busy">
            {{ bank.busy ? 'Зберігаємо…' : 'Зберегти налаштування' }}
          </button>
        </form>
      </section>
      <section class="panel">
        <h2>Дані та підключення</h2>
        <dl class="settings-data">
          <dt>Сховище</dt>
          <dd>
            {{ bank.mode === 'firebase' ? 'Firebase Realtime Database' : 'Браузер · localStorage' }}
          </dd>
          <dt>Останнє збереження / читання</dt>
          <dd>{{ bank.syncedAt ? dateLabel(bank.syncedAt) : 'Ще не було' }}</dd>
          <dt>Валюта</dt>
          <dd>UAH · Українська гривня</dd>
        </dl>
        <button
          class="button secondary full"
          @click="
            download(JSON.stringify(bank.data, null, 2), 'north-backup.json', 'application/json')
          "
        >
          <AppIcon name="download" :size="18" />Завантажити резервну копію
        </button>
        <p class="muted small-text">
          Копія містить профіль і фінансові дані. Зберігайте її в безпечному місці.
        </p>
        <div class="tip-divider"></div>
        <h3>Доступ до облікового запису</h3>
        <p class="muted">
          Сесія Firebase зберігається на час роботи цієї вкладки. Після виходу потрібен повторний
          вхід.
        </p>
        <button class="button secondary" :disabled="bank.busy" @click="bank.logout">
          Вийти з кабінету
        </button>
      </section>
    </div>
  </template>

  <template v-else-if="page === 'help'">
    <section class="help-hero">
      <span class="tag">Центр допомоги</span>
      <h2>Розберімося разом.</h2>
      <p>Усе про ваш кабінет, дані та щоденні операції.</p>
    </section>
    <section class="panel faq">
      <h2>Поширені запитання</h2>
      <details v-for="[question, answer] in faqs" :key="question">
        <summary>{{ question }}</summary>
        <p>{{ answer }}</p>
      </details>
    </section>
  </template>

  <AppDialog v-if="modal" :title="modalTitles[modal]" :busy="bank.busy" @close="modal = ''"
    ><form @submit.prevent="saveModal">
      <template v-if="['account', 'goal', 'request'].includes(modal)"
        ><label
          >{{ modal === 'request' ? 'Повне ім’я клієнта' : 'Назва'
          }}<input
            v-model="form.name"
            autofocus
            required
            :minlength="modal === 'request' ? 3 : 1"
            maxlength="100"
            :placeholder="
              modal === 'goal'
                ? 'Наприклад, подорож'
                : modal === 'account'
                  ? 'Наприклад, на щодень'
                  : 'Прізвище Ім’я По батькові'
            " /></label></template
      ><template v-if="modal === 'request'"
        ><label
          >Телефон<input
            v-model="form.phone"
            type="tel"
            required
            maxlength="20"
            placeholder="+380 50 123 45 67" /></label
        ><label
          >Статус<select v-model="form.status">
            <option v-for="(label, key) in statuses" :key="key" :value="key">{{ label }}</option>
          </select></label
        ></template
      >
      <p v-if="modal === 'contribute'" class="muted">
        {{ selectedGoal?.name }} · залишилося
        {{ money((selectedGoal?.target ?? 0) - (selectedGoal?.saved ?? 0)) }}
      </p>
      <label v-if="modal === 'contribute' || modal === 'topup'"
        >З рахунку / на рахунок<select v-model="form.accountId" required>
          <option disabled value="">Оберіть рахунок</option>
          <option v-for="a in activeAccounts" :key="a.id" :value="a.id">
            {{ a.name }} · {{ money(a.balance) }}
          </option>
        </select></label
      ><label v-if="['goal', 'contribute', 'topup', 'request'].includes(modal)"
        >{{ modal === 'goal' ? 'Скільки хочете накопичити, ₴' : 'Сума, ₴'
        }}<input
          v-model="form.amount"
          required
          type="number"
          min="0.01"
          max="100000000"
          step="0.01"
          placeholder="0,00"
          inputmode="decimal"
      /></label>
      <p v-if="modal === 'deleteRequest'" class="muted">
        Заявку буде видалено з вашого кабінету. Цю дію неможливо скасувати.
      </p>
      <p v-if="modal === 'freeze'" class="muted">
        {{
          selectedAccount?.frozen
            ? 'Картка знову стане доступною для облікових операцій.'
            : 'Перекази та поповнення за цією карткою будуть недоступні до розморожування.'
        }}
      </p>
      <p v-if="modal === 'account'" class="inline-info">
        Обліковий рахунок створюється з нульовим балансом. Номер картки ілюстративний.
      </p>
      <p v-if="bank.error" class="alert error" role="alert">{{ bank.error }}</p>
      <div class="dialog-actions">
        <button class="button secondary" type="button" :disabled="bank.busy" @click="modal = ''">
          Скасувати</button
        ><button
          class="button"
          :class="modal === 'deleteRequest' ? 'danger' : 'primary'"
          :disabled="bank.busy"
        >
          {{ bank.busy ? 'Зберігаємо…' : modal === 'deleteRequest' ? 'Видалити' : 'Зберегти' }}
        </button>
      </div>
    </form></AppDialog
  >
</template>
