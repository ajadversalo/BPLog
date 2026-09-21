import { getCloudflareContext } from "@opennextjs/cloudflare";

export function getDb(): D1Database {
  const { env } = getCloudflareContext();
  if (!env.DB) {
    throw new Error("The DB binding is missing. Create a D1 database and bind it as DB.");
  }
  return env.DB;
}
