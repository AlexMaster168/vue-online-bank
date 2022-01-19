const formatter = new Intl.NumberFormat('ru-RU', {currency: 'UAN', style: 'currency'})

export function currency(value) {
  return formatter.format(value)
}