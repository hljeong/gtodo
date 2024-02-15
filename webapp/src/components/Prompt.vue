<script setup>
import { ref } from 'vue';
import { useStore } from 'vuex';
import {
  Button,
  Input,
  InputGroup,
  Space
} from 'ant-design-vue';

const store = useStore();
const input = ref('');

const add = async () => {
  if (input.value === '') return;

  const task = { description: input.value };
  store.dispatch('addTask', task)
    .then(() => store.dispatch('getTasks'));
  input.value = '';
};
</script>

<template>
  <Input
    v-model:value="input"
    type="text"
    placeholder="to do..."
    size="large"
    :style="{ fontSize: '24px', height: '64px', width: '40%' }"
    @pressEnter="add"
  />
</template>
