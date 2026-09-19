import { crewInformationApi } from "../crewInformationApi";
import { refreshCrewSession } from "../client";
import { tokenStore } from "../../auth/tokenStore";

// uploadAttachment uses raw XMLHttpRequest (not fetch) for upload progress —
// jest-expo's test environment doesn't define a global XMLHttpRequest, so a
// minimal controllable fake stands in for it.
class FakeXHR {
  static instances: FakeXHR[] = [];
  method = "";
  url = "";
  headers: Record<string, string> = {};
  status = 0;
  responseText = "";
  upload: { onprogress: ((event: { lengthComputable: boolean; loaded: number; total: number }) => void) | null } = {
    onprogress: null,
  };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;
  sentData: unknown = null;
  aborted = false;

  constructor() {
    FakeXHR.instances.push(this);
  }
  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }
  setRequestHeader(name: string, value: string) {
    this.headers[name] = value;
  }
  send(data: unknown) {
    this.sentData = data;
  }
  abort() {
    this.aborted = true;
    this.onabort?.();
  }

  /** Test helper: simulate the server responding. */
  respond(status: number, body: unknown) {
    this.status = status;
    this.responseText = JSON.stringify(body);
    this.onload?.();
  }
}

(global as any).XMLHttpRequest = FakeXHR;

jest.mock("../client", () => ({
  apiFetch: jest.fn(),
  parseOrThrow: jest.fn(),
  refreshCrewSession: jest.fn(),
}));

jest.mock("../../auth/tokenStore", () => ({
  tokenStore: { get: jest.fn() },
}));

const mockedRefresh = refreshCrewSession as jest.Mock;
const mockedTokenStoreGet = (tokenStore as any).get as jest.Mock;

const testFile = { uri: "file:///tmp/x.pdf", name: "x.pdf", type: "application/pdf" };

/** A complete CrewAttachment response body — the real contract requires all these fields (some nullable, none optional/missing). */
function attachmentBody(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    attUuid: "att-1",
    fileName: "x.pdf",
    fileType: "application/pdf",
    fileSize: "1000",
    createdAt: new Date().toISOString(),
    canDelete: true,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  FakeXHR.instances = [];
  mockedTokenStoreGet.mockReturnValue({ accessToken: "access-1" });
});

describe("crewInformationApi.uploadAttachment", () => {
  test("resolves with the parsed body on a successful upload", async () => {
    const { promise } = crewInformationApi.uploadAttachment("documents", "doc-1", testFile, jest.fn());
    expect(FakeXHR.instances).toHaveLength(1);
    const body = attachmentBody();
    FakeXHR.instances[0].respond(201, body);

    await expect(promise).resolves.toEqual(body);
  });

  test("rejects if the server's success response doesn't match the expected shape", async () => {
    const { promise } = crewInformationApi.uploadAttachment("documents", "doc-1", testFile, jest.fn());
    const rejection = expect(promise).rejects.toThrow("Upload succeeded but the server's response was unexpected.");
    FakeXHR.instances[0].respond(201, { attUuid: "att-1", fileName: "x.pdf" }); // missing required fields
    await rejection;
  });

  test("attaches the current access token as a Bearer header on the initial attempt", () => {
    crewInformationApi.uploadAttachment("documents", "doc-1", testFile, jest.fn());
    expect(FakeXHR.instances[0].headers.Authorization).toBe("Bearer access-1");
  });

  test("reports upload progress via xhr.upload.onprogress", () => {
    const onProgress = jest.fn();
    crewInformationApi.uploadAttachment("documents", "doc-1", testFile, onProgress);

    FakeXHR.instances[0].upload.onprogress!({ lengthComputable: true, loaded: 25, total: 100 });

    expect(onProgress).toHaveBeenCalledWith(25);
  });

  test("on 401, refreshes once and retries with a second XHR carrying the new token", async () => {
    mockedRefresh.mockResolvedValue(true);
    mockedTokenStoreGet
      .mockReturnValueOnce({ accessToken: "access-1" }) // initial attempt
      .mockReturnValueOnce({ accessToken: "access-2" }); // retry, after refresh

    const { promise } = crewInformationApi.uploadAttachment("documents", "doc-1", testFile, jest.fn());
    FakeXHR.instances[0].respond(401, { error: "Unauthorized" });

    // The retry XHR is created asynchronously (refreshCrewSession() is awaited first).
    await new Promise((resolve) => setImmediate(resolve));
    expect(FakeXHR.instances).toHaveLength(2);
    expect(FakeXHR.instances[1].headers.Authorization).toBe("Bearer access-2");

    const body = attachmentBody();
    FakeXHR.instances[1].respond(200, body);
    await expect(promise).resolves.toEqual(body);
    expect(mockedRefresh).toHaveBeenCalledTimes(1);
  });

  test("a 401 after the retry already happened is not retried again — rejects instead", async () => {
    mockedRefresh.mockResolvedValue(true);
    const { promise } = crewInformationApi.uploadAttachment("documents", "doc-1", testFile, jest.fn());
    FakeXHR.instances[0].respond(401, { error: "Unauthorized" });
    await new Promise((resolve) => setImmediate(resolve));

    FakeXHR.instances[1].respond(401, { error: "Unauthorized" });

    await expect(promise).rejects.toMatchObject({ status: 401 });
    expect(FakeXHR.instances).toHaveLength(2); // no third attempt
  });

  test("when refresh fails, the upload rejects without a second XHR attempt", async () => {
    mockedRefresh.mockResolvedValue(false);
    const { promise } = crewInformationApi.uploadAttachment("documents", "doc-1", testFile, jest.fn());
    FakeXHR.instances[0].respond(401, { error: "Unauthorized" });

    await expect(promise).rejects.toMatchObject({ status: 401 });
    expect(FakeXHR.instances).toHaveLength(1);
  });

  test("a network-level error rejects as ambiguous, not as a normal failure", async () => {
    const { promise } = crewInformationApi.uploadAttachment("documents", "doc-1", testFile, jest.fn());
    FakeXHR.instances[0].onerror?.();

    await expect(promise).rejects.toMatchObject({ ambiguous: true });
  });

  test("cancel() aborts the in-flight XHR and rejects as cancelled", async () => {
    const { promise, cancel } = crewInformationApi.uploadAttachment("documents", "doc-1", testFile, jest.fn());
    cancel();

    expect(FakeXHR.instances[0].aborted).toBe(true);
    await expect(promise).rejects.toMatchObject({ cancelled: true });
  });

  test("cancel() called after a queued retry prevents the retry from actually sending", async () => {
    mockedRefresh.mockResolvedValue(true);
    const { promise, cancel } = crewInformationApi.uploadAttachment("documents", "doc-1", testFile, jest.fn());
    // Attached before the rejection actually happens below, so Node never
    // sees an unhandled-rejection window between the two.
    const rejection = expect(promise).rejects.toMatchObject({ cancelled: true });

    FakeXHR.instances[0].respond(401, { error: "Unauthorized" });
    cancel(); // races the in-flight refresh
    await new Promise((resolve) => setImmediate(resolve));

    await rejection;
  });
});
