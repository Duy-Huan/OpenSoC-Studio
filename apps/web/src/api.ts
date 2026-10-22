export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public details: unknown[] = [],
    public status = 0,
  ) {
    super(message);
  }
}
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/v1${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "x-opensoc-client": "workbench",
      ...init?.headers,
    },
  });
  const body = await response.json();
  if (!response.ok)
    throw new ApiError(
      body.code ?? "REQUEST_FAILED",
      body.message ?? "Request failed",
      body.details,
      response.status,
    );
  return body;
}
export const post = <T>(path: string, body: unknown = {}) =>
  api<T>(path, { method: "POST", body: JSON.stringify(body) });
export const terminal = (state: string) =>
  [
    "COMPLETED_PASS",
    "COMPLETED_FAIL",
    "FAILED_INFRA",
    "TIMED_OUT",
    "CANCELLED",
    "BLOCKED",
  ].includes(state);
