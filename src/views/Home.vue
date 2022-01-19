<template>
   <app-loader v-if="loading" />
   <app-page title="Список долгов клиентов" v-else>
      <template #header>
         <button class="btn primary" @click="modal = true">Создать</button>
      </template>

      <request-filter v-model="filter"></request-filter>
      <request-table :requests="requests"></request-table>

      <teleport to="body">
         <app-modal v-if="modal" title="Создать заявку" @close="modal = false">
            <request-modal @created="modal = false" />
         </app-modal>
      </teleport>
   </app-page>

</template>

<script>
import AppPage from "@/components/ui/AppPage"
import RequestTable from "@/components/request/RequestTable"
import { ref, onMounted, computed } from "vue"
import AppModal from "@/components/ui/AppModal"
import RequestModal from "@/components/request/RequestModal"
import { useStore } from "vuex"
import AppLoader from "@/components/ui/AppLoader"
import RequestFilter from "@/components/request/RequestFilter"

export default {
   setup() {
      const store = useStore()
      const loading = ref(false)
      const filter = ref({})
      const modal = ref(false)
      const requests = computed(() => store.getters["request/requests"]
      .filter(request => {
         if (filter.value.name) {
            return request.fio.includes(filter.value.name)
         }
         return request
      })
         .filter(request => {
            if (filter.value.status) {
               return filter.value.status === request.status
            }
            return request
         })
      )

      onMounted(async () => {
         loading.value = true
         await store.dispatch('request/load')
         loading.value = false
      })
      return {
         modal, requests, loading, filter
      }
   },
   components: { RequestFilter, AppLoader, RequestModal, AppModal, RequestTable, AppPage },
}
</script>
