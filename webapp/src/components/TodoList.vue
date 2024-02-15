<script setup>
import { onMounted, ref } from 'vue';
import { useStore } from 'vuex';
import {
  Button,
  Collapse,
  CollapsePanel,
  List,
  ListItem,
  ListItemMeta,
  Space,
} from 'ant-design-vue';

const store = useStore();
const tasks = ref([]);

onMounted(() => {
  store.dispatch('getTasks');
});

store.watch(
  () => store.getters.getTasks,
  newTasks => tasks.value = newTasks.filter(
    task => !('time_finished' in task)
  )
);

const finish = async (id) => {
  store.dispatch('removeTask', id);
  fetch(
    'http://localhost:3000/v1/finish',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id: id,
      }),
    }
  ).then(() => store.dispatch('getTasks'));
};
</script>

<template>
  <List
    :dataSource="tasks"
    :style="{ width: '65%' }"
    :split="false"
  >
    <template #renderItem="{ item }">
      <ListItem>
        <template #actions>
          <Space>
            <Button type="primary" @click="finish(item.id)">Finish</Button>
            <Button type="danger" @click="console.log(item.id)">Delete</Button>
          </Space>
        </template>
        <ListItemMeta
          :title="item.description"
        />
      </ListItem>
    </template>
  </List>
</template>
