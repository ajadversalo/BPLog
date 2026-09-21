# BP log

A mobile-first blood pressure logger built with Next.js and Cloudflare D1.

## Cloudflare setup

1. Install dependencies with `npm install`.
2. Authenticate Wrangler with `npx wrangler login`.
3. Create the D1 database:

   ```bash
   npx wrangler d1 create bp-log-db
   ```

4. Put the returned database ID into `wrangler.jsonc` as `database_id`.
5. Apply the schema:

   ```bash
   npm run db:migrate:remote
   ```

6. Generate the binding types and deploy:

   ```bash
   npm run cf-typegen
   npm run deploy
   ```

For local development, apply the migration to the local D1 emulator with `npm run db:migrate:local`, then use `npm run dev`. Until the binding is available, the UI falls back to a clearly labeled local preview mode.

The API uses an anonymous, HttpOnly browser cookie to keep one browser's log separated from another browser's log. Authentication and account recovery can be added as a next step before sharing the app publicly.
