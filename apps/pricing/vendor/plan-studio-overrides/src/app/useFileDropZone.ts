import { useCallback, useEffect, useRef, useState, type DragEvent } from "react";

export function useFileDropZone(
  chooseFile: (file: File) => Promise<void> | void,
  chooseFiles?: (files: File[]) => void,
  onError?: (message: string) => void,
) {
  const dragDepthRef = useRef(0);
  const [dragActive, setDragActive] = useState(false);

  const clearDragState = useCallback(() => {
    dragDepthRef.current = 0;
    setDragActive(false);
  }, []);

  useEffect(() => {
    window.addEventListener("blur", clearDragState);
    window.addEventListener("dragend", clearDragState);
    window.addEventListener("drop", clearDragState);
    document.addEventListener("visibilitychange", clearDragState);
    return () => {
      window.removeEventListener("blur", clearDragState);
      window.removeEventListener("dragend", clearDragState);
      window.removeEventListener("drop", clearDragState);
      document.removeEventListener("visibilitychange", clearDragState);
    };
  }, [clearDragState]);

  function handleDragEnter(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    dragDepthRef.current += 1;
    setDragActive(true);
  }

  function handleDragOver(event: DragEvent<HTMLElement>) {
    event.preventDefault();
  }

  function handleDragLeave(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) clearDragState();
  }

  function handleDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    clearDragState();
    if (chooseFiles) {
      void collectDroppedFiles(event.dataTransfer)
        .then(chooseFiles)
        .catch((error: unknown) => {
          onError?.(error instanceof Error ? error.message : "Could not read dropped folder.");
        });
      return;
    }
    const file = event.dataTransfer.files[0];
    if (file) void chooseFile(file);
  }

  return { dragActive, handleDragEnter, handleDragOver, handleDragLeave, handleDrop };
}

export async function collectDroppedFiles(data: DataTransfer): Promise<File[]> {
  const fallback = Array.from(data.files);
  const entries = Array.from(data.items ?? [])
    .map((item) => item.webkitGetAsEntry?.())
    .filter((entry): entry is FileSystemEntry => Boolean(entry));
  if (!entries.length) return fallback;
  const files: File[] = [];
  let visited = 0;
  async function walk(entry: FileSystemEntry, prefix = "", depth = 0): Promise<void> {
    if (++visited > 10000 || depth > 50)
      throw new Error("Folder is too large or too deeply nested. Import a smaller folder.");
    const name = prefix + entry.name;
    if (entry.isFile) {
      const file = await new Promise<File>((resolve, reject) =>
        (entry as FileSystemFileEntry).file(resolve, reject),
      );
      files.push(new File([file], name, { type: file.type, lastModified: file.lastModified }));
    } else if (entry.isDirectory) {
      const reader = (entry as FileSystemDirectoryEntry).createReader();
      while (true) {
        const children = await new Promise<FileSystemEntry[]>((resolve, reject) =>
          reader.readEntries(resolve, reject),
        );
        if (!children.length) break;
        for (const child of children) await walk(child, name + "/", depth + 1);
      }
    }
  }
  for (const entry of entries) await walk(entry);
  return files;
}
