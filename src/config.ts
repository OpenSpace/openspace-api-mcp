export interface OpenSpaceMcpConfig {
  host: string;
  port: number;
  password: string;
  connectTimeoutMs: number;
}

export const config: OpenSpaceMcpConfig = {
  host: process.env.OPENSPACE_HOST ?? "127.0.0.1",
  port: Number(process.env.OPENSPACE_PORT ?? 4681),
  password: process.env.OPENSPACE_PASSWORD ?? "",
  connectTimeoutMs: Number(process.env.OPENSPACE_CONNECT_TIMEOUT_MS ?? 15000)
};
