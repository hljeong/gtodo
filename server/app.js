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
  fs.writeFile(file, JSON.stringify(tasks), err => {
    if (err) {
      console.error('error occurred when writing to file');
    }
  });
};

const getTime = () => new Date().toLocaleString();

const add_schema = Joi.object({
  description: Joi.string().required()
});

const finish_schema = Joi.object({
  id: Joi.number().integer().min(0).required()
});

const delete_schema = Joi.object({
  id: Joi.number().integer().min(0).required()
});

const log = (endpoint, msg) => console.log(`${endpoint} @ ${getTime()}:\n${msg}\n`);
const err = (endpoint, msg) => console.error(`${endpoint} @ ${getTime()}:\n${msg}\n`);

app.post(ep_add, (req, res) => {
  const ep = ep_add;
  const { error, value } = add_schema.validate(req.body);
  if (error) {
    const msg = error.details.map(detail => detail.message).reduce((acc, msg) => acc ? acc + '\n' + msg : msg);
    err(ep, msg);
    return res.status(400).send(msg);
  }

  const task = {
    'id': tasks.length,
    'description': value.description,
    'time_created': getTime(),
  };

  tasks.push(task);
  save();

  const msg = JSON.stringify(task, null, 2);
  log(ep, msg);
  res.status(200).send(msg);
});

app.post(ep_finish, (req, res) => {
  const ep = ep_finish;
  const { error, value } = finish_schema.validate(req.body);
  if (error) {
    const msg = error.details.map(detail => detail.message).reduce((acc, msg) => acc ? acc + '\n' + msg : msg);
    err(ep, msg);
    return res.status(400).send(msg);
  }

  const task = tasks[value.id]
  if ('time_finished' in task) {
    const msg = 'task already finished';
    err(ep, msg);
    return res.status(422).send(msg);
  }

  task.time_finished = getTime();
  save();

  const msg = 'task finished';
  log(ep, msg);
  res.status(200).send(msg);
});

app.post(ep_delete, (req, res) => {
  const ep = ep_delete;
  const { error, value } = delete_schema.validate(req.body);
  if (error) {
    const msg = error.details.map(detail => detail.message).reduce((acc, msg) => acc ? acc + '\n' + msg : msg);
    err(ep, msg);
    return res.status(400).send(msg);
  }

  const task = tasks[value.id]
  if ('deleted' in task) {
    const msg = 'task already deleted';
    err(ep, msg);
    return res.status(422).send(msg);
  }

  task.deleted = true;
  save();

  const msg = 'task deleted';
  log(ep, msg);
  res.status(200).send(msg);
});

app.get('/v1/tasks', (req, res) => {
  const ep = ep_tasks;
  const msg = JSON.stringify(
    tasks.filter(task => !('deleted' in task)),
    null,
    2
  );
  log(ep, msg);
  res.send(msg);
});

app.listen(port, () => {
  console.log(`listening on port ${port}`);
});
