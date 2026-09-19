import React, { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Platform, Pressable, Text, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { apiFetch, refreshCrewSession } from "../api/client";
import {
  CrewAttachment,
  crewInformationApi,
  LocalCrewFile,
} from "../api/crewInformationApi";
import { Button, palette, StateView, styles } from "./CrewUI";
import { useCancelableTransfer } from "../hooks/useCancelableTransfer";

const DEFAULT_MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["application/pdf", "image/png", "image/jpeg"];

function formatBytes(raw: string | null): string {
  const bytes = Number(raw);
  if (!Number.isFinite(bytes) || bytes <= 0) return "Size unavailable";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function typeFromName(name: string, declared?: string | null): string {
  if (declared && ALLOWED_TYPES.includes(declared)) return declared;
  if (/\.pdf$/i.test(name)) return "application/pdf";
  if (/\.png$/i.test(name)) return "image/png";
  if (/\.jpe?g$/i.test(name)) return "image/jpeg";
  return declared || "application/octet-stream";
}

function validateLocalFile(file: LocalCrewFile, maxBytes: number): string | null {
  if (!ALLOWED_TYPES.includes(file.type)) return "Only PDF, PNG, and JPEG files are allowed.";
  if (file.size && file.size > maxBytes) return `The selected file exceeds the ${Math.round(maxBytes / (1024 * 1024))} MB size limit.`;
  return null;
}

export default function CrewAttachments({
  collection,
  parentUuid,
  writable,
  maxBytes = DEFAULT_MAX_BYTES,
}: {
  collection: string;
  parentUuid: string;
  writable: boolean;
  /** From the server's attachmentRules.maxBytes — falls back to a sane default if the caller doesn't have it yet. */
  maxBytes?: number;
}) {
  const [attachments, setAttachments] = useState<CrewAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<"idle" | "uploading" | "failed" | "success" | "downloading" | "cancelled">("idle");
  const [message, setMessage] = useState("");
  const retryFile = useRef<LocalCrewFile | null>(null);
  const retrySince = useRef<number | null>(null);
  const transfer = useCancelableTransfer();

  const load = useCallback(async () => {
    if (transfer.isMounted()) { setLoading(true); setError(""); }
    try {
      const rows = await crewInformationApi.listAttachments(collection, parentUuid);
      if (transfer.isMounted()) setAttachments(rows);
    } catch (reason: any) {
      if (transfer.isMounted()) setError(reason.message);
    } finally {
      if (transfer.isMounted()) setLoading(false);
    }
  }, [collection, parentUuid, transfer]);

  useEffect(() => { load(); }, [load]);

  const startUpload = async (file: LocalCrewFile) => {
    if (!transfer.isMounted() || transfer.isBusy()) return;
    const validation = validateLocalFile(file, maxBytes);
    if (validation) {
      retryFile.current = null;
      setStatus("failed");
      setMessage(validation);
      return;
    }
    const handle = transfer.begin(() => {
      setStatus("cancelled");
      setMessage("Upload cancelled");
      setTimeout(() => { if (transfer.isMounted()) load(); }, 500);
    });
    if (!handle) return;
    retryFile.current = file;
    setStatus("uploading");
    setMessage(`Uploading ${file.name}`);
    setProgress(0);
    let startedAt = Date.now();
    try {
      // Refresh an expired token before XHR starts; XHR is retained for native
      // upload progress and cancellation.
      const before = await crewInformationApi.listAttachments(collection, parentUuid);
      if (!handle.isCurrent()) return;
      if (retrySince.current) {
        const reconciled = before.find((item) =>
          (!file.size || item.fileSize === String(file.size)) &&
          item.fileType === file.type &&
          item.createdAt && new Date(item.createdAt).getTime() >= retrySince.current! - 5_000,
        );
        if (reconciled) {
          retryFile.current = null;
          retrySince.current = null;
          setAttachments(before);
          setStatus("success");
          setProgress(100);
          setMessage(`${reconciled.fileName} uploaded`);
          return;
        }
      }
      startedAt = Date.now();
      const xfer = crewInformationApi.uploadAttachment(collection, parentUuid, file, setProgress);
      handle.setCancel(xfer.cancel);
      const uploaded = await xfer.promise;
      if (!handle.isCurrent()) return;
      retryFile.current = null;
      retrySince.current = null;
      setAttachments((current) => [...current, uploaded]);
      setStatus("success");
      setProgress(100);
      setMessage(`${uploaded.fileName} uploaded`);
    } catch (reason: any) {
      if (!handle.isCurrent()) return;
      if (reason?.cancelled) {
        setStatus("cancelled");
        setMessage("Upload cancelled");
      } else {
        if (reason?.ambiguous) retrySince.current = startedAt;
        setStatus("failed");
        setMessage(reason.message || "Upload failed");
      }
    } finally {
      handle.finish();
    }
  };

  const pickPhoto = async () => {
    if (Platform.OS !== "web") {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!transfer.isMounted()) return;
      if (!permission.granted) {
        setStatus("failed");
        setMessage("Photo access is required to choose an image.");
        return;
      }
    }
    // quality: 1 (no compression) routinely produces camera-roll photos over
    // the 5MB cap, which the validation below then just rejects outright —
    // 0.7 keeps images visually fine for document/certificate photos while
    // giving most shots real headroom under the limit.
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.7 });
    if (!transfer.isMounted() || result.canceled) return;
    const asset = result.assets[0];
    const name = asset.fileName || `crew-photo-${Date.now()}.jpg`;
    await startUpload({ uri: asset.uri, name, type: typeFromName(name, asset.mimeType), size: asset.fileSize, file: asset.file });
  };

  const pickDocument = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ALLOWED_TYPES,
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (!transfer.isMounted() || result.canceled) return;
    const asset = result.assets[0];
    await startUpload({ uri: asset.uri, name: asset.name, type: typeFromName(asset.name, asset.mimeType), size: asset.size, file: asset.file });
  };

  const cancel = () => transfer.cancel();

  const retry = () => {
    if (retryFile.current) startUpload(retryFile.current);
  };

  const openAttachment = async (attachment: CrewAttachment, download: boolean) => {
    const handle = transfer.begin(() => { setStatus("cancelled"); setMessage("Transfer cancelled"); });
    if (!handle) return;
    setStatus("downloading");
    setProgress(0);
    setMessage(`${download ? "Downloading" : "Opening"} ${attachment.fileName}`);
    try {
      // Refreshes an expired token through the shared authenticated client and
      // confirms the attachment is still available before native download.
      await crewInformationApi.listAttachments(collection, parentUuid);
      if (!handle.isCurrent()) return;
      const path = crewInformationApi.attachmentPath(collection, parentUuid, attachment.attUuid);
      if (Platform.OS === "web") {
        const controller = new AbortController();
        handle.setCancel(() => controller.abort());
        const response = await apiFetch(path, { signal: controller.signal });
        if (!response.ok) throw new Error("Unable to download this attachment");
        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        if (download) {
          const anchor = document.createElement("a");
          anchor.href = objectUrl;
          anchor.download = attachment.fileName;
          anchor.click();
        } else {
          window.open(objectUrl, "_blank", "noopener,noreferrer");
        }
        setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
      } else {
        const safeName = attachment.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
        const destination = `${FileSystem.cacheDirectory}crew-${attachment.attUuid}-${safeName}`;
        const downloadNative = async (refreshed: boolean): Promise<string> => {
          if (!handle.isCurrent()) {
            throw Object.assign(new Error("Download cancelled"), { cancelled: true });
          }
          const request = crewInformationApi.authorizedAttachmentUrl(collection, parentUuid, attachment.attUuid);
          const resumable = FileSystem.createDownloadResumable(
            request.url,
            destination,
            { headers: request.headers },
            ({ totalBytesWritten, totalBytesExpectedToWrite }) => {
              if (handle.isCurrent() && totalBytesExpectedToWrite > 0) setProgress(Math.round((totalBytesWritten / totalBytesExpectedToWrite) * 100));
            },
          );
          handle.setCancel(() => { void resumable.pauseAsync(); });
          const result = await resumable.downloadAsync();
          if (!result) throw Object.assign(new Error("Download cancelled"), { cancelled: true });
          if (result.status === 401 && !refreshed) {
            const didRefresh = await refreshCrewSession();
            if (!handle.isCurrent()) {
              throw Object.assign(new Error("Download cancelled"), { cancelled: true });
            }
            if (didRefresh) return downloadNative(true);
          }
          if (result.status < 200 || result.status >= 300) throw new Error("Unable to download this attachment");
          return result.uri;
        };
        try {
          const uri = await downloadNative(false);
          if (!handle.isCurrent()) return;
          if (!(await Sharing.isAvailableAsync())) throw new Error("No app is available to open this file.");
          await Sharing.shareAsync(uri, { mimeType: attachment.fileType || undefined, dialogTitle: download ? "Save attachment" : "Open attachment" });
        } finally {
          await FileSystem.deleteAsync(destination, { idempotent: true }).catch(() => {});
        }
      }
      if (!handle.isCurrent()) return;
      setStatus("success");
      setProgress(100);
      setMessage(`${attachment.fileName} is ready`);
    } catch (reason: any) {
      if (!handle.isCurrent()) return;
      const cancelled = reason?.cancelled || reason?.name === "AbortError";
      setStatus(cancelled ? "cancelled" : "failed");
      setMessage(cancelled ? "Transfer cancelled" : reason?.message || "Transfer failed");
    } finally {
      handle.finish();
    }
  };

  const remove = (attachment: CrewAttachment) => {
    Alert.alert("Delete attachment?", `${attachment.fileName} will be permanently removed.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => transfer.withLock(async () => {
          try {
            await crewInformationApi.removeAttachment(collection, parentUuid, attachment.attUuid);
            setAttachments((current) => current.filter((item) => item.attUuid !== attachment.attUuid));
            setStatus("success");
            setMessage(`${attachment.fileName} deleted`);
          } catch (reason: any) {
            setStatus("failed");
            setMessage(reason.message || "Could not delete attachment");
          }
        }),
      },
    ]);
  };

  const active = status === "uploading" || status === "downloading";
  return <View style={{ marginTop: 24 }}>
    <Text style={styles.sectionHeader}>Files</Text>
    <Text style={styles.subtitle}>PDF, PNG, or JPEG. Maximum file size {Math.round(maxBytes / (1024 * 1024))} MB.</Text>
    {writable ? <View style={{ flexDirection: "row", gap: 10 }}>
      <View style={{ flex: 1 }}><Button title="Choose photo" secondary disabled={active} onPress={pickPhoto} /></View>
      <View style={{ flex: 1 }}><Button title="Choose file" secondary disabled={active} onPress={pickDocument} /></View>
    </View> : null}
    {status !== "idle" ? <View style={styles.card}>
      <Text accessibilityLiveRegion="polite" style={styles.cardTitle}>{message}</Text>
      {active ? <View style={{ height: 7, borderRadius: 4, backgroundColor: palette.line, marginTop: 12 }}><View style={{ height: 7, borderRadius: 4, backgroundColor: palette.teal, width: `${progress}%` }} /></View> : null}
      {active ? <Button title="Cancel transfer" secondary onPress={cancel} /> : null}
      {status === "failed" && retryFile.current ? <Button title="Retry upload" onPress={retry} /> : null}
    </View> : null}
    <StateView loading={loading} error={error} retry={load} empty={!attachments.length ? "No files attached" : undefined}>
      {attachments.map((attachment) => <View key={attachment.attUuid} style={styles.card}>
        <Text style={styles.cardTitle}>{attachment.fileName}</Text>
        <Text style={styles.cardMeta}>{attachment.fileType || "File"} · {formatBytes(attachment.fileSize)}</Text>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1 }}><Button title="View" secondary disabled={active} onPress={() => openAttachment(attachment, false)} /></View>
          <View style={{ flex: 1 }}><Button title="Download" secondary disabled={active} onPress={() => openAttachment(attachment, true)} /></View>
        </View>
        {writable && attachment.canDelete ? <Pressable accessibilityRole="button" accessibilityLabel={`Delete ${attachment.fileName}`} disabled={active} onPress={() => remove(attachment)} style={{ minHeight: 44, justifyContent: "center", marginTop: 8 }}><Text style={{ color: "#B74646", fontWeight: "800", textAlign: "center" }}>Delete</Text></Pressable> : null}
      </View>)}
    </StateView>
  </View>;
}