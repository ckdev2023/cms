<script setup lang="ts">
import { computed, useSlots } from "vue";

withDefaults(
  defineProps<{
    /** 卡片标题文案，与 Stitch 各区块 h3 一致 */
    title: string;
    /** 标题语义标签，便于页面大纲与无障碍 */
    titleTag?: "h2" | "h3" | "h4";
  }>(),
  { titleTag: "h3" },
);

defineOptions({ name: "CustomerSimpleSectionCard" });

const slots = useSlots();

const showIcon = computed((): boolean => typeof slots.icon === "function");
const showActions = computed((): boolean => typeof slots.actions === "function");
</script>

<template>
  <section class="customer-simple-section-card" :aria-label="title">
    <header class="customer-simple-section-card__header">
      <div
        v-if="showIcon"
        class="customer-simple-section-card__icon"
        aria-hidden="true"
      >
        <slot name="icon" />
      </div>
      <component :is="titleTag" class="customer-simple-section-card__title">
        {{ title }}
      </component>
      <div
        v-if="showActions"
        class="customer-simple-section-card__actions"
      >
        <slot name="actions" />
      </div>
    </header>
    <div class="customer-simple-section-card__body">
      <slot />
    </div>
  </section>
</template>

<style scoped lang="scss" src="./CustomerSimpleSectionCard.scoped.scss"></style>
