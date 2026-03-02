<script setup>
import ItemCard from './ItemCard.vue'

defineProps({
  subcategory: { type: Object, required: true },
  categoryId: { type: String, required: true }
})

defineEmits(['edit-subcategory', 'delete-subcategory', 'add-item', 'edit-item', 'delete-item'])
</script>

<template>
  <div class="mb-5">
    <!-- Subcategory header -->
    <div class="flex items-center gap-2 mb-2.5">
      <h3
        v-if="subcategory.name"
        class="text-sm font-bold text-gray-800 dark:text-gray-200"
      >
        {{ subcategory.name }}
      </h3>
      <span v-else class="text-sm italic text-gray-400 dark:text-gray-500">(sem nome)</span>

      <button
        class="text-xs text-amber-500 hover:text-amber-600 transition-colors"
        title="Editar subcategoria"
        @click="$emit('edit-subcategory', subcategory)"
      >✎</button>
      <button
        class="text-xs text-red-500 hover:text-red-600 transition-colors"
        title="Excluir subcategoria"
        @click="$emit('delete-subcategory', subcategory)"
      >✕</button>
    </div>

    <!-- Items grid -->
    <div class="flex flex-wrap gap-2.5">
      <ItemCard
        v-for="item in subcategory.items"
        :key="item.id"
        :item="item"
        @edit="$emit('edit-item', $event)"
        @delete="$emit('delete-item', $event)"
      />

      <!-- Add item button -->
      <div class="w-20 flex flex-col items-center">
        <div
          class="w-[70px] h-[70px] border-2 border-dashed border-primary-400 dark:border-primary-500 bg-primary-50 dark:bg-primary-950 rounded flex items-center justify-center cursor-pointer hover:bg-primary-100 dark:hover:bg-primary-900 transition-colors"
          title="Adicionar item"
          @click="$emit('add-item')"
        >
          <svg class="w-6 h-6 text-primary-500 dark:text-primary-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
        </div>
        <span class="text-[10px] text-primary-500 dark:text-primary-400 mt-1">Novo Item</span>
      </div>
    </div>
  </div>
</template>
