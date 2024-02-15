const express = require('express');
const Joi = require('joi');

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
const ep_tasks = '/v1/tasks';

const tasks = [];

const add_schema = Joi.object({
  description: Joi.string().required()
});

const finish_schema = Joi.object({
  id: Joi.number().integer().min(0).required()
});

const log = (endpoint, msg) => console.log(`${endpoint} @ ${new Date().toLocaleString()}:\n${msg}\n`);
const err = (endpoint, msg) => console.error(`${endpoint} @ ${new Date().toLocaleString()}:\n${msg}\n`);

app.post(ep_add, (req, res) => {
  const { error, value } = add_schema.validate(req.body);
  if (error) {
    const msg = error.details.map(detail => detail.message).reduce((acc, msg) => acc ? acc + '\n' + msg : msg);
    err(ep_add, msg);
    return res.status(400).send(msg);
  }

  const task = {
    'id': tasks.length,
    'description': value.description,
    'time_created': new Date().toLocaleString()
  };

  tasks.push(task);

  const msg = JSON.stringify(task, null, 2);
  log(ep_add, msg);
  res.status(200).send(msg);
});

app.post(ep_finish, (req, res) => {
  const { error, value } = finish_schema.validate(req.body);
  if (error) {
    const msg = error.details.map(detail => detail.message).reduce((acc, msg) => acc ? acc + '\n' + msg : msg);
    err(ep_finish, msg);
    return res.status(400).send(msg);
  }

  const task = tasks[value.id]
  if ('time_finished' in task) {
    const msg = 'task already finished';
    err(ep_finish, msg);
    return res.status(422).send(msg);
  }

  task.time_finished = new Date().toLocaleString();

  const msg = 'task finished';
  log(ep_finish, msg);
  res.status(200).send(msg);
});

app.get('/v1/tasks', (req, res) => {
  const msg = JSON.stringify(tasks, null, 2);
  log('/v1/tasks', msg);
  res.send(msg);
});

app.listen(port, () => {
  console.log(`listening on port ${port}`);
});
