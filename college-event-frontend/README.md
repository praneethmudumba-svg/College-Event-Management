# CampusPulse — Online College Event Management Frontend

A React + Vite frontend demo with a college-fest design, event search and category filters, demo Student/Admin login, student event registration, and an admin event creation/deletion panel.

## Requirements
- Node.js LTS (includes npm)
- VS Code (recommended)

## Run locally
1. Extract the ZIP.
2. Open the `college-event-frontend` folder in VS Code.
3. Open Terminal → New Terminal.
4. Run:
   ```bash
   npm install
   npm run dev
   ```
5. Open the local URL printed by Vite, normally `http://localhost:5173`.

## Demo
- Click **Sign in**.
- Choose Student or Admin.
- Enter any name, email, and password (demo only).
- Student: browse and register/unregister for events.
- Admin: open Admin panel → Create event. You can publish and delete events.
- Demo events and registrations are saved in browser `localStorage`.

## Important limitations
This is a frontend-only demonstration. Login is not secure; role selection is not authorization. Events and registrations are stored in the current browser, not MySQL. Do not use it for real student data.

## Connect a backend later
Create a Node.js/Express API and MySQL database, then replace the demo login and localStorage logic in `src/App.jsx` with API calls. Put the API base URL in a Vite environment variable such as `VITE_API_URL`. Never put database passwords or server secrets in frontend code.

## Deploy to Vercel
1. Push this project to a GitHub repository.
2. In Vercel, choose **Add New → Project** and import the repository.
3. Framework preset: Vite. Build command: `npm run build`. Output directory: `dist`.
4. Click Deploy.
5. If you add React Router routes and refresh gives a 404, add `vercel.json` with:
   ```json
   {
     "rewrites": [{ "source": "/(.*)", "destination": "/" }]
   }
   ```
