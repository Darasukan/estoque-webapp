<script setup>
import { computed } from 'vue'
import ItemCard from './ItemCard.vue'

const props = defineProps({
  category: { type: Object, required: true }
})

// Flatten all items from category + subcategories into one list
const allItems = computed(() => {
  const items = [...(props.category.items || [])]
  for (const sub of props.category.subcategories || []) {
    items.push(...(sub.items || []))
  }
  return items
})
</script>

<template>
  <section>
    <!-- Category header -->
    <h2 class="text-xl font-bold text-gray-800 dark:text-gray-100 border-b-2 border-gray-200 dark:border-gray-700 pb-1.5 mb-4">
      {{ category.name }}
    </h2>

    <!-- All items in a single grid -->
    <div v-if="allItems.length" class="flex flex-wrap gap-2.5">
      <ItemCard v-for="item in allItems" :key="item.id" :item="item" />
    </div>

    <p v-else class="text-sm text-gray-400 dark:text-gray-500 italic">
      Nenhum item nesta categoria.
    </p>
  </section>
</template>
