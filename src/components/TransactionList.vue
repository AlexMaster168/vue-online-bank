<script setup lang="ts">
import { dateLabel, money } from '../domain'
import type { Transaction } from '../domain'
defineProps<{ transactions: Transaction[] }>()
const colors: Record<string, string> = {
  Продукти: 'peach',
  Надходження: 'mint',
  Підписки: 'lavender',
  Ресторани: 'peach',
  Транспорт: 'blue',
  Покупки: 'lavender',
  Перекази: 'blue',
  Накопичення: 'mint',
}
</script>
<template>
  <div v-if="!transactions.length" class="empty">
    <span class="empty-icon">↔</span>
    <h3>Операцій поки немає</h3>
    <p>Тут з’явиться історія ваших переказів і поповнень.</p>
  </div>
  <div v-else class="transaction-list">
    <div v-for="t in transactions" :key="t.id" class="transaction-row">
      <span class="merchant-icon" :class="colors[t.category] || 'mint'">{{
        t.amount > 0 ? '↙' : t.recipient.slice(0, 1).toUpperCase()
      }}</span>
      <div class="transaction-name">
        <strong>{{ t.recipient }}</strong
        ><small
          >{{ t.category }}<span v-if="t.note"> · {{ t.note }}</span></small
        >
      </div>
      <time :datetime="t.date">{{ dateLabel(t.date) }}</time
      ><strong class="transaction-amount" :class="{ positive: t.amount > 0 }"
        >{{ t.amount > 0 ? '+' : '−' }}{{ money(Math.abs(t.amount)) }}</strong
      >
    </div>
  </div>
</template>
