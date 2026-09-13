# Pull & Push Tracker

A small personal gym tracker for a pull day and a push day, built around one rule:
4 sets of 8 reps per move. Hit 8/8/8/8 and it tells you to go up a touch next time;
fall short and it tells you which number to beat next time.

## Running locally

```bash
npm install
npm start
```

Then open http://localhost:3000

## Deploying

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin <your-empty-github-repo-url>
git push -u origin main
```

(Create the empty repo first at github.com/new — don't initialize it with a
README, or the push above will conflict.)

### 2. Deploy on Railway

1. Go to railway.app and log in.
2. **New Project → Deploy from GitHub repo** → pick this repo.
3. Railway auto-detects Node and runs `npm install` then `npm start`. No
   extra config needed for a first deploy.
4. Once it's live, open the generated `*.up.railway.app` URL from your
   iPhone in **Safari**, tap the Share icon, then **Add to Home Screen**.
   Because this app ships its own `manifest.json` and service worker, it
   will open full-screen like a real app, no Safari address bar.

### Keeping your data across redeploys (important)

By default this app stores your sessions in `data/db.json` inside the
container's filesystem, which Railway wipes on every redeploy. To keep your
history permanently:

1. In your Railway project, go to your service → **Volumes** → **New Volume**.
2. Mount it at `/data`.
3. In the service's **Variables**, add `DB_PATH=/data/db.json`.
4. Redeploy. From then on your workout history survives redeploys.

If you skip this step, the app still works fine day-to-day — it only loses
history when you push a new deploy.
