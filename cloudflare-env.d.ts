type D1Result<T> = {
  results: T[];
  success: boolean;
  meta?: Record<string, unknown>;
};

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  first<T = Record<string, unknown>>(columnName?: string): Promise<T | null>;
  run<T = Record<string, unknown>>(): Promise<{ success: boolean; meta?: Record<string, unknown> }>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T extends D1PreparedStatement>(statements: T[]): Promise<Array<{ success: boolean; meta?: Record<string, unknown> }>>;
}

interface CloudflareEnv {
  DB: D1Database;
}
