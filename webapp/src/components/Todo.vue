<script setup>
import { onMounted, ref, nextTick } from 'vue';
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
  Tag,
  Tooltip,
} from 'ant-design-vue';
import {
  CheckOutlined,
  CloseOutlined,
  FormOutlined,
  PlusOutlined,
  SettingOutlined,
} from '@ant-design/icons-vue';


const ep_tasks = 'http://localhost:3000/v1/tasks'
const ep_add = 'http://localhost:3000/v1/add'
const ep_finish = 'http://localhost:3000/v1/finish';
const ep_delete = 'http://localhost:3000/v1/delete';
const ep_add_dependency = 'http://localhost:3000/v1/add_dependency';
const ep_delete_dependency = 'http://localhost:3000/v1/delete_dependency';
const ep_add_tag = 'http://localhost:3000/v1/add_tag';
const ep_delete_tag = 'http://localhost:3000/v1/delete_tag';
const ep_update = 'http://localhost:3000/v1/update';

const allTasks = ref([]);
const taskIndex = ref({});
const unfinishedTasks = ref([]);
const activeTasks = ref([]);
const blockedTasks = ref([]);
const finishedTasks = ref([]);
const filteredActiveTasks = ref([]);
const filteredBlockedTasks = ref([]);
const filteredFinishedTasks = ref([]);

const allTags = ref([]);
const allTagOptions = ref([]);

const promptInput = ref('');

const filterTags = ref([]);
const addFilterTagOptions = ref([]);
const addFilterTagValue = ref('');

const displayModal = ref(false);
const modalId = ref(null);

const editDescription = ref(false);
const editDescriptionInput = ref(null);
const editDescriptionValue = ref('');

const addTagOptions = ref([]);
const addTagValue = ref('');

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
const showTags = ref(true);

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

const getTask = id => {
  if (!(id in taskIndex.value)) throw new Error(`task #${id} does not exist`);
  return taskIndex.value[id];
};

const indexTasks = () => {
  taskIndex.value = {};
  for (const task of allTasks.value) {
    taskIndex.value[task.id] = task;
  }
};

const updateTasks = () => {
  finishedTasks.value = allTasks.value.filter(
    task => task.finished
  );

  unfinishedTasks.value = allTasks.value.filter(
    task => !task.finished
  );

  blockedTasks.value = unfinishedTasks.value.filter(
    task => task.requirements.some(
      requirement => !requirement.finished
    )
  );

  activeTasks.value = unfinishedTasks.value.filter(
    task => !blockedTasks.value.includes(task)
  );
};

const filterTasks = () => {
  filteredActiveTasks.value = activeTasks.value.filter(
    task => filterTags.value.every(
      tag => task.tags.includes(tag)
    )
  );
  filteredBlockedTasks.value = blockedTasks.value.filter(
    task => filterTags.value.every(
      tag => task.tags.includes(tag)
    )
  );
  filteredFinishedTasks.value = finishedTasks.value.filter(
    task => filterTags.value.every(
      tag => task.tags.includes(tag)
    )
  );
};

const updateAllTags = () => {
  allTags.value = [
    ...new Set(
      [].concat(
        ...unfinishedTasks.value.map(
          task => task.tags
        )
      )
    )
  ];
  allTagOptions.value = allTags.value.map(tag => {
    return { value: tag };
  });
};

const fetchTasks = async () => {
  allTasks.value = await (await fetch(ep_tasks)).json();
  // reversed for now, todo: reorder according to policy
  allTasks.value = allTasks.value.reverse();
  indexTasks();
  updateTasks();
  filterTasks();
  updateAllTags();
  if (modalId.value !== null) {
    const task = getTask(modalId.value);
    requirements.value = task.requirements;
    dependents.value = task.dependents;
  }
};

onMounted(() => {
  fetchTasks()
    .then(() => {
      addFilterTagOptions.value = allTagOptions.value;
    });
});

const addTask = async () => {
  if (promptInput.value === '') return;

  const dummyTask = {
    id: null,
    description: promptInput.value,
    finished: false,
    time_created: null,
    time_finished: null,
    tags: filterTags.value,
    requirements: [],
    dependents: [],
    deleted: false,
  }
  allTasks.value.push(dummyTask);
  activeTasks.value.push(dummyTask);
  filterTasks();
  post(ep_add, { description: promptInput.value, tags: filterTags.value })
    .then(fetchTasks);
  promptInput.value = '';
};

const clearPrompt = () => {
  promptInput.value = '';
};

const onAddFilterTagSearch = searchText => {
  addFilterTagOptions.value = allTagOptions.value.filter(
    tag => !filterTags.value.includes(tag.value)
  ).filter(
    tag => tag.value.startsWith(searchText)
  );
};

const clearAddFilterTagValue = () => {
  addFilterTagValue.value = '';
  onAddFilterTagSearch('');
};

const onAddFilterTagSelect = (value, option) => {
  if ('value' in option) {
    const tag = option.value;
    filterTags.value.push(tag);
    filterTasks();
  }
  clearAddFilterTagValue();
};

const deleteFilterTag = tag => {
  filterTags.value = filterTags.value.filter(
    filterTag => filterTag !== tag
  );
  filterTasks();
};

const showModal = (id) => {
  const task = getTask(id);

  editDescription.value = false;
  editDescriptionValue.value = task.description;

  addTagValue.value = '';
  addTagOptions.value = allTagOptions.value.filter(
    tag => !task.tags.includes(tag.value)
  );

  requirements.value = task.requirements;
  addRequirementOptions.value = [];
  addRequirementValue.value = '';

  dependents.value = task.dependents;
  addDependentOptions.value = [];
  addDependentValue.value = '';
  
  modalId.value = id;
  displayModal.value = true;
};

const updateTask = async (id, update) => post(ep_update, { id: id, ...update });

const onModalDescriptionClick = async () => {
  editDescriptionValue.value = getTask(modalId.value).description;
  editDescription.value = true;
  await nextTick();
  editDescriptionInput.value.select();
};

const onEditDescriptionPressEnter = () => {
  const task = getTask(modalId.value);
  if (editDescriptionValue.value === '') {
    editDescription.value = false;
    editDescriptionValue.value = task.description;
  }
  task.description = editDescriptionValue.value;
  updateTask(modalId.value, { description: editDescriptionValue.value })
    .then(fetchTasks);
  
  editDescription.value = false;
};

const cancelEditDescription = () => {
  editDescription.value = false;
  editDescriptionValue.value = '';
};

const addTag = async (id, tag) => {
  const task = getTask(id);
  if (!task.tags.includes(tag)) {
    task.tags.push(tag);
  }
  post(ep_add_tag, { id: id, tag: tag })
    .then(fetchTasks);
};

const deleteTag = async (id, tag) => {
  const task = getTask(id);
  task.tags = task.tags.filter(taskTag => taskTag !== tag);
  post(ep_delete_tag, { id: id, tag: tag })
    .then(fetchTasks);
};

const clearAddTagValue = () => {
  addTagValue.value = '';
  onAddTagSearch('');
};

const onAddTagPressEnter = () => {
  if (addTagValue.value === '') return;
  addTag(modalId.value, addTagValue.value);
  clearAddTagValue();
};

const getTaskFromDescriptionWithId = description => {
  const descriptionSplit = description.split('#');
  const id = parseInt(descriptionSplit[descriptionSplit.length - 1]);
  return getTask(id);
};

const getDescriptionWithId = task => `${task.description} #${task.id}`;

const onAddTagSearch = searchText => {
  addTagOptions.value = allTagOptions.value.filter(
    tag => !getTask(modalId.value).tags.includes(tag.value)
  ).filter(
    tag => tag.value.startsWith(searchText)
  );
};

const onAddTagSelect = (value, option) => {
  addTag(modalId.value, value);
  clearAddTagValue();
};

const onAddRequirementSearch = searchText => {
  if (searchText === '') {
    addRequirementOptions.value = [];
    return;
  }
  const descriptions = unfinishedTasks.value.map(task => {
    return {
      value: getDescriptionWithId(task),
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
      if (description.value === getDescriptionWithId(showingTask)) {
        return false;
      }
      for (const taskId of showingTask.requirements) {
        if (description.value === getDescriptionWithId(getTask(taskId))) {
          return false;
        }
      }
      for (const taskId of showingTask.dependents) {
        if (description.value === getDescriptionWithId(getTask(taskId))) {
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
  const descriptions = unfinishedTasks.value.map(task => {
    return {
      value: getDescriptionWithId(task),
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
      if (description.value === getDescriptionWithId(showingTask)) {
        return false;
      }
      for (const taskId of showingTask.requirements) {
        if (description.value === getDescriptionWithId(getTask(taskId))) {
          return false;
        }
      }
      for (const taskId of showingTask.dependents) {
        if (description.value === getDescriptionWithId(getTask(taskId))) {
          return false;
        }
      }
      return true;
    }
  );
  addDependentOptions.value = filteredDescriptions;
};

const clearAddRequirementValue = () => {
  addRequirementValue.value = '';
  onAddRequirementSearch('');
};

const clearAddDependentValue = () => {
  addDependentValue.value = '';
  onAddDependentSearch('');
};

const onAddRequirementSelect = (value, option) => {
  if ('value' in option) {
    const requirement = getTaskFromDescriptionWithId(option.value);
    post(
      ep_add_dependency,
      {
        requirement: requirement.id,
        dependent: modalId.value,
      }
    ).then(fetchTasks);
    requirements.value.push(requirement.id);
  }
  clearAddRequirementValue();
};

const onAddDependentSelect = (value, option) => {
  if ('value' in option) {
    const dependent = getTaskFromDescriptionWithId(option.value);
    post(
      ep_add_dependency,
      {
        requirement: modalId.value,
        dependent: dependent.id,
      }
    ).then(fetchTasks);
    dependents.value.push(dependent.id);
  }
  clearAddDependentValue();
};

const onDeleteRequirementClick = id => {
  post(
    ep_delete_dependency,
    {
      requirement: id,
      dependent: modalId.value,
    }
  ).then(fetchTasks);
  requirements.value = requirements.value.filter(taskId => taskId !== id);
};

const onDeleteDependentClick = id => {
  post(
    ep_delete_dependency,
    {
      requirement: modalId.value,
      dependent: id,
    }
  ).then(fetchTasks);
  dependents.value = dependents.value.filter(taskId => taskId !== id);
};

const finishTask = async (id) => {
  allTasks.value = allTasks.value.filter(task => task.id !== id);
  activeTasks.value = activeTasks.value.filter(task => task.id !== id);
  finishedTasks.value.push(getTask(id));
  filterTasks();
  post(ep_finish, { id: id })
    .then(fetchTasks);
};

const deleteTask = async id => {
  allTasks.value = allTasks.value.filter(task => task.id !== id);
  activeTasks.value = activeTasks.value.filter(task => task.id !== id);
  blockedTasks.value = blockedTasks.value.filter(task => task.id !== id);
  finishedTasks.value = finishedTasks.value.filter(task => task.id !== id);
  filterTasks();
  if (modalId.value === id) modalId.value = null;
  post(ep_delete, { id: id })
    .then(fetchTasks);
};
</script>

<template>
  <div id="container">
    <Space
      direction="vertical"
      style="width: 40%;"
    >
      <Input
        v-model:value="promptInput"
        type="text"
        placeholder="to do..."
        size="large"
        style="fontSize: 24px; height: 56px; width: 100%;"
        @pressEnter="addTask"
        @blur="clearPrompt"
      />

      <Space
        :size="[0, 8]"
        wrap
      >
        <Tag v-for="tag of filterTags">
          <template #icon>
            <close-outlined
              class="hover-highlight close"
              style="font-size: 10px;"
              @click="deleteFilterTag(tag)"
            />
          </template>

          <span style="margin-left: -4px;">{{ tag }}</span>
        </Tag>
        <Tag>
          <template #icon>
            <plus-outlined style="font-size: 12px;" />
          </template>

          <AutoComplete
            v-model:value="addFilterTagValue"
            style="margin-left: -10px;"
            :options="addFilterTagOptions"
            @search="onAddFilterTagSearch"
            @select="onAddFilterTagSelect"
          >
            <Input
              :bordered="false"
              placeholder="add filter tag..."
              size="small"
              style="font-size: 14px; width: 160px"
              @blur="clearAddFilterTagValue"
            />
          </AutoComplete>
        </Tag>
      </Space>
    </Space>
    <div style="height: 30px" />

    <List
      :dataSource="filteredActiveTasks"
      style="width: 65%;"
      :split="false"
    >
      <template #renderItem="{ item: task }">
        <ListItem
          class="
            child-show-on-hover
            rounded-corners
            hover-highlight
          "
        >
          <Space align="baseline">
            <check-outlined
              class="show-on-hover clickable-icon"
              style="font-size: 1.25rem; padding-top: 4px;"
              @click="finishTask(task.id)"
            />

            <p style="font-size: 1.25rem;">
              <span>{{ task.description }}</span>
              <span style="color: #666;"> #{{ task.id }}</span>
            </p>

            <Space
              :class="showTags ? 'smooth-show' : 'smooth-hide'"
              :size="[0, 4]"
              wrap
            >
              <Tag v-for="tag of task.tags">
                {{ tag }}
              </Tag>
            </Space>
          </Space>

          <Space style="float: right;">
            <form-outlined
              class="show-on-hover clickable-icon"
              style="font-size: 1.25rem; padding-top: 4px;"
              @click="showModal(task.id)"
            />
            <close-outlined
              class="show-on-hover clickable-icon"
              style="font-size: 1.25rem; padding-top: 4px;"
              @click="deleteTask(task.id)"
            />
          </Space>
        </ListItem>
      </template>
    </List>

    <template v-if="showBlocked">
      <div style="height: 30px" />

      <p
        class="rounded-corners"
        style="
          width: 65%;
          font-family: Poppins;
          font-weight: bold;
          font-size: 1.2rem;
          padding-left: 4px;
        "
      >
        blocked tasks:
      </p>

      <List
        :dataSource="filteredBlockedTasks"
        style="width: 65%;"
        :split="false"
      >
        <template #renderItem="{ item: task }">
          <ListItem
            class="
              child-show-on-hover
              rounded-corners
              hover-highlight
            "
          >
            <Space align="baseline">
              <check-outlined
                class="hide"
                style="font-size: 1.25rem; padding-top: 4px;"
              />

              <p style="font-size: 1.25rem;">
                <span>{{ task.description }}</span>
                <span style="color: #666;"> #{{ task.id }}</span>
              </p>

              <Space
                :class="showTags ? 'smooth-show' : 'smooth-hide'"
                :size="[0, 4]"
                wrap
              >
                <Tag v-for="tag of task.tags">
                  {{ tag }}
                </Tag>
              </Space>
            </Space>

            <Space style="float: right;">
              <form-outlined
                class="show-on-hover clickable-icon"
                style="font-size: 1.25rem; padding-top: 4px;"
                @click="showModal(task.id)"
              />
              <close-outlined
                class="show-on-hover clickable-icon"
                style="font-size: 1.25rem; padding-top: 4px;"
                @click="deleteTask(task.id)"
              />
            </Space>
          </ListItem>
        </template>
      </List>
    </template>

    <template v-if="showFinished">
      <div style="height: 30px" />

      <p
        class="rounded-corners"
        style="
          width: 65%;
          font-family: Poppins;
          font-weight: bold;
          font-size: 1.2rem;
          padding-left: 4px;
        "
      >
        finished tasks:
      </p>

      <List
        :dataSource="filteredFinishedTasks"
        style="width: 65%;"
        :split="false"
      >
        <template #renderItem="{ item: task }">
          <ListItem
            class="
              child-show-on-hover
              rounded-corners
              hover-highlight
            "
          >
            <Space align="baseline">
              <check-outlined
                style="font-size: 1.25rem; padding-top: 4px;"
              />

              <p style="font-size: 1.25rem;">
                <span>{{ task.description }}</span>
                <span style="color: #666;"> #{{ task.id }}</span>
              </p>

              <Space
                :class="showTags ? 'smooth-show' : 'smooth-hide'"
                :size="[0, 4]"
                wrap
              >
                <Tag v-for="tag of task.tags">
                  {{ tag }}
                </Tag>
              </Space>
            </Space>

            <Space style="float: right;">
              <close-outlined
                class="show-on-hover clickable-icon"
                style="font-size: 1.25rem; padding-top: 4px;"
                @click="deleteTask(task.id)"
              />
            </Space>
          </ListItem>
        </template>
      </List>
    </template>

    <Modal
      v-if="modalId !== null && modalId.value !== null"
      v-model:open="displayModal"
    >
      <Space direction="vertical" style="width: 100%;">
        <Space size="small">
          <Input
            ref="editDescriptionInput"
            v-if="editDescription"
            v-model:value="editDescriptionValue"
            class="rounded-corners"
            :bordered="false"
            style="
              padding: 0px;
              font-family: Poppins;
              font-weight: bold;
              font-size: 20px;
              width: 450px;
            "
            @pressEnter="onEditDescriptionPressEnter"
            @blur="cancelEditDescription"
          />
          <span
            v-else
            style="font-weight: bold; font-size: 20px;"
            @click="onModalDescriptionClick()"
          >
            {{ getTask(modalId).description }}
          </span>
          <span
            :class="editDescription ? 'hide' : 'smooth-show'"
            style="
              font-weight: bold;
              font-size: 20px;
              color: #666;
            "
          >
              {{ ` #${getTask(modalId).id}` }}
          </span>
        </Space>

        <Space
          direction="vertical"
          :size="0"
          style="width: 100%;"
        >
          <h4 class="rounded-corners" style="font-weight: bold;">
            tags:
          </h4>

          <Space
            class="rounded-corners"
            :size="[0, 8]"
            wrap
          >
            <Tag v-for="tag of getTask(modalId).tags">
              <template #icon>
                <close-outlined
                  class="hover-highlight close"
                  style="font-size: 10px;"
                  @click="deleteTag(modalId, tag)"
                />
              </template>

              <span style="margin-left: -4px;">{{ tag }}</span>
            </Tag>
            <Tag>
              <template #icon>
                <plus-outlined style="font-size: 12px;" />
              </template>

              <AutoComplete
                v-model:value="addTagValue"
                style="margin-left: -10px;"
                :options="addTagOptions"
                :defaultActiveFirstOption="false"
                @search="onAddTagSearch"
                @select="onAddTagSelect"
              >
                <Input
                  :bordered="false"
                  placeholder="add tag..."
                  size="small"
                  style="font-size: 14px; width: 160px"
                  @pressEnter="onAddTagPressEnter"
                  @blur="clearAddTagValue"
                />
              </AutoComplete>
            </Tag>
          </Space>
        </Space>

        <Space
          direction="vertical"
          :size="0"
          style="width: 100%;"
        >
          <h4 class="rounded-corners" style="font-weight: bold;">
            requirements:
          </h4>

          <template
            v-if="modalId !== null"
            v-for="taskId of requirements"
          >
            <div
              class="
                child-show-on-hover
                rounded-corners
                hover-highlight
              "
              style="
                width: 100%;
                display: flex;
                align-items: center;
              "
            >
              <p>
                <span>{{ getTask(taskId).description }}</span>
                <span style="color: #666;"> #{{ getTask(taskId).id }}</span>
              </p>

              <div style="flex: 1;">
                <close-outlined
                  class="show-on-hover close"
                  style="float: right;"
                  @click="onDeleteRequirementClick(taskId)"
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
              class="
                rounded-corners
                hover-highlight
                active-highlight
              "
              :bordered="false"
              placeholder="add requirement..."
              @blur="clearAddRequirementValue"
            />
          </AutoComplete>
        </Space>

        <Space
          direction="vertical"
          :size="0"
          style="width: 100%;"
        >
          <h4 class="rounded-corners" style="font-weight: bold;">
            dependents:
          </h4>

          <template
            v-if="modalId !== null"
            v-for="taskId of dependents"
          >
            <div
              class="
                child-show-on-hover
                rounded-corners
                hover-highlight
              "
              style="
                width: 100%;
                display: flex;
                align-items: center;
              "
            >
              <p>
                <span>{{ getTask(taskId).description }}</span>
                <span style="color: #666;"> #{{ getTask(taskId).id }}</span>
              </p>

              <div style="flex: 1;">
                <close-outlined
                  class="show-on-hover close"
                  style="float: right;"
                  @click="onDeleteDependentClick(taskId)"
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
              class="
                rounded-corners
                hover-highlight
                active-highlight
              "
              :bordered="false"
              placeholder="add dependent..."
              @blur="clearAddDependentValue"
            />
          </AutoComplete>
        </Space>
      </Space>

      <template #footer>
      </template>
    </Modal>
  </div>
  <div
    id="settings-panel"
    class="
      child-rotate-on-hover
      child-show-on-hover
    "
  >
    <Space
      direction="vertical"
      size="large"
      align="end"
    >
      <setting-outlined
        class="rotate-on-hover"
        style="
          float: right;
          font-size: 36px;
          color: #444;
        "
      />

      <Space class="show-on-hover-1">
        <span
          style="
            font-family: Poppins;
            font-size: 16px;
          "
        >
          show tags
        </span>
        <Switch
          v-model:checked="showTags"
        />
      </Space>

      <Space class="show-on-hover-2">
        <span
          style="
            font-family: Poppins;
            font-size: 16px;
          "
        >
          show blocked tasks
        </span>
        <Switch
          v-model:checked="showBlocked"
        />
      </Space>

      <Space class="show-on-hover-3">
        <span
          style="
            font-family: Poppins;
            font-size: 16px;
          "
        >
          show finished tasks
        </span>
        <Switch
          v-model:checked="showFinished"
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
  padding-top: 30px;
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

.hide {
  opacity: 0%;
}

.smooth-hide {
  opacity: 0%;
  transition: opacity 0.3s ease;
}

.smooth-show {
  opacity: 100%;
  transition: opacity 0.5s ease;
}

.show-on-hover {
  opacity: 0%;
  transition: max-height 0.3s ease;
}

.child-show-on-hover:hover .show-on-hover {
  opacity: 100%;
  transition: opacity 0.5s ease;
}

.show-on-hover-1 {
  opacity: 0%;
  transition: opacity 0.9s ease;
}

.child-show-on-hover:hover .show-on-hover-1 {
  opacity: 100%;
  transition: opacity 0.4s ease;
}

.show-on-hover-2 {
  opacity: 0%;
  transition: opacity 0.6s ease;
}

.child-show-on-hover:hover .show-on-hover-2 {
  opacity: 100%;
  transition: opacity 0.8s ease;
}

.show-on-hover-3 {
  opacity: 0%;
  transition: opacity 0.3s ease;
}

.child-show-on-hover:hover .show-on-hover-3 {
  opacity: 100%;
  transition: opacity 1.2s ease;
}

</style>
