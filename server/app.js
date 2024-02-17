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

const ep_add = '/v1/add';
const ep_finish = '/v1/finish';
const ep_delete = '/v1/delete';
const ep_add_dependency = '/v1/add_dependency';
const ep_delete_dependency = '/v1/delete_dependency';
const ep_tasks = '/v1/tasks';

const file = 'data.txt';
const tasks = [];
if (fs.existsSync(file)) {
  fs.readFile(file, 'utf8', (err, data) => {
    if (err) {
      console.error('error occurred when reading from file');
      return
    }
    tasks.push(...JSON.parse(data));
  });
}
const save = () => {
  fs.writeFile(file, JSON.stringify(tasks, null, 2), err => {
    if (err) {
      console.error('error occurred when writing to file');
    }
  });
};

const getTime = () => new Date().toLocaleString();

const schema = {
  [ep_add]: Joi.object({
    description: Joi.string().required(),
  }),

  [ep_finish]: Joi.object({
    id: Joi.number().integer().min(0).required(),
  }),

  [ep_delete]: Joi.object({
    id: Joi.number().integer().min(0).required(),
  }),

  [ep_add_dependency]: Joi.object({
    requirement: Joi.number().integer().min(0).required(),
    dependent: Joi.number().integer().min(0).disallow(Joi.ref('requirement')).required(),
  }),

  [ep_delete_dependency]: Joi.object({
    requirement: Joi.number().integer().min(0).required(),
    dependent: Joi.number().integer().min(0).disallow(Joi.ref('requirement')).required(),
  }),
};

const log = (endpoint, msg) => console.log(`${endpoint} @ ${getTime()}:\n${msg}\n`);
const err = (endpoint, msg) => console.error(`${endpoint} @ ${getTime()}:\n${msg}\n`);

app.post(ep_add, (req, res) => {
  const ep = ep_add;

  const { error, value } = schema[ep].validate(req.body);
  if (error) {
    const msg = error.details.map(detail => detail.message).reduce((acc, msg) => acc ? acc + '\n' + msg : msg);
    err(ep, msg);
    return res.status(400).send(msg);
  }

  const task = {
    id: tasks.length,
    description: value.description,
    finished: false,
    time_created: getTime(),
    time_finished: null,
    requirements: [],
    dependents: [],
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

  const { error, value } = schema[ep].validate(req.body);
  if (error) {
    const msg = error.details.map(detail => detail.message).reduce((acc, msg) => acc ? acc + '\n' + msg : msg);
    err(ep, msg);
    return res.status(400).send(msg);
  }

  const task = tasks[value.id]
  if (task.finished) {
    const msg = `task ${task.id} already finished`;
    err(ep, msg);
    return res.status(422).send(msg);
  }

  task.time_finished = getTime();
  task.finished = true;
  save();

  const msg = `task ${task.id} finished`;
  log(ep, msg);
  res.status(200).send(msg);
});

app.post(ep_delete, (req, res) => {
  const ep = ep_delete;

  const { error, value } = schema[ep].validate(req.body);
  if (error) {
    const msg = error.details.map(detail => detail.message).reduce((acc, msg) => acc ? acc + '\n' + msg : msg);
    err(ep, msg);
    return res.status(400).send(msg);
  }

  const task = tasks[value.id]
  if (task.deleted) {
    const msg = 'task already deleted';
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

  const msg = `task ${task.id} deleted`;
  log(ep, msg);
  res.status(200).send(msg);
});

app.post(ep_add_dependency, (req, res) => {
  const ep = ep_add_dependency;

  const { error, value } = schema[ep].validate(req.body);
  if (error) {
    const msg = error.details.map(detail => detail.message).reduce((acc, msg) => acc ? acc + '\n' + msg : msg);
    err(ep, msg);
    return res.status(400).send(msg);
  }

  const requirement = tasks[value.requirement];
  const dependent = tasks[value.dependent];
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

  const { error, value } = schema[ep].validate(req.body);
  if (error) {
    const msg = error.details.map(detail => detail.message).reduce((acc, msg) => acc ? acc + '\n' + msg : msg);
    err(ep, msg);
    return res.status(400).send(msg);
  }

  const requirement = tasks[value.requirement];
  const dependent = tasks[value.dependent];
  if (!dependent.requirements.includes(requirement.id)) {
    const msg = `dependency (${requirement.id}, ${dependent.id}) does not exist`;
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

app.get('/v1/tasks', (req, res) => {
  const ep = ep_tasks;

  const msg = JSON.stringify(
    tasks.filter(task => !task.deleted),
    null,
    2
  );
  // log(ep, msg);
  res.send(msg);
});

app.listen(port, () => {
  console.log(`listening on port ${port}`);
});
