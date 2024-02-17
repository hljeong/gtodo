<script setup>
import { onMounted, ref, nextTick } from 'vue';
import { useStore } from 'vuex';
import {
  AutoComplete,
  Button,
  Collapse,
  CollapsePanel,
  Col,
  Input,
  List,
  ListItem,
  ListItemMeta,
  Modal,
  Row,
  Space,
  Tooltip,
} from 'ant-design-vue';
import {
  CloseOutlined,
} from '@ant-design/icons-vue';

const ep_finish = 'http://localhost:3000/v1/finish';
const ep_delete = 'http://localhost:3000/v1/delete';
const ep_add_dependency = 'http://localhost:3000/v1/add_dependency';
const ep_delete_dependency = 'http://localhost:3000/v1/delete_dependency';

const store = useStore();
const tasks = ref([]);
const displayModal = ref(false);
const modalId = ref(null);

const requirements = ref([]);
const addRequirementOptions = ref([]);
const addRequirementValue = ref('');
const addRequirementInput = ref(null);

const dependents = ref([]);
const addDependentOptions = ref([]);
const addDependentValue = ref('');
const addDependentInput = ref(null);

const post = async (endpoint, data) => {
  return fetch(
    endpoint,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    }
  );
};

onMounted(() => {
  store.dispatch('getTasks');
});

const getTask = (id) => {
  return tasks.value.filter(task => task.id === id)[0];
};


store.watch(
  () => store.getters.getTasks,
  newTasks => {
    tasks.value = newTasks.filter(
      task => task.time_finished === null
    );
    if (modalId.value !== null) {
      const task = getTask(modalId.value);
      requirements.value = task.requirements;
      dependents.value = task.dependents;
    }
  }
);

const showModal = (id) => {
  const task = getTask(id);

  requirements.value = task.requirements;
  addRequirementOptions.value = [];
  addRequirementValue.value = '';

  dependents.value = task.dependents;
  addDependentOptions.value = [];
  addDependentValue.value = '';
  
  modalId.value = id;
  displayModal.value = true;
};

const modalOk = (id) => {
  addRequirementOptions.value = [];
  addRequirementValue.value = '';

  addDependentOptions.value = [];
  addDependentValue.value = '';

  displayModal.value = false;
}

const getTaskFromDescription = description => {
  const descriptionSplit = description.split('#');
  const id = parseInt(descriptionSplit[descriptionSplit.length - 1]);
  return getTask(id);
};

const getDescription = (task) => `${task.description} #${task.id}`;

const onAddRequirementSearch = searchText => {
  if (searchText === '') {
    addRequirementOptions.value = [];
    return;
  }
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
      const showingTask = getTask(modalId.value);
      if (description.value === getDescription(showingTask)) {
        return false;
      }
      for (const taskId of showingTask.requirements) {
        if (description.value === getDescription(getTask(taskId))) {
          return false;
        }
      }
      for (const taskId of showingTask.dependents) {
        if (description.value === getDescription(getTask(taskId))) {
          return false;
        }
      }
      return true;
    }
  );
  addRequirementOptions.value = filteredDescriptions;
};

const onAddDependentSearch = searchText => {
  if (searchText === '') {
    addDependentOptions.value = [];
    return;
  }
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
      const showingTask = getTask(modalId.value);
      if (description.value === getDescription(showingTask)) {
        return false;
      }
      for (const taskId of showingTask.requirements) {
        if (description.value === getDescription(getTask(taskId))) {
          return false;
        }
      }
      for (const taskId of showingTask.dependents) {
        if (description.value === getDescription(getTask(taskId))) {
          return false;
        }
      }
      return true;
    }
  );
  addDependentOptions.value = filteredDescriptions;
};

const onAddRequirementSelect = (value, option) => {
  if ('value' in option) {
    const requirement = getTaskFromDescription(option.value);
    post(
      ep_add_dependency,
      {
        requirement: requirement.id,
        dependent: modalId.value,
      }
    ).then(() => store.dispatch('getTasks'));
    requirements.value.push(requirement.id);
  }
  addRequirementValue.value = '';
};

const onAddDependentSelect = (value, option) => {
  if ('value' in option) {
    const dependent = getTaskFromDescription(option.value);
    post(
      ep_add_dependency,
      {
        requirement: modalId.value,
        dependent: dependent.id,
      }
    ).then(() => store.dispatch('getTasks'));
    dependents.value.push(dependent.id);
  }
  addDependentValue.value = '';
};

const onDeleteRequirementClick = id => {
  post(
    ep_delete_dependency,
    {
      requirement: id,
      dependent: modalId.value,
    }
  ).then(() => store.dispatch('getTasks'));
  requirements.value = requirements.value.filter(taskId => taskId !== id);
};

const onDeleteDependentClick = id => {
  post(
    ep_delete_dependency,
    {
      requirement: modalId.value,
      dependent: id,
    }
  ).then(() => store.dispatch('getTasks'));
  dependents.value = dependents.value.filter(taskId => taskId !== id);
};

const clickAddRequirement = () => {
  nextTick(() => {
    addRequirementInput.value.focus();
  });
};

const clickAddDependent = () => {
  nextTick(() => {
    addDependentInput.value.focus();
  });
};

const finish = async (id) => {
  store.dispatch('removeTask', id);
  post(ep_finish, { id: id })
    .then(() => store.dispatch('getTasks'));
};

const deleteTask = async (id) => {
  store.dispatch('removeTask', id);
  post(ep_delete, { id: id })
    .then(() => store.dispatch('getTasks'));
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
      <ListItem class="child-show-on-hover rounded-corners hover-highlight">
        <template #actions>
          <Space>
            <Button
              class="show-on-hover hover-highlight-text click-highlight-text"
              type="danger"
              @click="showModal(item.id)"
            >
              dependency
            </Button>
            <!-- <Button type="primary" @click="finish(item.id)">Finish</Button> -->
            <Button
              class="show-on-hover hover-highlight-text click-highlight-text"
              type="danger"
              @click="deleteTask(item.id)"
            >
              delete
            </Button>
          </Space>
        </template>
        <Space>
          <p style="font-size: 1.25rem;">
            <span>{{ item.description }}</span>
            <span style="color: #666;"> #{{ item.id }}</span>
          </p>
        </Space>
      </ListItem>
    </template>
  </List>
  <Modal
    v-model:open="displayModal"
    @ok="modalOk()"
  >
    <Space direction="vertical" style="width: 100%;">
      <Space>
        <h3>
          <span style="font-weight: bold;">{{ modalId === null ? 'details' : getTask(modalId).description }}</span>
          <span style="font-weight: bold; color: #666;"> #{{ modalId === null ? '' : getTask(modalId).id }}</span>
        </h3>
      </Space>

      <Space
        direction="vertical"
        :size="0"
        style="width: 100%;"
      >
        <h4 class="rounded-corners" style="font-weight: bold;">requirements:</h4>

        <template
          v-if="modalId !== null"
          v-for="taskId of requirements"
        >
          <div
            class="child-show-on-hover rounded-corners hover-highlight"
            style="width: 100%; display: flex; align-items: center;"
          >
            <p>
              <span>{{ getTask(taskId).description }}</span>
              <span style="color: #666;"> #{{ getTask(taskId).id }}</span>
            </p>

            <div style="flex: 1;">
              <close-outlined
                class="show-on-hover close"
                style="float: right;"
                @click="() => onDeleteRequirementClick(taskId)"
              />
            </div>
          </div>
        </template>

        <AutoComplete
          ref="addRequirementInput"
          v-model:value="addRequirementValue"
          style="width: 100%;"
          :options="addRequirementOptions"
          @search="onAddRequirementSearch"
          @select="onAddRequirementSelect"
        >
          <Input
            class="rounded-corners hover-highlight active-highlight"
            :bordered="false"
            :allowClear="true"
            placeholder="add requirement..."
          />
        </AutoComplete>
      </Space>

      <Space
        direction="vertical"
        :size="0"
        style="width: 100%;"
      >
        <h4 class="rounded-corners" style="font-weight: bold;">dependents:</h4>

        <template
          v-if="modalId !== null"
          v-for="taskId of dependents"
        >
          <div
            class="child-show-on-hover rounded-corners hover-highlight"
            style="width: 100%; display: flex; align-items: center;"
          >
            <p>
              <span>{{ getTask(taskId).description }}</span>
              <span style="color: #666;"> #{{ getTask(taskId).id }}</span>
            </p>

            <div style="flex: 1;">
              <close-outlined
                class="show-on-hover close"
                style="float: right;"
                @click="() => onDeleteDependentClick(taskId)"
              />
            </div>
          </div>
        </template>

        <AutoComplete
          ref="addDependentInput"
          v-model:value="addDependentValue"
          style="width: 100%;"
          :options="addDependentOptions"
          @search="onAddDependentSearch"
          @select="onAddDependentSelect"
        >
          <Input
            class="rounded-corners hover-highlight active-highlight"
            :bordered="false"
            :allowClear="true"
            placeholder="add dependent..."
          />
        </AutoComplete>
      </Space>
    </Space>

    <template #footer>
      <Button
        key="ok"
        type="primary"
        @click="modalOk"
      >
        OK
      </Button>
    </template>
  </Modal>
</template>

<style scoped>

.rounded-corners {
  border-radius: 4px;
  padding: 3px 6px;
}

.hover-highlight:hover {
  cursor: pointer;
  background-color: #444;
}

.close {
  color: #666;
}

.close:hover {
  cursor: pointer;
  color: #888;
}

.close:active {
  color: #444;
}

.hover-highlight-text:hover {
  color: #ae96cc;
}

.active-highlight:active {
  cursor: text;
  background-color: #444;
}

.click-highlight-text:active {
  color: #6e5581;
}

.show-on-hover {
  opacity: 0%;
  transition: opacity 0.3s ease;
}

.child-show-on-hover:hover * .show-on-hover {
  opacity: 100%;
  transition: opacity 0.5s ease;
}

</style>
