<script setup>
import { onMounted, ref } from 'vue';
import { useStore } from 'vuex';
import {
  AutoComplete,
  Button,
  Collapse,
  CollapsePanel,
  Col,
  List,
  ListItem,
  ListItemMeta,
  Modal,
  Row,
  Space,
  Tooltip,
} from 'ant-design-vue';

const store = useStore();
const tasks = ref([]);
const displayModal = ref(false);
const showingModal = ref(null);
const modalValue = ref('');
const options = ref([]);
const modalSelected = ref(null);

onMounted(() => {
  store.dispatch('getTasks');
});

store.watch(
  () => store.getters.getTasks,
  newTasks => {
    tasks.value = newTasks.filter(
      task => !('time_finished' in task)
    );
  }
);

const getTask = (id) => {
  return tasks.value.filter(task => task.id === id)[0];
};

const showModal = (id) => {
  modalValue.value = '';
  modalSelected.value = null;
  displayModal.value = true;
  showingModal.value = id;
};

const modalOk = (id) => {
  displayModal.value = false;
  showingModal.value = null;
  modalSelected.value = null;
}

const modalCancel = (id) => {
  displayModal.value = false;
  showingModal.value = null;
  modalSelected.value = null;
}

const getTaskFromDescription = description => {
  const descriptionSplit = description.split('#');
  const id = parseInt(descriptionSplit[descriptionSplit.length - 1]);
  return getTask(id);
};

const getDescription = (task) => `${task.description} #${task.id}`;

const onChange = value => {
  modalSelected.value = null;
};

const onSearch = searchText => {
  const descriptions = tasks.value.map(task => {
    return {
      value: getDescription(task),
    };
  });
  const searchSequence = searchText.trim().split(' ');
  const filteredDescriptions = descriptions.filter(
    description => {
      const descriptionSequence = description.value.split(' ');
      for (let i = 0, j = 0; j < searchSequence.length; ++j) {
        const searchWord = searchSequence[j];
        while (
          i < descriptionSequence.length && !(
              descriptionSequence[i] === searchWord || (
                j === searchSequence.length - 1 &&
                descriptionSequence[i].startsWith(searchWord)
              )
            )
          ) {
          ++i;
        }
        if (i === descriptionSequence.length) {
          return false;
        }
      }
      return true;
    }
  ).filter(
    description => {
      const showingTask = getTask(showingModal.value);
      if (description.value === getDescription(showingTask)) {
        return false;
      }
      if ('requires' in showingTask) {
        for (const taskId of showingTask.requires) {
          if (description.value === getDescription(getTask(taskId))) {
            return false;
          }
        }
      }
      if ('required_by' in showingTask) {
        for (const taskId of showingTask.required_by) {
          if (description.value === getDescription(getTask(taskId))) {
            return false;
          }
        }
      }
      return true;
    }
  );
  options.value = filteredDescriptions;
};

const onSelect = description => {
  modalSelected.value = getTaskFromDescription(description);
};

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

const deleteTask = async (id) => {
  store.dispatch('removeTask', id);
  fetch(
    'http://localhost:3000/v1/delete',
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
      <!-- <ListItem @click="finish(item.id)"> -->
      <ListItem class="item rounded-corners hover-highlight">
        <template #actions>
          <Space>
            <Button
              class="show-on-hover-item hover-highlight-text click-highlight-text"
              type="danger"
              @click="showModal(item.id)"
            >
              dependency
            </Button>
            <!-- <Button type="primary" @click="finish(item.id)">Finish</Button> -->
            <Button
              class="show-on-hover-item hover-highlight-text click-highlight-text"
              type="danger"
              @click="deleteTask(item.id)"
            >
              delete
            </Button>
          </Space>
        </template>
        <Space>
          <h3>{{ item.description }}</h3>
          <h3 style="color: #666;">#{{ item.id }}</h3>
        </Space>
      </ListItem>
    </template>
  </List>
  <Modal
    v-model:open="displayModal"
    @ok="modalOk()"
    @cancel="modalCancel()"
  >
    <Space direction="vertical" style="width: 100%;">
      <Space>
        <h3 style="font-weight: bold;">{{ showingModal === null ? 'details' : getTask(showingModal).description }}</h3>
        <h3 style="font-weight: bold; color: #666;">#{{ showingModal === null ? '' : getTask(showingModal).id }}</h3>
      </Space>
      <AutoComplete
        v-model:value="modalValue"
        style="width: 100%;"
        :options="options"
        placeholder="add requirement or dependent..."
        :allow-clear="true"
        @change="onChange"
        @search="onSearch"
        @select="onSelect"
      />

      <Row>
        <Tooltip placement="topLeft">
          <template #title v-if="modalSelected !== null">add requirement</template>
          <Col
            :class="modalSelected === null ? 'rounded-corners' : 'rounded-corners hover-highlight'"
            :span="12"
          >
            <h4 class="rounded-corners" style="font-weight: bold;">requires:</h4>
            <template
              v-if="showingModal !== null"
              v-for="taskId in getTask(showingModal).requires"
            >
              <p :class="modalSelected === null ? 'rounded-corners hover-highlight' : 'rounded-corners'">
                {{ `${getTask(taskId).description} #${taskId}` }}
              </p>
            </template>
          </Col>
        </Tooltip>

        <Tooltip placement="topLeft">
          <template #title v-if="modalSelected !== null">add dependent</template>
          <Col
            :class="modalSelected === null ? 'rounded-corners' : 'rounded-corners hover-highlight'"
            :span="12"
          >
            <h4 class="rounded-corners" style="font-weight: bold;">required by:</h4>
            <template
              v-if="showingModal !== null"
              v-for="taskId in getTask(showingModal).required_by"
            >
              <p :class="modalSelected === null ? 'rounded-corners hover-highlight' : 'rounded-corners'">
                {{ `${getTask(taskId).description} #${taskId}` }}
              </p>
            </template>
          </Col>
        </Tooltip>
      </Row>
    </Space>
  </Modal>
</template>

<style scoped>

.rounded-corners {
  border-radius: 4px;
  padding: 4px;
}

.hover-highlight:hover {
  cursor: pointer;
  background-color: #444;
}

.hover-highlight-text:hover {
  color: #ae96cc;
}

.click-highlight-text:active {
  color: #6e5581;
}

.show-on-hover-item {
  opacity: 0%;
  transition: opacity 0.3s ease;
}

.item:hover .show-on-hover-item {
  opacity: 100%;
  transition: opacity 0.5s ease;
}

</style>
