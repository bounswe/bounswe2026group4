# Local History Story Map Mobile

React Native + Expo skeleton for the Local History Story Map project.

## Install dependencies
```bash
cd mobile
npm install
```

## Run Expo
```bash
npm run start
```

## First-time setup

1. Copy the mobile env file:
```bash
cp .env.example .env
```

2. If you are using the shared remote backend, the default `.env.example` values are enough.

3. If you are using a local backend instead, update `EXPO_PUBLIC_API_BASE_URL` in `mobile/.env`:
```env
EXPO_PUBLIC_API_BASE_URL=http://192.168.x.x:8000/api
```

4. Restart Expo after every `.env` change so the new values are picked up.

## Expo Go with local backend

1. Copy the example env file:
```bash
cp .env.example .env
```

2. Update `EXPO_PUBLIC_API_BASE_URL` in `mobile/.env`:
```env
EXPO_PUBLIC_API_BASE_URL=http://192.168.x.x:8000/api
```

3. Start Django so Expo Go can reach it from your phone:
```bash
cd ../backend
python manage.py runserver 0.0.0.0:8000
```

4. Make sure your phone and computer are on the same Wi-Fi, then run:
```bash
cd ../mobile
npm run start
```

## PowerShell quick start

```powershell
cd .\bounswe2026group4\mobile
Copy-Item .env.example .env
npm run start
```
