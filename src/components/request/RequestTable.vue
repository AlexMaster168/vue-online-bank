<template>
   <h4 v-if="requests.length === 0" class="text-center">Заявок пока нет</h4>
   <table v-else class="table">
      <thead>
      <tr>
         <th>#</th>
         <th>ФИО</th>
         <th>Телефон</th>
         <th>Задолженость</th>
         <th>Статус</th>
         <th>Действие</th>
      </tr>
      </thead>
      <tbody>
      <tr v-for="(r, idx) in requests" :key="r.id">
         <td>{{ idx + 1 }}</td>
         <td>{{ r.fio }}</td>
         <td>{{ r.phone }}</td>
         <td>{{ r.amount }}</td>
         <td>{{ r.status }}</td>
      </tr>
      </tbody>
   </table>
</template>

<script>

export default {
   props: ["requests"],
}
</script>

<style scoped>

</style>