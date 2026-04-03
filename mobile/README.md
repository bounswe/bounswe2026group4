# Local History Story Map Mobile

React Native + Expo skeleton for the Local History Story Map project.

## Create the app skeleton
```bash
bash create-local-history-mobile-skeleton.sh
```

## Install dependencies
```bash
cd mobile
npm install
```

## Run
```bash
npm run start
```

## Expo Go with local backend

1. Copy the example env file and set your computer's LAN IP:
```bash
cp .env.example .env
```

2. Update `EXPO_PUBLIC_API_BASE_URL` in `.env`:
```env
EXPO_PUBLIC_API_BASE_URL=http://192.168.x.x:8000
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
