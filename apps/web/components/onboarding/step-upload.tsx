"use client";

import { useState, useRef } from "react";
import { UploadCloud, FileText, Loader2, AlertCircle, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { type ResumeData } from "@qlam/core";

interface StepUploadProps {
  existingResume?: {
    id: string;
    filePath: string;
    parsed: ResumeData;
  } | null;
  onComplete: (data: { resumeId: string; parsed: ResumeData }) => void;
}

const MAX_SIZE_MB = 10;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

export function StepUpload({ existingResume, onComplete }: StepUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const validateFile = (selectedFile: File): string | null => {
    const isPdf =
      selectedFile.type === "application/pdf" ||
      selectedFile.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      return "Only PDF resumes are supported. Please choose a .pdf file.";
    }
    if (selectedFile.size > MAX_SIZE_BYTES) {
      return `File exceeds the ${MAX_SIZE_MB}MB size limit.`;
    }
    return null;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    const validationError = validateFile(selected);
    if (validationError) {
      setError(validationError);
      setFile(null);
      return;
    }
    setError(null);
    setFile(selected);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files?.[0];
    if (!dropped) return;
    const validationError = validateFile(dropped);
    if (validationError) {
      setError(validationError);
      setFile(null);
      return;
    }
    setError(null);
    setFile(dropped);
  };

  const handleUploadAndParse = async () => {
    if (!file) return;

    setIsLoading(true);
    setError(null);
    setStatusMessage("Uploading and extracting text from PDF...");

    try {
      const formData = new FormData();
      formData.append("file", file);

      setStatusMessage("Parsing with Gemini AI...");
      const res = await fetch("/api/resume", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to parse resume.");
      }

      onComplete({
        resumeId: data.resume.id,
        parsed: data.parsed,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong during parsing.");
    } finally {
      setIsLoading(false);
      setStatusMessage("");
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-xl sm:text-2xl">Upload Your Resume</CardTitle>
        <CardDescription>
          Upload your resume in PDF format. Qlam will parse your experience, skills, and education
          to tailor your job applications.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {existingResume && !file && (
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-5 w-5 text-primary shrink-0" />
              <div>
                <p className="text-sm font-medium text-foreground">
                  Resume already uploaded: {existingResume.parsed.basics.name || "Default Resume"}
                </p>
                <p className="text-xs text-muted-foreground">
                  You can continue with your existing profile or upload a new PDF below.
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                onComplete({
                  resumeId: existingResume.id,
                  parsed: existingResume.parsed,
                })
              }
            >
              Use Existing Resume
            </Button>
          </div>
        )}

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => !isLoading && inputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
            isDragging
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/50 hover:bg-muted/30"
          } ${isLoading ? "opacity-60 cursor-not-allowed" : ""}`}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,application/pdf"
            className="hidden"
            onChange={handleFileChange}
            disabled={isLoading}
          />

          <div className="flex flex-col items-center justify-center space-y-3">
            <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <UploadCloud className="h-7 w-7" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">
                Click to browse or drag and drop your PDF resume here
              </p>
              <p className="text-xs text-muted-foreground">PDF only, maximum 10 MB</p>
            </div>
          </div>
        </div>

        {file && (
          <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-card">
            <div className="flex items-center gap-3 truncate">
              <FileText className="h-5 w-5 text-primary shrink-0" />
              <div className="truncate text-left">
                <p className="text-sm font-medium text-foreground truncate">{file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {(file.size / (1024 * 1024)).toFixed(2)} MB
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              disabled={isLoading}
              onClick={() => setFile(null)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Remove
            </Button>
          </div>
        )}

        {error && (
          <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-destructive flex items-start gap-2.5 text-xs sm:text-sm">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex justify-end pt-2">
          <Button
            onClick={handleUploadAndParse}
            disabled={!file || isLoading}
            className="w-full sm:w-auto min-w-[140px]"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {statusMessage || "Processing..."}
              </>
            ) : (
              "Upload & Continue"
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
