"use client";

import { useState, useCallback } from "react";
import { api } from "@/lib/api";
import { EmptyState } from "@/components/EmptyState";
import { UploadCloud, FileText, Loader2, CheckCircle } from "lucide-react";

export default function UploadPage({ params }: { params: { id: string } }) {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ count: number; names: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = Array.from(e.dataTransfer.files).filter((f) => f.name.toLowerCase().endsWith(".pdf"));
    setFiles((prev) => [...prev, ...dropped]);
  }, []);

  const handleSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []).filter((f) => f.name.toLowerCase().endsWith(".pdf"));
    setFiles((prev) => [...prev, ...selected]);
  };

  const doUpload = async () => {
    if (files.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      const res = await api.uploadDocuments(params.id, files);
      setResult({ count: res.count, names: res.uploaded.map((u: any) => u.filename) });
      setFiles([]);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-200 mb-1">Document Upload</h2>
      <p className="text-sm text-gray-500 mb-6">Upload PDF plan sets for this project.</p>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`rounded-xl border-2 border-dashed p-12 text-center transition-colors cursor-pointer ${
          dragOver ? "border-vulpine-orange bg-vulpine-orange/5" : "border-vulpine-border bg-vulpine-panel/30"
        }`}
        onClick={() => document.getElementById("file-input")?.click()}
      >
        <UploadCloud className="w-10 h-10 mx-auto text-vulpine-muted mb-3" />
        <p className="text-sm text-gray-400">Drag and drop PDF files here, or click to browse</p>
        <p className="text-xs text-gray-600 mt-1">PDF files only</p>
        <input
          id="file-input"
          type="file"
          accept=".pdf"
          multiple
          className="hidden"
          onChange={handleSelect}
        />
      </div>

      {/* Selected files */}
      {files.length > 0 && (
        <div className="mt-4 rounded-lg border border-vulpine-border bg-vulpine-panel/50 p-4">
          <h3 className="text-sm font-medium text-gray-300 mb-3">Selected Files ({files.length})</h3>
          <ul className="space-y-2">
            {files.map((f, i) => (
              <li key={i} className="flex items-center gap-2 text-sm text-gray-400">
                <FileText className="w-4 h-4 text-vulpine-muted" />
                {f.name}
                <span className="text-gray-600 text-xs">({(f.size / 1024 / 1024).toFixed(1)} MB)</span>
              </li>
            ))}
          </ul>
          <button
            onClick={doUpload}
            disabled={uploading}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-vulpine-orange px-4 py-2 text-sm font-medium text-white hover:bg-vulpine-orange/90 disabled:opacity-50 transition-colors"
          >
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
            {uploading ? "Uploading..." : "Upload Files"}
          </button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mt-4 rounded-lg border border-red-800 bg-red-900/20 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Success */}
      {result && (
        <div className="mt-4 rounded-lg border border-green-800 bg-green-900/20 px-4 py-3 text-sm text-green-400">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle className="w-4 h-4" />
            Uploaded {result.count} file(s)
          </div>
          <ul className="ml-6 text-xs text-green-500/80 list-disc">
            {result.names.map((n, i) => <li key={i}>{n}</li>)}
          </ul>
        </div>
      )}

      {/* Empty state when no files selected and no results */}
      {files.length === 0 && !result && !error && (
        <div className="mt-6">
          <EmptyState
            title="No documents uploaded"
            message="Upload plans to begin preflight."
          />
        </div>
      )}
    </div>
  );
}