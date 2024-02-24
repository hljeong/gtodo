# gtodo

todo list with dependency.

## install dependencies
```sh
npm install
```

## define environmental variables

populate a `.env` file in the repository root in the following format:
```
VITE_FIREBASE_API_KEY='<firebase api key>'
VITE_FIREBASE_AUTH_DOMAIN='<firebase auth domain>'
VITE_FIREBASE_PROJECT_ID='<firebase project id>'
VITE_FIREBASE_STORAGE_BUCKET='<firebase storage bucket>'
VITE_FIREBASE_MESSAGING_SENDER_ID='<firebase messaging sender id>'
VITE_FIREBASE_APP_ID='<firebase app id>'
VITE_FIREBASE_DATABASE='<firestore collection>'
```

## run development server
```sh
npm run dev
```
development server is hosted at `http://localhost:5173`.

## build and preview
```sh
npm run build && npm run preview
```
preview is hosted at `http://localhost:4173`.
