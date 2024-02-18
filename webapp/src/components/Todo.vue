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
  Switch,
  Tooltip,
} from 'ant-design-vue';
import {
  CheckOutlined,
  CloseOutlined,
  FormOutlined,
  SettingOutlined,
} from '@ant-design/icons-vue';


const ep_finish = 'http://localhost:3000/v1/finish';
const ep_delete = 'http://localhost:3000/v1/delete';
const ep_add_dependency = 'http://localhost:3000/v1/add_dependency';
const ep_delete_dependency = 'http://localhost:3000/v1/delete_dependency';

const store = useStore();

const tasks = ref([]);
const displayedTasks = ref([]);

const promptInput = ref('');

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

const showBlocked = ref(false);
const showFinished = ref(false);

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

const add = async () => {
  if (promptInput.value === '') return;

  const task = { description: promptInput.value };
  store.dispatch('addTask', task)
    .then(() => store.dispatch('getTasks'));
  promptInput.value = '';
};

onMounted(() => {
  store.dispatch('getTasks');
});

const getTask = (id) => {
  return tasks.value.filter(task => task.id === id)[0];
};

const updateDisplayedTasks = () => {
  displayedTasks.value = tasks.value;
  if (!showBlocked.value) {
    displayedTasks.value = displayedTasks.value.filter(
      task => task.requirements.every(
        requirement => requirement.finished
      )
    );
  }
  if (!showFinished.value) {
    displayedTasks.value = displayedTasks.value.filter(
      task => !task.finished
    );
  }
};

store.watch(
  () => store.getters.getTasks,
  newTasks => {
    tasks.value = newTasks;
    updateDisplayedTasks();
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
  <div id="container">
    <Input
      v-model:value="promptInput"
      type="text"
      placeholder="to do..."
      size="large"
      style="fontSize: 24px; height: 56px; width: 40%;"
      @pressEnter="add"
    />
    <div style="height: 30px" />
    <List
      :dataSource="displayedTasks"
      :style="{ width: '65%' }"
      :split="false"
    >
      <template #renderItem="{ item }">
        <ListItem class="child-show-on-hover rounded-corners hover-highlight">
          <Space>
            <check-outlined
              class="show-on-hover clickable-icon"
              style="font-size: 1.25rem; padding-top: 4px;"
              @click="finish(item.id)"
            />
            <p style="font-size: 1.25rem;">
              <span>{{ item.description }}</span>
              <span style="color: #666;"> #{{ item.id }}</span>
            </p>
          </Space>

          <Space style="float: right;">
            <form-outlined
              class="show-on-hover clickable-icon"
              style="font-size: 1.25rem; padding-top: 4px;"
              @click="showModal(item.id)"
            />
            <close-outlined
              class="show-on-hover clickable-icon"
              style="font-size: 1.25rem; padding-top: 4px;"
              @click="deleteTask(item.id)"
            />
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
  </div>
  <div id="settings-panel" class="child-rotate-on-hover child-show-on-hover">
    <Space direction="vertical" size="large">
      <setting-outlined
        class="rotate-on-hover"
        style="float: right; font-size: 36px; color: #444;"
      />

      <Space class="show-on-hover-1">
        <span style="font-family: Poppins; font-size: 16px;">
          show blocked tasks
        </span>
        <Switch
          v-model:checked="showBlocked"
          @change="updateDisplayedTasks"
        />
      </Space>

      <Space class="show-on-hover-2">
        <span style="font-family: Poppins; font-size: 16px;">
          show finished tasks
        </span>
        <Switch
          v-model:checked="showFinished"
          @change="updateDisplayedTasks"
        />
      </Space>
    </Space>
  </div>
</template>

<style scoped>

#container {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 30px;
}

#settings-panel {
  position: fixed;
  height: 100%;
  right: 20px;
  top: 20px;
  align-items: right;
}

.rounded-corners {
  border-radius: 4px;
  padding: 3px 6px;
}

.hover-highlight:hover {
  cursor: pointer;
  background-color: #444;
}

.clickable-icon {
  color: #666;
}

.clickable-icon:hover {
  cursor: pointer;
  color: #888;
}

.clickable-icon:active {
  color: #444;
}

.hover-highlight-text:hover {
  color: #ae96cc;
}

.active-highlight:active {
  cursor: text;
  background-color: #444;
}

.rotate-on-hover {
  transform: rotate(0deg);
  transition: transform 0.8s ease-out;
}

.child-rotate-on-hover:hover .rotate-on-hover {
  transform: rotate(180deg);
  transition: transform 0.5s ease;
}

.show-on-hover {
  opacity: 0%;
  transition: opacity 0.3s ease;
}

.child-show-on-hover:hover .show-on-hover {
  opacity: 100%;
  transition: opacity 0.5s ease;
}

.show-on-hover-1 {
  opacity: 0%;
  transition: opacity 0.6s ease;
}

.child-show-on-hover:hover .show-on-hover-1 {
  opacity: 100%;
  transition: opacity 0.4s ease;
}

.show-on-hover-2 {
  opacity: 0%;
  transition: opacity 0.3s ease;
}

.child-show-on-hover:hover .show-on-hover-2 {
  opacity: 100%;
  transition: opacity 0.8s ease;
}

</style>
