# Content Studio frontend

React 19, TypeScript, Vite, and React Router power the Content Studio interface.

## Run

```powershell
npm ci
npm run dev
```

Visit `/signup` to create a private workspace, or `/signin` to return to one. The root route redirects to `/content`; signed-out visitors are sent to sign-in. Sections are `/content/create`, `/content/approvals`, `/content/calendar`, `/content/library`, `/content/connections`, `/content/analytics`, `/content/settings`, and `/content/onboarding`.

The API defaults to same-origin `/api/v3/social` and `/api/v3/linkedin`; Vite proxies `/api` and `/media` to the Django server on port 8000 during development. Set `VITE_API_PROXY_TARGET` to use another local port. Override with `VITE_SOCIAL_API_BASE_URL` and `VITE_LINKEDIN_API_BASE_URL` when hosting the frontend and API separately. For separate frontend and API sites, set both API base URLs to the Django origin. Django needs `CORS_ALLOW_CREDENTIALS=True`, an exact `CORS_ALLOWED_ORIGINS` and `CSRF_TRUSTED_ORIGINS` entry for the frontend, HTTPS, and secure cookies with `SESSION_COOKIE_SAMESITE=None` and `CSRF_COOKIE_SAMESITE=None`. The session endpoint supplies a CSRF token to the frontend for authenticated writes. Keep `VITE_DEMO_MODE=false` for real accounts.

## Verify

```powershell
npm test
npm run validate
```
