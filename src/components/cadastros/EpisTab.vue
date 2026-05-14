<script setup>
import { computed, inject, ref, watch } from 'vue'
import { useItems } from '../../composables/useItems.js'
import { useRoles } from '../../composables/useRoles.js'
import { usePeople } from '../../composables/usePeople.js'
import { useMovements } from '../../composables/useMovements.js'
import { useEpis } from '../../composables/useEpis.js'
import { useToast } from '../../composables/useToast.js'
import AttributeBadges from '../ui/AttributeBadges.vue'

const emit = defineEmits(['quick-movement'])
const isLoggedIn = inject('isLoggedIn')
const { items, variations } = useItems()
const { activeRoles } = useRoles()
const { activePeople } = usePeople()
const { movements } = useMovements()
const {
  roleRules,
  periodicities,
  activeRoleRules,
  activePeriodicities,
  addRoleRule,
  editRoleRule,
  deleteRoleRule,
  addPeriodicity,
  editPeriodicity,
  deletePeriodicity,
} = useEpis()
const { success, error } = useToast()

const activeTab = ref('cargo')
const selectedRoleName = ref('')
const selectedPersonId = ref('')
const selectedRuleTarget = ref(null)
const selectedPeriodTarget = ref(null)
const newPeriodDays = ref(30)
const periodDrafts = ref({})
const selectorOpen = ref(false)
const selectorContext = ref('rule')
const selectorSearch = ref('')
const selectorScope = ref('levels')
const selectedGroup = ref('')
const selectedCategory = ref('')
const selectedSubcategory = ref('')
const selectedItemId = ref('')
const modalSelectedTarget = ref(null)

watch(activeRoles, roles => {
  if (!selectedRoleName.value && roles.length) selectedRoleName.value = roles[0].name
}, { immediate: true })

watch(activePeople, people => {
  if (!selectedPersonId.value && people.length) selectedPersonId.value = people[0].id
}, { immediate: true })

const targetTypeRank = { grupo: 1, categoria: 2, subcategoria: 3, item: 4, variacao: 5 }
const targetTypeLabels = {
  grupo: 'Grupo',
  categoria: 'Categoria',
  subcategoria: 'Subcategoria',
  item: 'Item',
  variacao: 'Variacao',
}
const DIRECT_ITEMS_SUBCATEGORY = 'Itens diretos'

const itemById = computed(() => new Map(items.value.map(item => [item.id, item])))

function hierarchy(item) {
  return [item.group, item.category, item.subcategory].filter(Boolean).join(' > ')
}

function variationLabel(variation, item) {
  const attrs = (item?.attributes || [])
    .map(attr => variation.values?.[attr] ? `${attr}: ${variation.values[attr]}` : '')
    .filter(Boolean)
  const extras = Object.entries(variation.extras || {})
    .filter(([, value]) => value)
    .map(([key, value]) => `${key}: ${value}`)
  return [...attrs, ...extras].join(' / ') || 'Sem atributos'
}

function makeGroupTarget(group) {
  return { targetType: 'grupo', targetKey: group, targetLabel: group }
}

function makeCategoryTarget(group, category) {
  return { targetType: 'categoria', targetKey: `${group}|${category}`, targetLabel: `${group} > ${category}` }
}

function makeSubcategoryTarget(group, category, subcategory) {
  return { targetType: 'subcategoria', targetKey: `${group}|${category}|${subcategory}`, targetLabel: `${group} > ${category} > ${subcategory}` }
}

function makeItemTarget(item) {
  return {
    targetType: 'item',
    targetKey: item.id,
    targetLabel: `${hierarchy(item)} > ${item.name}`.replace(/^ > /, ''),
    itemId: item.id,
  }
}

function makeVariationTarget(variation, item) {
  return {
    targetType: 'variacao',
    targetKey: variation.id,
    targetLabel: `${item.name} - ${variationLabel(variation, item)}`,
    itemId: item.id,
    variationId: variation.id,
  }
}

function targetVariationRow(target) {
  if (target?.targetType !== 'variacao') return null
  const variation = variations.value.find(row => row.id === target.targetKey)
  const item = variation ? itemById.value.get(variation.itemId) : null
  return variation && item ? { variation, item } : null
}

const catalogTargets = computed(() => {
  const targets = []
  const seen = new Set()
  function add(target) {
    const id = `${target.targetType}:${target.targetKey}`
    if (seen.has(id)) return
    seen.add(id)
    targets.push(target)
  }

  for (const item of items.value) {
    if (item.group) add(makeGroupTarget(item.group))
    if (item.group && item.category) add(makeCategoryTarget(item.group, item.category))
    if (item.group && item.category && item.subcategory) {
      add(makeSubcategoryTarget(item.group, item.category, item.subcategory))
    }
    add(makeItemTarget(item))
  }

  for (const variation of variations.value) {
    const item = itemById.value.get(variation.itemId)
    if (!item) continue
    add(makeVariationTarget(variation, item))
  }

  return targets.sort((a, b) =>
    targetTypeRank[a.targetType] - targetTypeRank[b.targetType] ||
    a.targetLabel.localeCompare(b.targetLabel, 'pt-BR', { sensitivity: 'base', numeric: true })
  )
})

function filterTargets(search) {
  const q = String(search || '').trim().toLowerCase()
  if (!q) return catalogTargets.value.slice(0, 16)
  return catalogTargets.value
    .filter(target =>
      target.targetLabel.toLowerCase().includes(q) ||
      targetTypeLabels[target.targetType].toLowerCase().includes(q)
    )
    .slice(0, 20)
}

const modalSearchTargets = computed(() =>
  filterTargets(selectorSearch.value)
    .filter(target => selectorScope.value === 'levels' || target.targetType === 'variacao')
)

const groups = computed(() =>
  [...new Set(items.value.map(item => item.group).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base', numeric: true }))
)

const categoriesForGroup = computed(() =>
  [...new Set(items.value
    .filter(item => item.group === selectedGroup.value)
    .map(item => item.category)
    .filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base', numeric: true }))
)

const subcategoriesForCategory = computed(() =>
  {
    const scopedItems = items.value.filter(item =>
      item.group === selectedGroup.value &&
      item.category === selectedCategory.value
    )
    const subcategories = [...new Set(scopedItems.map(item => item.subcategory).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base', numeric: true }))
    if (subcategories.length && scopedItems.some(item => !item.subcategory)) {
      return [...subcategories, DIRECT_ITEMS_SUBCATEGORY]
    }
    return subcategories
  }
)

const itemsForSelection = computed(() =>
  {
    const hasSubcategories = subcategoriesForCategory.value.length > 0
    return items.value
      .filter(item => {
        if (!selectedGroup.value || item.group !== selectedGroup.value) return false
        if (!selectedCategory.value || item.category !== selectedCategory.value) return false
        if (selectedSubcategory.value === DIRECT_ITEMS_SUBCATEGORY) return !item.subcategory
        if (hasSubcategories && selectedSubcategory.value) return item.subcategory === selectedSubcategory.value
        if (hasSubcategories && !selectedSubcategory.value) return false
        return true
      })
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base', numeric: true }))
  }
)

const variationsForSelectedItem = computed(() =>
  variations.value
    .filter(variation => variation.itemId === selectedItemId.value)
    .map(variation => ({ variation, item: itemById.value.get(variation.itemId) }))
    .filter(row => row.item)
)

const modalSelectedLabel = computed(() =>
  modalSelectedTarget.value?.targetLabel || 'Nenhum EPI selecionado'
)

function itemStock(item) {
  return variations.value
    .filter(variation => variation.itemId === item.id)
    .reduce((sum, variation) => sum + Number(variation.stock || 0), 0)
}

function itemsInGroup(group) {
  return items.value.filter(item => item.group === group)
}

function itemsInCategory(category) {
  return items.value.filter(item => item.group === selectedGroup.value && item.category === category)
}

function itemsInSubcategory(subcategory) {
  return items.value.filter(item => {
    if (item.group !== selectedGroup.value || item.category !== selectedCategory.value) return false
    if (subcategory === DIRECT_ITEMS_SUBCATEGORY) return !item.subcategory
    return item.subcategory === subcategory
  })
}

function stockTotal(list) {
  return list.reduce((sum, item) => sum + itemStock(item), 0)
}

function openSelector(context) {
  selectorContext.value = context
  selectorSearch.value = ''
  selectorScope.value = 'levels'
  modalSelectedTarget.value = context === 'rule' ? selectedRuleTarget.value : selectedPeriodTarget.value
  selectorOpen.value = true
}

function closeSelector() {
  selectorOpen.value = false
}

function setModalTarget(target) {
  if (selectorScope.value === 'variations' && target.targetType !== 'variacao') return
  modalSelectedTarget.value = target
}

function confirmSelector() {
  if (!modalSelectedTarget.value) return
  if (selectorContext.value === 'rule') selectedRuleTarget.value = modalSelectedTarget.value
  else selectedPeriodTarget.value = modalSelectedTarget.value
  selectorOpen.value = false
}

function selectGroup(group) {
  selectedGroup.value = group
  selectedCategory.value = ''
  selectedSubcategory.value = ''
  selectedItemId.value = ''
  if (selectorScope.value === 'levels') setModalTarget(makeGroupTarget(group))
}

function selectCategory(category) {
  selectedCategory.value = category
  selectedSubcategory.value = ''
  selectedItemId.value = ''
  if (selectorScope.value === 'levels') setModalTarget(makeCategoryTarget(selectedGroup.value, category))
}

function selectSubcategory(subcategory) {
  selectedSubcategory.value = subcategory
  selectedItemId.value = ''
  if (selectorScope.value === 'levels') setModalTarget(makeSubcategoryTarget(selectedGroup.value, selectedCategory.value, subcategory))
}

function selectItem(item) {
  selectedItemId.value = item.id
  if (selectorScope.value === 'levels') setModalTarget(makeItemTarget(item))
}

function resetSelectorPath(level = 'root') {
  if (level === 'root') {
    selectedGroup.value = ''
    selectedCategory.value = ''
    selectedSubcategory.value = ''
    selectedItemId.value = ''
    modalSelectedTarget.value = null
    return
  }
  if (level === 'group') {
    selectedCategory.value = ''
    selectedSubcategory.value = ''
    selectedItemId.value = ''
    if (selectorScope.value === 'levels') setModalTarget(makeGroupTarget(selectedGroup.value))
    return
  }
  if (level === 'category') {
    selectedSubcategory.value = ''
    selectedItemId.value = ''
    if (selectorScope.value === 'levels') setModalTarget(makeCategoryTarget(selectedGroup.value, selectedCategory.value))
    return
  }
  selectedItemId.value = ''
  if (selectorScope.value === 'levels') setModalTarget(makeSubcategoryTarget(selectedGroup.value, selectedCategory.value, selectedSubcategory.value))
}

const rulesForRole = computed(() =>
  roleRules.value.filter(rule => rule.roleName === selectedRoleName.value)
)

const selectedPerson = computed(() =>
  activePeople.value.find(person => person.id === selectedPersonId.value) || null
)

const selectedPersonRules = computed(() => {
  const role = selectedPerson.value?.role || ''
  return activeRoleRules.value.filter(rule => rule.roleName.toLowerCase() === role.toLowerCase())
})

function movementPersonMatches(movement, person) {
  if (!person || movement.type !== 'saida') return false
  if (movement.requestedByPersonId) return movement.requestedByPersonId === person.id
  return String(movement.requestedBy || '').trim().toLowerCase() === person.name.toLowerCase()
}

function targetMatchesMovement(target, movement) {
  if (!target || !movement) return false
  if (target.targetType === 'grupo') return movement.itemGroup === target.targetKey
  if (target.targetType === 'categoria') return `${movement.itemGroup || ''}|${movement.itemCategory || ''}` === target.targetKey
  if (target.targetType === 'subcategoria') return `${movement.itemGroup || ''}|${movement.itemCategory || ''}|${movement.itemSubcategory || ''}` === target.targetKey
  if (target.targetType === 'item') return movement.itemId === target.targetKey
  if (target.targetType === 'variacao') return movement.variationId === target.targetKey
  return false
}

function targetFromRule(rule) {
  return {
    targetType: rule.targetType,
    targetKey: rule.targetKey,
    targetLabel: rule.targetLabel,
  }
}

function periodForMovement(movement) {
  return activePeriodicities.value
    .filter(period => targetMatchesMovement(period, movement))
    .sort((a, b) => targetTypeRank[b.targetType] - targetTypeRank[a.targetType])[0] || null
}

function addDays(date, days) {
  const next = new Date(date)
  next.setDate(next.getDate() + Number(days || 0))
  return next
}

function formatDate(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleDateString('pt-BR')
}

function epiStatus(record) {
  if (!record.movement) return 'Pendente'
  if (!record.dueDate) return 'Em dia'
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(record.dueDate)
  due.setHours(0, 0, 0, 0)
  const daysLeft = Math.ceil((due - today) / 86400000)
  if (daysLeft < 0) return 'Vencido'
  if (daysLeft <= 7) return 'Vence em breve'
  return 'Em dia'
}

const personEpiRecords = computed(() => {
  const person = selectedPerson.value
  if (!person) return []
  return selectedPersonRules.value.map(rule => {
    const movement = movements.value
      .filter(m => movementPersonMatches(m, person) && targetMatchesMovement(targetFromRule(rule), m))
      .slice()
      .sort((a, b) => new Date(b.date) - new Date(a.date))[0] || null
    const period = movement ? periodForMovement(movement) : activePeriodicities.value.find(p => p.targetType === rule.targetType && p.targetKey === rule.targetKey)
    const dueDate = movement && period ? addDays(movement.date, period.days) : null
    const record = { rule, movement, period, dueDate }
    return { ...record, status: epiStatus(record) }
  })
})

function statusClass(status) {
  if (status === 'Vencido') return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
  if (status === 'Vence em breve') return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'
  if (status === 'Pendente') return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
  return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
}

async function onAddRule() {
  if (!isLoggedIn?.value) return
  if (!selectedRuleTarget.value) { error('Selecione um EPI.'); return }
  const result = await addRoleRule(selectedRoleName.value, selectedRuleTarget.value)
  if (!result.ok) { error(result.error); return }
  success('EPI vinculado ao cargo.')
  selectedRuleTarget.value = null
}

async function onToggleRule(rule) {
  const result = await editRoleRule(rule.id, { active: !rule.active })
  if (!result.ok) error(result.error)
}

async function onDeleteRule(rule) {
  if (!confirm(`Remover "${rule.targetLabel || rule.targetKey}" deste cargo?`)) return
  await deleteRoleRule(rule.id)
  success('Vinculo removido.')
}

async function onAddPeriodicity() {
  if (!isLoggedIn?.value) return
  if (!selectedPeriodTarget.value) { error('Selecione um EPI.'); return }
  const result = await addPeriodicity(selectedPeriodTarget.value, Number(newPeriodDays.value))
  if (!result.ok) { error(result.error); return }
  success('Periodicidade cadastrada.')
  selectedPeriodTarget.value = null
  newPeriodDays.value = 30
}

async function onUpdatePeriodicity(period) {
  const days = Number(periodDrafts.value[period.id] ?? period.days)
  const result = await editPeriodicity(period.id, { days })
  if (!result.ok) { error(result.error); return }
  success('Periodicidade atualizada.')
}

async function onTogglePeriodicity(period) {
  const result = await editPeriodicity(period.id, { active: !period.active })
  if (!result.ok) error(result.error)
}

async function onDeletePeriodicity(period) {
  if (!confirm(`Excluir periodicidade de "${period.targetLabel || period.targetKey}"?`)) return
  await deletePeriodicity(period.id)
  success('Periodicidade removida.')
}

function quickMovement(record) {
  const target = catalogTargets.value.find(t => t.targetType === record.rule.targetType && t.targetKey === record.rule.targetKey)
  if (target?.variationId && target?.itemId) {
    emit('quick-movement', { type: 'saida', itemId: target.itemId, variationId: target.variationId })
    return
  }
  emit('quick-movement', { type: 'saida' })
}
</script>

<template>
  <div>
    <div class="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 class="text-base font-semibold text-gray-900 dark:text-gray-100">EPIs</h2>
        <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">Obrigatoriedade por cargo, periodicidade e controle por pessoa.</p>
      </div>
      <div class="inline-flex rounded-lg bg-gray-100 p-1 dark:bg-gray-800">
        <button
          v-for="tab in [{ id: 'cargo', label: 'Por cargo' }, { id: 'periodos', label: 'Periodicidades' }, { id: 'pessoas', label: 'Por pessoa' }]"
          :key="tab.id"
          type="button"
          class="rounded-md px-3 py-1.5 text-sm font-medium transition-colors"
          :class="activeTab === tab.id ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-gray-100' : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100'"
          @click="activeTab = tab.id"
        >{{ tab.label }}</button>
      </div>
    </div>

    <section v-if="activeTab === 'cargo'" class="grid gap-4 lg:grid-cols-[22rem_1fr]">
      <aside class="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
        <label class="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Cargo</label>
        <select v-model="selectedRoleName" class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100">
          <option value="">Selecione um cargo</option>
          <option v-for="role in activeRoles" :key="role.id" :value="role.name">{{ role.name }}</option>
        </select>

        <div class="mt-4">
          <label class="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Adicionar EPI</label>
          <button
            type="button"
            class="w-full rounded-lg border border-gray-300 bg-white px-3 py-3 text-left text-sm transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:hover:bg-gray-700"
            @click="openSelector('rule')"
          >
            <span class="block text-xs font-semibold uppercase tracking-wider text-gray-400">{{ selectedRuleTarget ? targetTypeLabels[selectedRuleTarget.targetType] : 'EPI' }}</span>
            <span class="mt-1 block truncate font-medium text-gray-900 dark:text-gray-100">{{ selectedRuleTarget?.targetLabel || 'Selecionar por blocos do catalogo' }}</span>
          </button>
          <button type="button" class="mt-3 w-full rounded-lg bg-primary-600 px-3 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-gray-300" :disabled="!selectedRoleName || !selectedRuleTarget" @click="onAddRule">Adicionar ao cargo</button>
        </div>
      </aside>

      <div class="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
        <div class="border-b border-gray-200 px-4 py-3 dark:border-gray-700">
          <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">EPIs obrigatorios de {{ selectedRoleName || 'cargo' }}</h3>
        </div>
        <div v-if="rulesForRole.length" class="divide-y divide-gray-100 dark:divide-gray-700">
          <article v-for="rule in rulesForRole" :key="rule.id" class="flex flex-wrap items-center justify-between gap-3 px-4 py-3" :class="{ 'opacity-60': !rule.active }">
            <div>
              <span class="text-[11px] font-semibold uppercase tracking-wider text-gray-400">{{ targetTypeLabels[rule.targetType] }}</span>
              <template v-if="targetVariationRow(rule)">
                <p class="text-sm font-semibold text-gray-900 dark:text-gray-100">{{ targetVariationRow(rule).item.name }}</p>
                <AttributeBadges class="mt-1" :item="targetVariationRow(rule).item" :variation="targetVariationRow(rule).variation" compact />
              </template>
              <p v-else class="text-sm font-semibold text-gray-900 dark:text-gray-100">{{ rule.targetLabel || rule.targetKey }}</p>
            </div>
            <div class="flex items-center gap-2">
              <button type="button" class="rounded-full px-2 py-1 text-xs font-semibold" :class="rule.active ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-300'" @click="onToggleRule(rule)">{{ rule.active ? 'Ativo' : 'Inativo' }}</button>
              <button type="button" class="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700" @click="onDeleteRule(rule)">Excluir</button>
            </div>
          </article>
        </div>
        <div v-else class="p-8 text-sm text-gray-500 dark:text-gray-400">Nenhum EPI vinculado a este cargo.</div>
      </div>
    </section>

    <section v-else-if="activeTab === 'periodos'" class="grid gap-4 lg:grid-cols-[22rem_1fr]">
      <aside class="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
        <label class="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">EPI</label>
        <button
          type="button"
          class="w-full rounded-lg border border-gray-300 bg-white px-3 py-3 text-left text-sm transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:hover:bg-gray-700"
          @click="openSelector('period')"
        >
          <span class="block text-xs font-semibold uppercase tracking-wider text-gray-400">{{ selectedPeriodTarget ? targetTypeLabels[selectedPeriodTarget.targetType] : 'EPI' }}</span>
          <span class="mt-1 block truncate font-medium text-gray-900 dark:text-gray-100">{{ selectedPeriodTarget?.targetLabel || 'Selecionar por blocos do catalogo' }}</span>
        </button>
        <label class="mb-1 mt-4 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Dias para troca</label>
        <input v-model.number="newPeriodDays" type="number" min="1" step="1" class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100" />
        <button type="button" class="mt-3 w-full rounded-lg bg-primary-600 px-3 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-gray-300" :disabled="!selectedPeriodTarget || !newPeriodDays" @click="onAddPeriodicity">Salvar periodicidade</button>
      </aside>

      <div class="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
        <div class="border-b border-gray-200 px-4 py-3 dark:border-gray-700">
          <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">Periodicidades cadastradas</h3>
        </div>
        <div v-if="periodicities.length" class="divide-y divide-gray-100 dark:divide-gray-700">
          <article v-for="period in periodicities" :key="period.id" class="grid gap-3 px-4 py-3 md:grid-cols-[1fr_8rem_auto]" :class="{ 'opacity-60': !period.active }">
            <div>
              <span class="text-[11px] font-semibold uppercase tracking-wider text-gray-400">{{ targetTypeLabels[period.targetType] }}</span>
              <template v-if="targetVariationRow(period)">
                <p class="text-sm font-semibold text-gray-900 dark:text-gray-100">{{ targetVariationRow(period).item.name }}</p>
                <AttributeBadges class="mt-1" :item="targetVariationRow(period).item" :variation="targetVariationRow(period).variation" compact />
              </template>
              <p v-else class="text-sm font-semibold text-gray-900 dark:text-gray-100">{{ period.targetLabel || period.targetKey }}</p>
            </div>
            <input v-model.number="periodDrafts[period.id]" :placeholder="String(period.days)" type="number" min="1" step="1" class="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100" />
            <div class="flex flex-wrap items-center gap-2">
              <button type="button" class="rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-700" @click="onUpdatePeriodicity(period)">Atualizar</button>
              <button type="button" class="rounded-full px-2 py-1 text-xs font-semibold" :class="period.active ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-300'" @click="onTogglePeriodicity(period)">{{ period.active ? 'Ativo' : 'Inativo' }}</button>
              <button type="button" class="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700" @click="onDeletePeriodicity(period)">Excluir</button>
            </div>
          </article>
        </div>
        <div v-else class="p-8 text-sm text-gray-500 dark:text-gray-400">Nenhuma periodicidade cadastrada.</div>
      </div>
    </section>

    <section v-else class="grid gap-4 lg:grid-cols-[22rem_1fr]">
      <aside class="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
        <label class="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Pessoa</label>
        <select v-model="selectedPersonId" class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100">
          <option value="">Selecione uma pessoa</option>
          <option v-for="person in activePeople" :key="person.id" :value="person.id">{{ person.name }}{{ person.role ? ` - ${person.role}` : '' }}</option>
        </select>
        <div class="mt-4 rounded-lg bg-gray-50 p-3 text-sm dark:bg-gray-800/60">
          <p class="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">Cargo atual</p>
          <p class="mt-1 font-semibold text-gray-900 dark:text-gray-100">{{ selectedPerson?.role || '-' }}</p>
        </div>
      </aside>

      <div class="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
        <div class="border-b border-gray-200 px-4 py-3 dark:border-gray-700">
          <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">Controle de EPI de {{ selectedPerson?.name || 'pessoa' }}</h3>
        </div>
        <div v-if="personEpiRecords.length" class="divide-y divide-gray-100 dark:divide-gray-700">
          <article v-for="record in personEpiRecords" :key="record.rule.id" class="grid gap-3 px-4 py-3 lg:grid-cols-[1fr_10rem_10rem_9rem_auto]">
            <div>
              <span class="text-[11px] font-semibold uppercase tracking-wider text-gray-400">{{ targetTypeLabels[record.rule.targetType] }}</span>
              <template v-if="targetVariationRow(record.rule)">
                <p class="text-sm font-semibold text-gray-900 dark:text-gray-100">{{ targetVariationRow(record.rule).item.name }}</p>
                <AttributeBadges class="mt-1" :item="targetVariationRow(record.rule).item" :variation="targetVariationRow(record.rule).variation" compact />
              </template>
              <p v-else class="text-sm font-semibold text-gray-900 dark:text-gray-100">{{ record.rule.targetLabel || record.rule.targetKey }}</p>
              <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ record.movement ? `${record.movement.itemName} - ${record.movement.qty} ${record.movement.itemUnit}` : 'Nenhuma saida registrada' }}</p>
            </div>
            <div>
              <p class="text-xs text-gray-500 dark:text-gray-400">Entrega</p>
              <p class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ formatDate(record.movement?.date) }}</p>
            </div>
            <div>
              <p class="text-xs text-gray-500 dark:text-gray-400">Vencimento</p>
              <p class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ formatDate(record.dueDate) }}</p>
            </div>
            <div class="flex items-center">
              <span class="rounded-full px-2 py-1 text-xs font-semibold" :class="statusClass(record.status)">{{ record.status }}</span>
            </div>
            <div class="flex items-center justify-end">
              <button type="button" class="rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-700" @click="quickMovement(record)">Registrar saida</button>
            </div>
          </article>
        </div>
        <div v-else class="p-8 text-sm text-gray-500 dark:text-gray-400">
          Nenhum EPI obrigatorio encontrado para o cargo desta pessoa.
        </div>
      </div>
    </section>

    <Teleport to="body">
      <div
        v-if="selectorOpen"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
        @click.self="closeSelector"
      >
        <section class="flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900">
          <header class="flex flex-wrap items-start justify-between gap-3 border-b border-gray-200 p-4 dark:border-gray-700">
            <div>
              <p class="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                {{ selectorContext === 'rule' ? 'Selecionar EPI para cargo' : 'Selecionar EPI para periodicidade' }}
              </p>
              <h3 class="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100">Catálogo em blocos</h3>
            </div>
            <button
              type="button"
              class="rounded-lg bg-gray-100 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
              @click="closeSelector"
            >Fechar</button>
          </header>

          <div class="border-b border-gray-200 p-4 dark:border-gray-700">
            <div class="grid gap-3 lg:grid-cols-[1fr_auto]">
              <input
                v-model="selectorSearch"
                type="search"
                placeholder="Pesquisar grupo, categoria, item ou variação..."
                class="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              />
              <div class="inline-flex rounded-lg bg-gray-100 p-1 dark:bg-gray-800">
                <button
                  type="button"
                  class="rounded-md px-3 py-1.5 text-sm font-semibold transition-colors"
                  :class="selectorScope === 'levels' ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400'"
                  @click="selectorScope = 'levels'"
                >Níveis específicos</button>
                <button
                  type="button"
                  class="rounded-md px-3 py-1.5 text-sm font-semibold transition-colors"
                  :class="selectorScope === 'variations' ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400'"
                  @click="selectorScope = 'variations'; if (modalSelectedTarget?.targetType !== 'variacao') modalSelectedTarget = null"
                >Só variações</button>
              </div>
            </div>
          </div>

          <div class="min-h-0 flex-1 overflow-auto p-4">
            <div v-if="selectorSearch.trim()" class="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
              <button
                v-for="target in modalSearchTargets"
                :key="`${target.targetType}:${target.targetKey}`"
                type="button"
                class="rounded-lg border p-3 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-800"
                :class="modalSelectedTarget?.targetType === target.targetType && modalSelectedTarget?.targetKey === target.targetKey
                  ? 'border-primary-500 bg-primary-50 text-primary-900 dark:bg-primary-900/20 dark:text-primary-100'
                  : 'border-gray-200 text-gray-900 dark:border-gray-700 dark:text-gray-100'"
                @click="setModalTarget(target)"
              >
                <span class="block text-[11px] font-semibold uppercase tracking-wider text-gray-400">{{ targetTypeLabels[target.targetType] }}</span>
                <template v-if="targetVariationRow(target)">
                  <span class="mt-1 block text-sm font-semibold">{{ targetVariationRow(target).item.name }}</span>
                  <AttributeBadges class="mt-2" :item="targetVariationRow(target).item" :variation="targetVariationRow(target).variation" compact />
                </template>
                <span v-else class="mt-1 block text-sm font-semibold">{{ target.targetLabel }}</span>
              </button>
            </div>

            <div v-else class="space-y-4">
              <div v-if="selectedGroup" class="flex flex-wrap items-center gap-1.5 text-sm">
                <button type="button" class="font-medium text-primary-600 hover:underline dark:text-primary-400" @click="resetSelectorPath('root')">Catálogo</button>
                <svg class="h-3.5 w-3.5 flex-shrink-0 text-gray-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" /></svg>
                <button
                  v-if="selectedCategory"
                  type="button"
                  class="font-medium text-primary-600 hover:underline dark:text-primary-400"
                  @click="resetSelectorPath('group')"
                >{{ selectedGroup }}</button>
                <span v-else class="font-semibold text-gray-900 dark:text-gray-100">{{ selectedGroup }}</span>
                <template v-if="selectedCategory">
                  <svg class="h-3.5 w-3.5 flex-shrink-0 text-gray-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" /></svg>
                  <button
                    v-if="selectedSubcategory || selectedItemId"
                    type="button"
                    class="font-medium text-primary-600 hover:underline dark:text-primary-400"
                    @click="resetSelectorPath('category')"
                  >{{ selectedCategory }}</button>
                  <span v-else class="font-semibold text-gray-900 dark:text-gray-100">{{ selectedCategory }}</span>
                </template>
                <template v-if="selectedSubcategory">
                  <svg class="h-3.5 w-3.5 flex-shrink-0 text-gray-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" /></svg>
                  <button
                    v-if="selectedItemId"
                    type="button"
                    class="font-medium text-primary-600 hover:underline dark:text-primary-400"
                    @click="resetSelectorPath('subcategory')"
                  >{{ selectedSubcategory }}</button>
                  <span v-else class="font-semibold text-gray-900 dark:text-gray-100">{{ selectedSubcategory }}</span>
                </template>
              </div>

              <div v-if="!selectedGroup" class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                <button
                  v-for="group in groups"
                  :key="group"
                  type="button"
                  class="group cursor-pointer rounded-lg border border-gray-200 bg-white p-5 text-left transition-all hover:border-primary-400 hover:shadow-md dark:border-gray-700 dark:bg-gray-800 dark:hover:border-primary-500"
                  @click="selectGroup(group)"
                >
                  <div class="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary-50 transition-colors group-hover:bg-primary-100 dark:bg-primary-900/30 dark:group-hover:bg-primary-900/50">
                    <svg class="h-5 w-5 text-primary-600 dark:text-primary-400" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" />
                    </svg>
                  </div>
                  <p class="mb-1 truncate text-sm font-bold text-gray-800 dark:text-gray-100">{{ group }}</p>
                  <p class="text-xs text-gray-400 dark:text-gray-500">
                    {{ itemsInGroup(group).length }} {{ itemsInGroup(group).length === 1 ? 'item' : 'itens' }} · Estoque: {{ stockTotal(itemsInGroup(group)) }}
                  </p>
                </button>
              </div>

              <div v-else-if="!selectedCategory" class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                <button
                  v-for="category in categoriesForGroup"
                  :key="category"
                  type="button"
                  class="group cursor-pointer rounded-lg border border-gray-200 bg-white p-5 text-left transition-all hover:border-primary-400 hover:shadow-md dark:border-gray-700 dark:bg-gray-800 dark:hover:border-primary-500"
                  @click="selectCategory(category)"
                >
                  <div class="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary-50 transition-colors group-hover:bg-primary-100 dark:bg-primary-900/30 dark:group-hover:bg-primary-900/50">
                    <svg class="h-5 w-5 text-primary-600 dark:text-primary-400" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" />
                    </svg>
                  </div>
                  <p class="mb-1 truncate text-sm font-bold text-gray-800 dark:text-gray-100">{{ category }}</p>
                  <p class="text-xs text-gray-400 dark:text-gray-500">
                    {{ itemsInCategory(category).length }} {{ itemsInCategory(category).length === 1 ? 'item' : 'itens' }} · Estoque: {{ stockTotal(itemsInCategory(category)) }}
                  </p>
                </button>
              </div>

              <div v-else-if="subcategoriesForCategory.length && !selectedSubcategory" class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                <button
                  v-for="subcategory in subcategoriesForCategory"
                  :key="subcategory"
                  type="button"
                  class="group cursor-pointer rounded-lg border border-gray-200 bg-white p-5 text-left transition-all hover:border-primary-400 hover:shadow-md dark:border-gray-700 dark:bg-gray-800 dark:hover:border-primary-500"
                  @click="selectSubcategory(subcategory)"
                >
                  <div class="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary-50 transition-colors group-hover:bg-primary-100 dark:bg-primary-900/30 dark:group-hover:bg-primary-900/50">
                    <svg class="h-5 w-5 text-primary-600 dark:text-primary-400" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" d="m21 7.5-9-5.25L3 7.5m18 0-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
                    </svg>
                  </div>
                  <p class="mb-1 truncate text-sm font-bold text-gray-800 dark:text-gray-100">{{ subcategory }}</p>
                  <p class="text-xs text-gray-400 dark:text-gray-500">
                    {{ itemsInSubcategory(subcategory).length }} {{ itemsInSubcategory(subcategory).length === 1 ? 'item' : 'itens' }} · Estoque: {{ stockTotal(itemsInSubcategory(subcategory)) }}
                  </p>
                </button>
              </div>

              <div v-else-if="!selectedItemId" class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                <button
                  v-for="item in itemsForSelection"
                  :key="item.id"
                  type="button"
                  class="group cursor-pointer rounded-lg border border-gray-200 bg-white p-4 text-left transition-all hover:border-primary-400 hover:shadow-md dark:border-gray-700 dark:bg-gray-800 dark:hover:border-primary-500"
                  @click="selectItem(item)"
                >
                  <p class="mb-1 truncate text-sm font-semibold text-gray-800 dark:text-gray-100">{{ item.name }}</p>
                  <p class="mb-1 truncate text-xs text-gray-400 dark:text-gray-500">{{ hierarchy(item) || 'Sem hierarquia' }}</p>
                  <p class="text-xs text-gray-400 dark:text-gray-500">
                    {{ variations.filter(variation => variation.itemId === item.id).length }} var. · Estoque: {{ itemStock(item) }}
                  </p>
                </button>
                <p v-if="!itemsForSelection.length" class="rounded-xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                  Nenhum item neste nível.
                </p>
              </div>

              <div v-else>
                <div v-if="variationsForSelectedItem.length" class="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
                  <table class="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-700">
                    <thead class="bg-gray-50 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:bg-gray-800/70 dark:text-gray-400">
                      <tr>
                        <th class="px-4 py-3">Variação</th>
                        <th class="px-4 py-3 text-right">Estoque</th>
                        <th class="px-4 py-3 text-right">Ação</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-100 bg-white dark:divide-gray-800 dark:bg-gray-900">
                      <tr
                        v-for="{ variation, item } in variationsForSelectedItem"
                        :key="variation.id"
                        class="cursor-pointer transition-colors hover:bg-primary-50/70 dark:hover:bg-primary-950/20"
                        @click="setModalTarget(makeVariationTarget(variation, item))"
                      >
                        <td class="px-4 py-3 text-gray-900 dark:text-gray-100">
                          <p class="font-semibold">{{ item?.name }}</p>
                          <AttributeBadges class="mt-1" :item="item" :variation="variation" compact />
                        </td>
                        <td class="px-4 py-3 text-right font-semibold" :class="variation.stock > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500'">
                          {{ variation.stock }} {{ item?.unit }}
                        </td>
                        <td class="px-4 py-3 text-right">
                          <button
                            type="button"
                            class="rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-700"
                            @click.stop="setModalTarget(makeVariationTarget(variation, item))"
                          >
                            Selecionar
                          </button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p v-else class="rounded-xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                  Nenhuma variação encontrada.
                </p>
              </div>
            </div>
          </div>

          <footer class="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 p-4 dark:border-gray-700">
            <div class="min-w-0">
              <p class="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Selecionado</p>
              <template v-if="targetVariationRow(modalSelectedTarget)">
                <p class="text-sm font-semibold text-gray-900 dark:text-gray-100">{{ targetVariationRow(modalSelectedTarget).item.name }}</p>
                <AttributeBadges class="mt-1" :item="targetVariationRow(modalSelectedTarget).item" :variation="targetVariationRow(modalSelectedTarget).variation" compact />
              </template>
              <p v-else class="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">{{ modalSelectedLabel }}</p>
            </div>
            <button
              type="button"
              class="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-gray-300"
              :disabled="!modalSelectedTarget"
              @click="confirmSelector"
            >Usar seleção</button>
          </footer>
        </section>
      </div>
    </Teleport>
  </div>
</template>
