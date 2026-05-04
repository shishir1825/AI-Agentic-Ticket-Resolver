import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "./client";
import type { DocumentDetail, UploadResponse } from "./client";

export function useDocument(documentId: string | undefined) {
  return useQuery<DocumentDetail>({
    queryKey: ["document", documentId],
    queryFn: () => api.get(`/api/documents/${documentId}`).then((r) => r.data),
    enabled: !!documentId,
  });
}

export function useUploadDocument() {
  const qc = useQueryClient();
  return useMutation<UploadResponse, Error, { file: File; uploaderId: string }>({
    mutationFn: async ({ file, uploaderId }) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("uploader_user_id", uploaderId);
      const resp = await api.post("/api/documents", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return resp.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["runs"] });
    },
  });
}
