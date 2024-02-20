<script setup>
import { Transition } from 'vue';
import TaskList from './TaskList.vue';
import gsap from 'gsap';

const props = defineProps([
  'show',
  'label',
  'tasks',
  'showTags',
  'editTask',
  'deleteTask',
  'finishTask',
  'taskExists',
  'isBlocked',
  'isParent',
]);

const onBeforeEnter = el => {
  el.style.opacity = 0;
  el.style.height = 0;
  el.style.padding = '0px 6px';
};

const onEnter = (el, done) => {
  gsap.to(el, {
    opacity: 1,
    height: 'auto',
    padding: '3px 6px',
    delay: 0.5,
    onComplete: done
  });
};

const onLeave = (el, done) => {
  if ('tasks' in el) {
    el.tasks = [];
  }
  gsap.to(el, {
    opacity: 0,
    height: 0,
    padding: '0px 6px',
    delay: 0.5,
    onComplete: done
  });
};
</script>

<template>
  <Transition
    :css="false"
    @before-enter="onBeforeEnter"
    @enter="onEnter"
    @leave="onLeave"
  >
    <template v-if="props.show">
      <div style="height: 30px;" />
    </template>
  </Transition>

  <Transition
    :css="false"
    @before-enter="onBeforeEnter"
    @enter="onEnter"
    @leave="onLeave"
  >
    <template v-if="props.show">
      <p class="label">{{ props.label }}:</p>
    </template>
  </Transition>

  <Transition
    :css="false"
    @before-enter="onBeforeEnter"
    @enter="onEnter"
    @leave="onLeave"
  >
    <template v-if="props.show">
      <TaskList
        :tasks="props.tasks"
        :showTags="props.showTags"
        :editTask="props.editTask"
        :deleteTask="props.deleteTask"
        :finishTask="props.finishTask"
        :taskExists="props.taskExists"
        :isBlocked="props.isBlocked"
        :isParent="props.isParent"
      />
    </template>
  </Transition>
</template>

<style scoped>

.label {
  border-radius: 4px;
  padding: 3px 6px;
  width: 65%;
  font-family: Poppins;
  font-weight: bold;
  font-size: 1.2rem;
  padding-left: 4px;
}

</style>
