<template>
   <app-loader v-if="loading" />
   <app-page title="Список долгов клиентов" v-else>
      <template #header>
         <button class="btn primary" @click="modal = true">Создать</button>
      </template>

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

export default {
   setup() {
      const store = useStore()
      const loading = ref(false)
      const modal = ref(false)
      const requests = computed(() => store.getters["request/requests"])

      onMounted(async () => {
         loading.value = true
         await store.dispatch('request/load')
         loading.value = false
      })
      return {
         modal, requests, loading
      }
   },
   components: { AppLoader, RequestModal, AppModal, RequestTable, AppPage },
}
</script>
