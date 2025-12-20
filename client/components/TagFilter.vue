<template>
  <div class="tag-filter">
    <div class="filter-tags">
      <span
        v-for="tag in availableTags"
        :key="tag"
        class="filter-tag"
        :class="{ active: selectedTags.includes(tag) }"
        @click="toggleTag(tag)"
      >
        {{ tag }}
      </span>
    </div>
    <div class="filter-input-wrapper" v-if="showInput">
      <el-input
        v-model="inputValue"
        placeholder="输入标签筛选..."
        size="small"
        clearable
        @keyup.enter="addCustomTag"
        class="filter-input"
      >
        <template #prefix><k-icon name="search"></k-icon></template>
      </el-input>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

const props = withDefaults(defineProps<{
  /** v-model 绑定值 */
  modelValue: string[]
  /** 所有可用的标签（从数据中提取） */
  allTags: string[]
  /** 预置的常用标签（始终显示） */
  presetTags?: string[]
  /** 是否显示输入框 */
  showInput?: boolean
  /** 最多显示多少个动态标签 */
  maxDynamicTags?: number
}>(), {
  modelValue: () => [],
  presetTags: () => [],
  showInput: true,
  maxDynamicTags: 20
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string[]): void
  (e: 'change', value: string[]): void
}>()

const selectedTags = computed({
  get: () => props.modelValue,
  set: (val) => {
    emit('update:modelValue', val)
    emit('change', val)
  }
})

const inputValue = ref('')

// 合并预置标签和动态标签
const availableTags = computed(() => {
  const dynamicTags = props.allTags
    .filter(t => !props.presetTags.includes(t))
    .slice(0, props.maxDynamicTags)

  // 预置标签在前，动态标签在后
  return [...props.presetTags, ...dynamicTags]
})

const toggleTag = (tag: string) => {
  const current = [...selectedTags.value]
  const index = current.indexOf(tag)
  if (index >= 0) {
    current.splice(index, 1)
  } else {
    current.push(tag)
  }
  selectedTags.value = current
}

const addCustomTag = () => {
  const tag = inputValue.value.trim()
  if (tag && !selectedTags.value.includes(tag)) {
    selectedTags.value = [...selectedTags.value, tag]
  }
  inputValue.value = ''
}
</script>

<style scoped>
.tag-filter {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
}

.filter-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.filter-tag {
  padding: 4px 12px;
  font-size: 0.85rem;
  border-radius: 16px;
  border: 1px solid var(--k-color-border);
  background-color: transparent;
  color: var(--k-color-text-description);
  cursor: pointer;
  transition: all 0.2s ease;
  user-select: none;
}

.filter-tag:hover {
  border-color: var(--k-color-active);
  color: var(--k-color-active);
}

.filter-tag.active {
  background-color: var(--k-color-active);
  border-color: var(--k-color-active);
  color: white;
}

.filter-input-wrapper {
  flex-shrink: 0;
}

.filter-input {
  width: 180px;
}
</style>
