import { test, expect, afterEach, mock } from "bun:test";

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
  delete (process.env as Record<string, string>).ONYX_ADMIN_API_KEY;
});

test("adminSearch posts query+filters with the admin bearer and returns documents", async () => {
  process.env.ONYX_ADMIN_API_KEY = "sk-test";
  const calls: Array<{ url: string; init: RequestInit }> = [];
  globalThis.fetch = mock(async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(JSON.stringify({ documents: [{ document_id: "a" }] }), { status: 200 });
  }) as unknown as typeof fetch;

  const { adminSearch } = await import("./client");
  const docs = await adminSearch("liability cap");

  expect(calls[0].url).toContain("/admin/search");
  expect((calls[0].init.headers as Record<string, string>).Authorization).toBe("Bearer sk-test");
  expect(JSON.parse(calls[0].init.body as string)).toEqual({ query: "liability cap", filters: {} });
  expect(docs[0].document_id).toBe("a");
});

test("adminSearch throws a clear error when the admin key is missing", async () => {
  const { adminSearch } = await import("./client");
  await expect(adminSearch("x")).rejects.toThrow(/ONYX_ADMIN_API_KEY/);
});
