// Client Follow Up Boss API v1 — chỉ dùng phía server.
// Tài liệu: https://docs.followupboss.com/reference
//  - Basic auth: API key làm username, password rỗng.
//  - Header X-System / X-System-Key (đăng ký hệ thống).
//  - Phân trang: limit tối đa 100, ưu tiên _metadata.next (cursor).
//  - Rate limit cửa sổ trượt 10s; 429 kèm Retry-After (giây) — request CHƯA được xử lý, gửi lại an toàn.

export const FUB_BASE = "https://api.followupboss.com/v1";

export class FubError extends Error {
  constructor(
    message: string,
    public status: number,
    /** true = không biết request ghi có được áp dụng hay chưa (vd. 5xx/timeout với POST). */
    public outcomeUnknown = false,
  ) {
    super(message);
  }
}

type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

export type FubClientOptions = {
  apiKey: string;
  systemName: string;
  systemKey?: string;
  fetchImpl?: FetchLike;
  sleep?: (ms: number) => Promise<void>;
  maxRetries?: number;
};

export type FubMetadata = { next?: string | null; nextLink?: string | null; total?: number };

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export class FubClient {
  private fetchImpl: FetchLike;
  private sleep: (ms: number) => Promise<void>;
  private maxRetries: number;

  constructor(private opts: FubClientOptions) {
    this.fetchImpl = opts.fetchImpl ?? ((u, i) => fetch(u, i));
    this.sleep = opts.sleep ?? defaultSleep;
    this.maxRetries = opts.maxRetries ?? 4;
  }

  private headers(): Record<string, string> {
    const h: Record<string, string> = {
      Authorization: "Basic " + Buffer.from(this.opts.apiKey + ":").toString("base64"),
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-System": this.opts.systemName,
    };
    if (this.opts.systemKey) h["X-System-Key"] = this.opts.systemKey;
    return h;
  }

  async request<T>(
    method: "GET" | "POST" | "PUT",
    pathOrUrl: string,
    opts: { query?: Record<string, string | number | undefined>; body?: unknown } = {},
  ): Promise<T> {
    const url = new URL(pathOrUrl.startsWith("http") ? pathOrUrl : FUB_BASE + pathOrUrl);
    if (!url.href.startsWith(FUB_BASE)) throw new FubError("URL ngoài API Follow Up Boss bị chặn", 0);
    for (const [k, v] of Object.entries(opts.query ?? {})) if (v !== undefined) url.searchParams.set(k, String(v));

    for (let attempt = 0; ; attempt++) {
      let res: Response;
      try {
        res = await this.fetchImpl(url.toString(), {
          method,
          headers: this.headers(),
          body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
          signal: AbortSignal.timeout(30_000),
        });
      } catch (e) {
        // Lỗi mạng: GET thử lại; ghi thì không biết đã áp dụng chưa → không tự thử lại.
        if (method === "GET" && attempt < this.maxRetries) {
          await this.sleep(1000 * 2 ** attempt);
          continue;
        }
        throw new FubError(`Không kết nối được Follow Up Boss: ${(e as Error).message}`, 0, method !== "GET");
      }

      if (res.status === 429) {
        // Request chưa được xử lý — an toàn để gửi lại cho mọi method.
        const wait = Number(res.headers.get("Retry-After") ?? "10");
        if (attempt < this.maxRetries) {
          await this.sleep(Math.max(1, wait) * 1000);
          continue;
        }
        throw new FubError("Follow Up Boss giới hạn tốc độ (429) — thử lại sau.", 429);
      }
      if (res.status >= 500) {
        if (method === "GET" && attempt < this.maxRetries) {
          await this.sleep(1000 * 2 ** attempt);
          continue;
        }
        throw new FubError(`Follow Up Boss lỗi máy chủ (${res.status}).`, res.status, method !== "GET");
      }
      if (res.status === 401) throw new FubError("Follow Up Boss từ chối API key (401).", 401);
      if (res.status === 403) throw new FubError("Không đủ quyền với tài nguyên này trong Follow Up Boss (403).", 403);
      if (!res.ok) {
        const text = (await res.text()).slice(0, 300);
        throw new FubError(`Follow Up Boss lỗi ${res.status}: ${text}`, res.status);
      }
      if (res.status === 204) return undefined as T;
      return (await res.json()) as T;
    }
  }

  /** Duyệt hết các trang của một collection. `key` là tên mảng trong response (vd. "people"). */
  async *paginate<T>(path: string, key: string, query: Record<string, string | number | undefined> = {}) {
    let page = await this.request<Record<string, unknown>>("GET", path, { query: { limit: 100, ...query } });
    for (let guard = 0; guard < 10_000; guard++) {
      for (const item of (page[key] as T[]) ?? []) yield item;
      const meta = (page._metadata ?? {}) as FubMetadata;
      if (meta.nextLink) page = await this.request("GET", meta.nextLink);
      else if (meta.next) page = await this.request("GET", path, { query: { limit: 100, ...query, next: meta.next } });
      else return;
    }
  }
}
