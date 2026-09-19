import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import CrewAttachments from "../CrewAttachments";
import { crewInformationApi } from "../../api/crewInformationApi";

jest.mock("expo-document-picker", () => ({
  getDocumentAsync: jest.fn(),
}));
jest.mock("expo-image-picker", () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));
jest.mock("expo-file-system/legacy", () => ({
  cacheDirectory: "file:///cache/",
  createDownloadResumable: jest.fn(),
  deleteAsync: jest.fn(),
}));
jest.mock("expo-sharing", () => ({
  isAvailableAsync: jest.fn(),
  shareAsync: jest.fn(),
}));
jest.mock("../../api/client", () => ({
  apiFetch: jest.fn(),
  refreshCrewSession: jest.fn(),
}));
jest.mock("../../api/crewInformationApi", () => ({
  crewInformationApi: {
    listAttachments: jest.fn(),
    uploadAttachment: jest.fn(),
    removeAttachment: jest.fn(),
    attachmentPath: jest.fn(),
    authorizedAttachmentUrl: jest.fn(),
  },
}));

const mockedApi = crewInformationApi as jest.Mocked<typeof crewInformationApi>;
const DocumentPicker = require("expo-document-picker");

function queuePickedFile(name = "cert.pdf", size = 1000) {
  DocumentPicker.getDocumentAsync.mockResolvedValueOnce({
    canceled: false,
    assets: [{ uri: "file:///tmp/cert.pdf", name, mimeType: "application/pdf", size }],
  });
}

function uploadedRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    attUuid: "a-new",
    fileName: "cert.pdf",
    fileType: "application/pdf",
    fileSize: "1000",
    createdAt: new Date().toISOString(),
    canDelete: true,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  // Default for every listAttachments() call not overridden with a *Once —
  // startUpload() calls this both to refresh the list on load and again as
  // its own "before" snapshot on every attempt/retry.
  mockedApi.listAttachments.mockResolvedValue([]);
});

async function renderAndWaitForLoad() {
  render(<CrewAttachments collection="documents" parentUuid="doc-1" writable />);
  await waitFor(() => expect(mockedApi.listAttachments).toHaveBeenCalledTimes(1));
}

describe("CrewAttachments", () => {
  test("loads and displays existing attachments on mount", async () => {
    mockedApi.listAttachments.mockResolvedValueOnce([uploadedRow({ attUuid: "old-1", fileName: "old.pdf" })]);
    render(<CrewAttachments collection="documents" parentUuid="doc-1" writable />);
    expect(await screen.findByText("old.pdf")).toBeTruthy();
  });

  test("a successful upload appends the new attachment and shows a success message", async () => {
    queuePickedFile();
    mockedApi.uploadAttachment.mockReturnValue({ promise: Promise.resolve(uploadedRow()), cancel: jest.fn() });

    await renderAndWaitForLoad();
    fireEvent.press(screen.getByText("Choose file"));

    await waitFor(() => expect(screen.getByText("cert.pdf uploaded")).toBeTruthy());
    expect(mockedApi.uploadAttachment).toHaveBeenCalledTimes(1);
  });

  test("an ambiguous failure followed by a matching retry reconciles instead of re-uploading", async () => {
    queuePickedFile("cert.pdf", 1000);
    // Lazy (mockImplementationOnce, not a pre-built Promise.reject) so the
    // rejection is created and immediately caught by startUpload()'s own
    // try/catch at call time — not sitting around unhandled from test setup.
    mockedApi.uploadAttachment.mockImplementationOnce(() => ({
      promise: Promise.reject(Object.assign(new Error("Upload status is unknown."), { ambiguous: true })),
      cancel: jest.fn(),
    }));

    await renderAndWaitForLoad();
    fireEvent.press(screen.getByText("Choose file"));

    await waitFor(() => expect(screen.getByText("Retry upload")).toBeTruthy());
    expect(mockedApi.uploadAttachment).toHaveBeenCalledTimes(1);

    // The retry's own "before" snapshot now shows the upload actually went
    // through server-side (a matching row, created after the attempt
    // started) — it must reconcile instead of firing a duplicate upload.
    mockedApi.listAttachments.mockResolvedValueOnce([uploadedRow({ attUuid: "reconciled-1" })]);

    fireEvent.press(screen.getByText("Retry upload"));

    await waitFor(() => expect(screen.getByText("cert.pdf uploaded")).toBeTruthy());
    expect(mockedApi.uploadAttachment).toHaveBeenCalledTimes(1); // still 1 — no duplicate upload fired
  });

  test("an ambiguous failure followed by a retry with no matching row re-uploads for real", async () => {
    queuePickedFile("cert.pdf", 1000);
    mockedApi.uploadAttachment
      .mockImplementationOnce(() => ({
        promise: Promise.reject(Object.assign(new Error("Upload status is unknown."), { ambiguous: true })),
        cancel: jest.fn(),
      }))
      .mockReturnValueOnce({ promise: Promise.resolve(uploadedRow({ attUuid: "real-retry-1" })), cancel: jest.fn() });

    await renderAndWaitForLoad();
    fireEvent.press(screen.getByText("Choose file"));
    await waitFor(() => expect(screen.getByText("Retry upload")).toBeTruthy());

    // "before" snapshot on retry: nothing matching exists server-side yet.
    mockedApi.listAttachments.mockResolvedValueOnce([]);

    fireEvent.press(screen.getByText("Retry upload"));

    await waitFor(() => expect(mockedApi.uploadAttachment).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByText("cert.pdf uploaded")).toBeTruthy());
  });

  test("a non-ambiguous failure (e.g. validation rejection from the server) does not set up reconciliation", async () => {
    queuePickedFile("cert.pdf", 1000);
    mockedApi.uploadAttachment.mockImplementationOnce(() => ({
      promise: Promise.reject(Object.assign(new Error("File too large"), { status: 413 })),
      cancel: jest.fn(),
    }));

    await renderAndWaitForLoad();
    fireEvent.press(screen.getByText("Choose file"));

    await waitFor(() => expect(screen.getByText("File too large")).toBeTruthy());

    mockedApi.uploadAttachment.mockReturnValueOnce({ promise: Promise.resolve(uploadedRow()), cancel: jest.fn() });
    fireEvent.press(screen.getByText("Retry upload"));

    // Retrying a genuine (non-ambiguous) failure should just re-attempt the
    // upload directly — the reconciliation branch only activates after an
    // *ambiguous* (network-unknown) failure.
    await waitFor(() => expect(screen.getByText("cert.pdf uploaded")).toBeTruthy());
    expect(mockedApi.uploadAttachment).toHaveBeenCalledTimes(2);
  });

  test("Cancel transfer aborts the in-flight upload via the underlying cancel() and shows cancelled status", async () => {
    queuePickedFile();
    const cancelSpy = jest.fn();
    mockedApi.uploadAttachment.mockReturnValue({ promise: new Promise(() => {}), cancel: cancelSpy });

    await renderAndWaitForLoad();
    fireEvent.press(screen.getByText("Choose file"));

    await waitFor(() => expect(mockedApi.uploadAttachment).toHaveBeenCalled());
    fireEvent.press(screen.getByText("Cancel transfer"));

    expect(cancelSpy).toHaveBeenCalled();
    await waitFor(() => expect(screen.getByText("Upload cancelled")).toBeTruthy());
  });

  test("pressing Choose file again while an upload is already in flight is ignored (transfer lock)", async () => {
    queuePickedFile();
    queuePickedFile(); // a second picker resolution queued, in case the lock fails to hold
    mockedApi.uploadAttachment.mockReturnValue({ promise: new Promise(() => {}), cancel: jest.fn() });

    await renderAndWaitForLoad();
    fireEvent.press(screen.getByText("Choose file"));
    await waitFor(() => expect(mockedApi.uploadAttachment).toHaveBeenCalledTimes(1));

    fireEvent.press(screen.getByText("Choose file"));

    // Give any errant second flow a chance to run, then confirm it didn't.
    await new Promise((resolve) => setImmediate(resolve));
    expect(mockedApi.uploadAttachment).toHaveBeenCalledTimes(1);
  });
});
