# Keep authentication and gym APIs in Next.js

S01 extends the existing same-origin Next.js `/api` backend, PostgreSQL database, and database-session authentication. The separate Express scaffold will not own S01 authentication or authorization: choosing Next.js preserves the existing Google and plan integrations and avoids introducing a second identity-verification boundary.
