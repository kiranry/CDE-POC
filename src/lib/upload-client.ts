export type UploadDocumentOptions = {
  folderId: string;
  file: File;
  description?: string;
  parentDocumentId?: string;
  versionNumber?: number;
};

export type UploadDocumentResult = {
  version: number;
  documentId: string;
};

async function uploadViaApi(
  options: UploadDocumentOptions,
): Promise<UploadDocumentResult> {
  const form = new FormData();
  form.append("file", options.file);
  form.append("folderId", options.folderId);
  if (options.description) form.append("description", options.description);
  if (options.parentDocumentId) {
    form.append("parentDocumentId", options.parentDocumentId);
  }
  if (options.versionNumber != null) {
    form.append("versionNumber", String(options.versionNumber));
  }

  const res = await fetch("/api/documents", { method: "POST", body: form });
  const text = await res.text();
  let data: { error?: string } = {};
  if (text) {
    try {
      data = JSON.parse(text) as { error?: string };
    } catch {
      throw new Error(
        res.ok ? "Invalid server response" : `Upload failed (${res.status})`,
      );
    }
  } else if (!res.ok) {
    throw new Error(`Upload failed (${res.status})`);
  }
  if (!res.ok) throw new Error(data.error ?? `Upload failed (${res.status})`);

  const result = JSON.parse(text) as {
    document?: { id: string; version: number };
  };
  return {
    documentId: result.document?.id ?? "",
    version: result.document?.version ?? 1,
  };
}

async function uploadDirectToStorage(
  options: UploadDocumentOptions,
): Promise<UploadDocumentResult> {
  const initRes = await fetch("/api/documents/upload-init", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      folderId: options.folderId,
      fileName: options.file.name,
      mimeType: options.file.type || "application/octet-stream",
      sizeBytes: options.file.size,
      description: options.description || undefined,
      parentDocumentId: options.parentDocumentId || undefined,
      versionNumber: options.versionNumber,
    }),
  });

  const initData = await initRes.json().catch(() => ({}));
  if (!initRes.ok) {
    throw new Error(
      typeof initData.error === "string"
        ? initData.error
        : `Upload init failed (${initRes.status})`,
    );
  }

  const contentType =
    (initData.headers?.["Content-Type"] as string | undefined) ||
    options.file.type ||
    "application/octet-stream";

  const putRes = await fetch(initData.uploadUrl as string, {
    method: (initData.method as string) || "PUT",
    headers: { "Content-Type": contentType },
    body: options.file,
  });

  if (!putRes.ok) {
    throw new Error(
      "Upload to storage failed. Check R2 CORS allows PUT from this CDE URL.",
    );
  }

  const completeRes = await fetch("/api/documents/upload-complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ uploadToken: initData.uploadToken }),
  });

  const completeData = await completeRes.json().catch(() => ({}));
  if (!completeRes.ok) {
    throw new Error(
      typeof completeData.error === "string"
        ? completeData.error
        : `Upload finalize failed (${completeRes.status})`,
    );
  }

  const result = completeData as {
    document?: { id: string; version: number };
  };
  return {
    documentId: result.document?.id ?? "",
    version: result.document?.version ?? 1,
  };
}

export async function uploadDocumentFile(
  options: UploadDocumentOptions,
): Promise<UploadDocumentResult> {
  const modeRes = await fetch("/api/documents/upload-mode");
  const modeData = await modeRes.json().catch(() => ({ directUpload: false }));

  if (modeData.directUpload) {
    return uploadDirectToStorage(options);
  }
  return uploadViaApi(options);
}

export type FolderDocumentOption = {
  id: string;
  name: string;
  currentVersion: number;
};

export async function fetchFolderDocuments(
  folderId: string,
): Promise<FolderDocumentOption[]> {
  const res = await fetch(`/api/documents?folderId=${folderId}`);
  const data = await res.json();
  return (data.documents ?? []).map(
    (doc: { id: string; name: string; currentVersion: number }) => ({
      id: doc.id,
      name: doc.name,
      currentVersion: doc.currentVersion,
    }),
  );
}
