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
- server
  - create backups on a timer
- webapp
  - add tags and filters
  - add undo
  - add hotkeys
  - make lists (main list and dependency lists) draggable
  - list technologies in readme
  - add transitions for adding and deleting items
  - add transitions for updating displayed tasks
  - modularize
    - dependency list
    - settings item
  - add composition
  - todo bar always on top
  - back top float button
  - show loading screen when fetching todo list for the first time
  - add shadow to todo bar
  - make todo descriptions editable
