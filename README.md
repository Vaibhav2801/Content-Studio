# Content Studio Platform

Content Studio provides a React frontend and Django backend for creating, approving, scheduling, publishing, and analyzing social content.

## Run locally

Start the backend from `backend/`:

```powershell
.\venv\Scripts\python.exe manage.py migrate
.\venv\Scripts\python.exe manage.py runserver
```

Start the frontend from `frontend/`:

```powershell
npm ci
npm run dev
```

Open `http://localhost:5173/`, which redirects to `/content`.

The frontend uses `http://localhost:8000/api/v3/social` by default. Set `VITE_SOCIAL_API_BASE_URL` to point it elsewhere. Legacy LinkedIn content endpoints remain at `/api/v3/linkedin/`.

For social account authorization, configure `UPLOAD_POST_CONNECTION_RETURN_URL` or `ZERNIO_CONNECTION_RETURN_URL` to the deployed `/content/onboarding` page. If the frontend uses another trusted origin, add it to `CONTENT_STUDIO_FRONTEND_ORIGINS` (comma-separated). In local development with `DEBUG=True`, `http://localhost:5173` and `http://127.0.0.1:5173` are accepted automatically so authorization returns to the signed-in browser session.

The backend retains legacy workspace models and historical migrations because Content Studio data depends on them. The public prospecting and separate LLM analytics routes are disabled.

## Verify

```powershell
cd frontend
npm test
npm run validate

cd ..\backend
.\venv\Scripts\python.exe manage.py check
.\venv\Scripts\python.exe manage.py test integrations.social
```

Content Studio architecture and operations are documented in `backend/docs/CONTENT_STUDIO_*.md`.
