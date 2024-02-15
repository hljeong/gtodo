# gtodo

## todo
- in-memory minimal version

## modules
- item
  - property: id
  - property: hidden
  - hook: on-create
- task
  - requires: item
  - property: task
  - property: time created
  - property: time finished
  - on-create:
    - set time created
  - hook: on-finish
  - on-finish:
    - set hidden to true
    - set time finished
- category
  - requires: item
  - property: category name
  - property: category
- task category
  - requires: task
  - property: category
- subtask
  - requires: task
- dependency
  - requires: task
- deadline
  - requires: task

## relations between items
- types of relations
  - a includes b: studying for midterm includes reviewing hw solutions
  - a requires b: cooking a new recipe requires buying ingredients
    - b can be a condition thats not a task: going out for a walk requires weather to be not rainy
- graph view
- solution

## deadline
- granularity

## temporal recurrence
- examples
  - pay credit card bills every month on the 20th
  - join the so-and-so meeting every other tuesday at 3 pm
  - celebrate thanksgiving every fourth thursday of november
- solution
  - hook: when task is finished, add new task at next recurring time
    - built-in hooks for common temporal notions
      - every <day of year>

## interface design
