const express = require('express');
const Joi = require('joi');
const fs = require('fs');

const app = express();
const port = 3000;

app.use(express.json());
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

const ep_tasks = '/v1/tasks';
const ep_add = '/v1/add';
const ep_finish = '/v1/finish';
const ep_delete = '/v1/delete';
const ep_add_dependency = '/v1/add_dependency';
const ep_delete_dependency = '/v1/delete_dependency';
const ep_add_tag = '/v1/add_tag';
const ep_delete_tag = '/v1/delete_tag';
const ep_add_subtask = '/v1/add_subtask';
const ep_delete_subtask = '/v1/delete_subtask';
const ep_update = '/v1/update';

const file = 'data.json';
const tasks = [];
if (fs.existsSync(file)) {
  fs.readFile(file, 'utf8', (err, data) => {
    if (err) {
      console.error('error occurred when reading from file');
      return
    }
    tasks.push(...JSON.parse(data));
    for (const task of tasks) {
      if (!('id' in task))
        task.id = -1;
      if (!('description' in task))
        task.description = 'unknown task';
      if (!('finished' in task))
        task.finished = false;
      if (!('time_created' in task))
        task.time_created = null;
      if (!('time_finished' in task))
        task.time_finished = null;
      if (!('tags' in task))
        task.tags = [];
      if (!('requirements' in task))
        task.requirements = [];
      if (!('dependents' in task))
        task.dependents = [];
      if (!('parent' in task))
        task.parent = null;
      if (!('subtasks' in task))
        task.subtasks = [];
      if (!('deleted' in task))
        task.deleted = false;
    }
  });
}
const save = () => {
  fs.writeFile(file, JSON.stringify(tasks, null, 2), err => {
    if (err) {
      console.error('error occurred when writing to file');
    }
  });
};

const get_time = () => new Date().toLocaleString();
const get_task = id => tasks.filter(task => task.id === id)[0];

const id_schema = Joi.number().integer().min(0);
const description_schema = Joi.string();
const tag_schema = Joi.string();
const tags_schema = Joi.array().items(Joi.string()).unique();

const schema = {
  [ep_add]: Joi.object({
    description: description_schema.required(),
    tags: tags_schema,
  }),

  [ep_finish]: Joi.object({
    id: id_schema.required(),
  }),

  [ep_delete]: Joi.object({
    id: id_schema.required(),
  }),

  [ep_add_dependency]: Joi.object({
    requirement: id_schema.required(),
    dependent: id_schema.disallow(Joi.ref('requirement')).required(),
  }),

  [ep_delete_dependency]: Joi.object({
    requirement: id_schema.required(),
    dependent: id_schema.disallow(Joi.ref('requirement')).required(),
  }),

  [ep_add_tag]: Joi.object({
    id: id_schema.required(),
    tag: Joi.string().required(),
  }),

  [ep_delete_tag]: Joi.object({
    id: id_schema.required(),
    tag: tag_schema.required(),
  }),

  [ep_add_subtask]: Joi.object({
    id: id_schema.required(),
    subtask_id: id_schema.required(),
  }),

  [ep_delete_subtask]: Joi.object({
    id: id_schema.required(),
    subtask_id: id_schema.required(),
  }),

  [ep_update]: Joi.object({
    id: id_schema.required(),
    description: description_schema,
    tags: tags_schema,
  }),
};

const log = (endpoint, msg) => console.log(`${endpoint} @ ${get_time()}:\n${msg}\n`);
const err = (endpoint, msg) => console.error(`${endpoint} @ ${get_time()}:\n${msg}\n`);

const validate = (endpoint, data) => {
  const { error, value } = schema[endpoint].validate(data);
  if (error) {
    const msg = error.details.map(detail => detail.message).reduce((acc, msg) => acc ? acc + '\n' + msg : msg);
    err(endpoint, msg);
    return { error: msg };
  }
  return { data: value };
};

app.get(ep_tasks, (req, res) => {
  const ep = ep_tasks;

  const msg = JSON.stringify(
    tasks.filter(task => !task.deleted),
    null,
    2
  );
  // log(ep, msg);
  res.send(msg);
});

app.post(ep_add, (req, res) => {
  const ep = ep_add;

  const { error, data } = validate(ep, req.body);
  if (error) return res.status(400).send(error);

  const { description, tags } = data;
  const task = {
    id: tasks.length,
    description: description,
    finished: false,
    time_created: get_time(),
    time_finished: null,
    tags: tags ? tags : [],
    requirements: [],
    dependents: [],
    parent: null,
    subtasks: [],
    deleted: false,
  };

  tasks.push(task);
  save();

  const msg = JSON.stringify(task, null, 2);
  log(ep, msg);
  res.status(200).send(msg);
});

app.post(ep_finish, (req, res) => {
  const ep = ep_finish;

  const { error, data } = validate(ep, req.body);
  if (error) return res.status(400).send(error);

  const { id } = data;
  const task = tasks[id];
  if (task.finished) {
    const msg = `#${task.id} already finished`;
    err(ep, msg);
    return res.status(422).send(msg);
  }

  task.time_finished = get_time();
  task.finished = true;
  save();

  const msg = `#${task.id} finished`;
  log(ep, msg);
  res.status(200).send(msg);
});

app.post(ep_delete, (req, res) => {
  const ep = ep_delete;

  const { error, data } = validate(ep, req.body);
  if (error) return res.status(400).send(error);

  const { id } = data;
  const task = tasks[id];
  if (task.deleted) {
    const msg = `#${id} already deleted`;
    err(ep, msg);
    return res.status(422).send(msg);
  }

  for (const requirement of task.requirements) {
    tasks[requirement].dependents = tasks[requirement].dependents.filter(id => id !== task.id);
  }
  for (const dependent of task.dependents) {
    tasks[dependent].requirements = tasks[dependent].requirements.filter(id => id !== task.id);
  }
  task.deleted = true;
  save();

  const msg = `#${task.id} deleted`;
  log(ep, msg);
  res.status(200).send(msg);
});

app.post(ep_add_dependency, (req, res) => {
  const ep = ep_add_dependency;

  const { error, data } = validate(ep, req.body);
  if (error) return res.status(400).send(error);

  const {
    requirement: requirementId,
    dependent: dependentId
  } = data;
  const requirement = tasks[requirementId];
  const dependent = tasks[dependentId];
  if (dependent.requirements.includes(requirement.id)) {
    const msg = `dependency (${requirement.id}, ${dependent.id}) already exists`;
    err(ep, msg);
    return res.status(422).send(msg);
  }

  requirement.dependents.push(dependent.id);
  dependent.requirements.push(requirement.id);
  save();

  const msg = `dependency (${requirement.id}, ${dependent.id}) added`;
  log(ep, msg);
  res.status(200).send(msg);
});

app.post(ep_delete_dependency, (req, res) => {
  const ep = ep_delete_dependency;

  const { error, data } = validate(ep, req.body);
  if (error) return res.status(400).send(error);

  const {
    requirement: requirementId,
    dependent: dependentId
  } = data;
  const requirement = tasks[requirementId];
  const dependent = tasks[dependentId];
  if (!dependent.requirements.includes(requirement.id)) {
    const msg = `dependency (#${requirement.id}, #${dependent.id}) does not exist`;
    err(ep, msg);
    return res.status(422).send(msg);
  }

  requirement.dependents = requirement.dependents.filter(id => id !== dependent.id);
  dependent.requirements = dependent.requirements.filter(id => id !== requirement.id);
  save();

  const msg = `dependency (${requirement.id}, ${dependent.id}) deleted`;
  log(ep, msg);
  res.status(200).send(msg);
});

app.post(ep_add_tag, (req, res) => {
  const ep = ep_add_tag;

  const { error, data } = validate(ep, req.body);
  if (error) return res.status(400).send(error);

  const { id, tag } = data;
  const task = get_task(id);
  if (!task.tags.includes(tag)) {
    task.tags.push(tag);
  }
  save();

  const msg = `added tag ${tag} to #${id}`;
  log(ep, msg);
  res.status(200).send(msg);
});

app.post(ep_delete_tag, (req, res) => {
  const ep = ep_add_tag;

  const { error, data } = validate(ep, req.body);
  if (error) return res.status(400).send(error);

  const { id, tag } = data;
  const task = get_task(id);
  if (!task.tags.includes(tag)) {
    const msg = `#${id} does not have tag ${tag}`;
    err(ep, msg);
    return res.status(422).send(msg);
  }

  task.tags = task.tags.filter(task_tag => task_tag !== tag);
  save();

  const msg = `deleted tag ${tag} from #${id}`;
  log(ep, msg);
  res.status(200).send(msg);
});

app.post(ep_add_subtask, (req, res) => {
  const ep = ep_add_subtask;

  const { error, data } = validate(ep, req.body);
  if (error) return res.status(400).send(error);

  const { id, subtask_id } = data;
  const task = get_task(id);
  const subtask = get_task(subtask_id);
  if (subtask.parent !== null) {
    const msg = `#${subtask_id} is already a subtask`;
    err(ep, msg);
    return res.status(400).send(msg);
  }

  task.subtasks.push(subtask.id);
  subtask.parent = task.id;
  save();

  const msg = `added #${subtask_id} as a subtask of #${id}`;
  log(ep, msg);
  res.status(200).send(msg);
});

app.post(ep_delete_subtask, (req, res) => {
  const ep = ep_delete_subtask;

  const { error, data } = validate(ep, req.body);
  if (error) return res.status(400).send(error);

  const { id, subtask_id } = data;
  const task = get_task(id);
  const subtask = get_task(subtask_id);
  if (!task.subtasks.includes(subtask.id)) {
    const msg = `#${subtask_id} is not a subtask of #${id}`;
    err(ep, msg);
    return res.status(422).send(msg);
  }

  task.subtasks = task.subtasks.filter(task_subtask_id => task_subtask_id !== subtask.id);
  subtask.parent = null;
  save();

  const msg = `deleted #${subtask_id} from subtasks of #${id}`;
  log(ep, msg);
  res.status(200).send(msg);
});

app.post(ep_update, (req, res) => {
  const ep = ep_update;

  const { error, data } = validate(ep, req.body);
  if (error) return res.status(400).send(error);

  const { id, description, tags } = data;
  const task = tasks.filter(task => task.id === id)[0];
  if (description) {
    task.description = description;
  }
  if (tags) {
    task.tags = tags;
  }
  save();

  const msg = `updated task #${id}`;
  log(ep, msg);
  res.status(200).send(msg);
});

app.listen(port, () => {
  console.log(`listening on port ${port}`);
});
