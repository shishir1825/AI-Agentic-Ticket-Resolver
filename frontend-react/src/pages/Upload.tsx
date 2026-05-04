import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDropzone } from "react-dropzone";
import { Upload as UploadIcon, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import PageHeader from "@/components/layout/PageHeader";
import StepIndicator from "@/components/workflow/StepIndicator";
import { useRuns } from "@/api/runs";
import { useUploadDocument } from "@/api/documents";
import { useTriggerAgent1 } from "@/api/runs";
import type { Role } from "@/lib/constants";
import { cn } from "@/lib/utils";

const ACCEPTED_TYPES = {
  "application/pdf": [".pdf"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
  "text/plain": [".txt"],
  "text/markdown": [".md"],
};

interface UploadProps {
  role: Role;
}

export default function Upload({ role }: UploadProps) {
  const navigate = useNavigate();
  const [uploaderId, setUploaderId] = useState("gtm-user");
  const [uploadedRunId, setUploadedRunId] = useState<string | null>(null);
  const [uploadedFilename, setUploadedFilename] = useState<string | null>(null);

  const { data: runs = [] } = useRuns();
  const uploadMutation = useUploadDocument();
  const triggerAgent1 = useTriggerAgent1();
  const isUploading = uploadMutation.isPending || triggerAgent1.isPending;

  const handleUpload = () => {
    const file = acceptedFiles[0];
    if (!file) return;
    uploadMutation.mutate(
      { file, uploaderId },
      {
        onSuccess: (data) => {
          triggerAgent1.mutate(data.run_id, {
            onSuccess: () => {
              setUploadedRunId(data.run_id);
              setUploadedFilename(data.filename);
            },
          });
        },
      }
    );
  };

  const { getRootProps, getInputProps, acceptedFiles, isDragActive } = useDropzone({
    accept: ACCEPTED_TYPES,
    maxFiles: 1,
    disabled: isUploading,
  });

  const selectedFile = acceptedFiles[0];
  const canUpload = !!selectedFile && !isUploading;
  const recentRuns = runs.slice(0, 5);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Upload Document"
        description="Upload a CRI document (PDF, DOCX, TXT, MD) to start the workflow"
      />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Upload form - wider */}
        <div className="space-y-6 lg:col-span-2">
          {uploadedRunId ? (
            <Card className="border-cb-success/30 bg-cb-success/5 scale-pop">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-cb-success">
                  <FileText className="h-5 w-5" />
                  Upload complete
                </CardTitle>
                <CardDescription>
                  Run ID: {uploadedRunId}
                  {uploadedFilename && ` • ${uploadedFilename}`}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <StepIndicator currentStep="agent1" status="processing" />
                <div className="flex gap-2">
                  <Button onClick={() => navigate(`/review/${uploadedRunId}`)}>
                    View Extraction
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setUploadedRunId(null);
                      setUploadedFilename(null);
                    }}
                  >
                    Upload another
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    <div>
                      <label className="mb-2 block text-sm font-medium">Your Name / ID</label>
                      <Input
                        value={uploaderId}
                        onChange={(e) => setUploaderId(e.target.value)}
                        placeholder="gtm-user"
                      />
                    </div>
                    <div
                      {...getRootProps()}
                      className={cn(
                        "flex min-h-[200px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors",
                        isDragActive && "border-cb-blue bg-cb-blue/5",
                        !isDragActive && "border-muted-foreground/25 hover:border-muted-foreground/50 hover:bg-muted/30",
                        isUploading && "pointer-events-none opacity-60"
                      )}
                    >
                      <input {...getInputProps()} />
                      {isUploading ? (
                        <Loader2 className="h-12 w-12 animate-spin text-cb-blue" />
                      ) : selectedFile ? (
                        <p className="text-sm font-medium">{selectedFile.name}</p>
                      ) : (
                        <UploadIcon className="h-12 w-12 text-muted-foreground" />
                      )}
                      <p className="mt-2 text-center text-sm text-muted-foreground">
                        {isDragActive
                          ? "Drop the file here"
                          : "Drag & drop a file here, or click to select"}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        PDF, DOCX, TXT, MD
                      </p>
                    </div>
                    <Button
                      onClick={handleUpload}
                      disabled={!canUpload}
                      className="w-full ripple"
                    >
                      {isUploading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Uploading…
                        </>
                      ) : (
                        "Upload"
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        {/* Recent uploads sidebar */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent Uploads</CardTitle>
              <CardDescription>Last 5 runs</CardDescription>
            </CardHeader>
            <CardContent>
              {recentRuns.length === 0 ? (
                <p className="text-sm text-muted-foreground">No uploads yet</p>
              ) : (
                <ul className="space-y-2">
                  {recentRuns.map((run) => (
                    <li key={run.id}>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-auto w-full justify-start py-2 text-left font-normal"
                        onClick={() => navigate(`/review/${run.id}`)}
                      >
                        <span className="truncate">
                          {run.document_filename ?? run.id.slice(0, 8)}
                        </span>
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
