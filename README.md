# Planner

A personal task planner built with React, TypeScript, and Vite. Tasks and settings are stored locally in the browser using IndexedDB.

The calendar is the home view. Its Days view shows yesterday, today, tomorrow, and the following day; use the arrows to move the window one day at a time. Tasks use a title, priority, subject label, and status; drag them between days in the Days or Month view to reschedule. Use the three-dot task menu to edit a task or open its editor to delete it.

When GitHub Pages is enabled, the site is available at <https://shijan-khanal.github.io/daily-planner/>.

## Run locally

```sh
npm install
npm run dev
```

Create a production build with `npm run build`.

## Deploy to GitHub Pages

The workflow in `.github/workflows/deploy-pages.yml` builds and deploys the site whenever changes are pushed to `main`.

In the repository, open **Settings → Pages** and set the publishing source to **GitHub Actions**. After the first successful workflow run, open the Pages URL shown in the deployment workflow.

## Data and backups

Planner data is stored in IndexedDB for the current browser and site origin. It is not uploaded to GitHub or synchronized between browsers. A new Pages URL has a separate browser database from `localhost`. Use **Settings → Export** to save a JSON backup, and **Settings → Import** on the Pages site to restore it.
