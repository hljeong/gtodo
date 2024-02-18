# gtodo

todo list with dependency.

## install dependencies
```sh
cd server
npm install
cd ../sebapp
npm install
```

## run the server
```sh
cd server
npm run serve
```
server is hosted at `http://localhost:3000`.

## run the web app
```sh
cd webapp
npm run serve
```
web app is hosted at `http://localhost:5173`.

## todo
- list technologies in readme
- server
  - create backups on a timer
- webapp
  - migrate api usage to use update
  - add filters
  - add unfinish
  - add undo
  - add hotkeys
  - add composition
  - make lists (main list and dependency lists) draggable
  - add transitions for adding and deleting items
  - add transitions for updating displayed tasks
  - modularize
    - dependency list
    - settings item
  - todo bar always on top
  - back top float button
  - show loading screen when fetching todo list for the first time
  - add shadow to todo bar
