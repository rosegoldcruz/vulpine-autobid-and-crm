import { MAX_PDF_SIZE_BYTES, validatePdfFile } from "./pdfValidation";

export const MAX_IMPORT_BYTES = 2 * 1024 ** 3;
export const MAX_IMPORT_FILES = 500;
export interface ImportResult {
  imported: number;
  skipped: number;
  errors: string[];
}

export function safePlanPath(name: string): string {
  const path = name.replaceAll("\\", "/");
  if (path.startsWith("/") || /^[a-z]:/i.test(path) || path.split("/").includes("..")) {
    throw new Error(`Unsafe archive path: ${name}`);
  }
  return path;
}

// Stream compressed input and save completed PDFs before reading more ZIP data.
// This avoids keeping an entire expanded archive in memory.
export async function importPlanFiles(
  files: File[],
  onProgress: (message: string) => void,
  save: (file: File) => Promise<void> = savePdf,
): Promise<ImportResult> {
  const result: ImportResult = { imported: 0, skipped: 0, errors: [] };
  let expanded = 0;
  let count = 0;
  const account = (size: number) => {
    expanded += size;
    if (expanded > MAX_IMPORT_BYTES)
      throw new Error("Import exceeds 2 GB expanded. Split it into smaller batches.");
  };
  const reserve = () => {
    if (++count > MAX_IMPORT_FILES)
      throw new Error("Import exceeds 500 PDFs. Split it into smaller batches.");
  };
  const persist = async (file: File) => {
    onProgress(`Saving ${result.imported + 1}: ${file.name}`);
    try {
      validatePdfFile(file);
      await save(file);
      result.imported++;
    } catch (error) {
      result.errors.push(
        `${file.name}: ${error instanceof Error ? error.message : "Could not save PDF. Check browser storage."}`,
      );
    }
  };
  for (const input of files) {
    try {
      const name = safePlanPath(input.webkitRelativePath || input.name);
      if (/\.pdf$/i.test(name) || input.type === "application/pdf") {
        reserve();
        validatePdfFile(input);
        account(input.size);
        await persist(
          new File([input], name, { type: "application/pdf", lastModified: input.lastModified }),
        );
      } else if (/\.zip$/i.test(name)) {
        if (input.size > MAX_PDF_SIZE_BYTES) throw new Error("ZIP exceeds the 1 GB limit.");
        const { Unzip, UnzipInflate } = await import("fflate");
        const ready: File[] = [];
        let failure: Error | null = null;
        let pending = 0;
        let entries = 0;
        const unzip = new Unzip((entry) => {
          if (++entries > 10000) throw new Error("ZIP contains too many entries.");
          const path = safePlanPath(entry.name);
          if (!/\.pdf$/i.test(path)) {
            result.skipped++;
            return;
          }
          reserve();
          if ((entry.originalSize ?? 0) > MAX_PDF_SIZE_BYTES)
            throw new Error(`${path}: PDF exceeds 1 GB.`);
          pending++;
          let size = 0;
          const parts: BlobPart[] = [];
          entry.ondata = (error, data, final) => {
            if (failure) return;
            if (error) {
              failure = error;
              return;
            }
            try {
              size += data.length;
              account(data.length);
              if (size > MAX_PDF_SIZE_BYTES) throw new Error(`${path}: PDF exceeds 1 GB.`);
              parts.push(data.slice().buffer);
              if (final) {
                ready.push(new File(parts, path, { type: "application/pdf" }));
                pending--;
              }
            } catch (error) {
              failure = error as Error;
              entry.terminate();
            }
          };
          entry.start();
        });
        unzip.register(UnzipInflate);
        onProgress(`Reading ${name}…`);
        for (let offset = 0; offset < input.size; offset += 65536) {
          const end = Math.min(input.size, offset + 65536);
          unzip.push(
            new Uint8Array(await input.slice(offset, end).arrayBuffer()),
            end === input.size,
          );
          if (failure) throw failure;
          while (ready.length) await persist(ready.shift()!);
          await new Promise<void>((resolve) => setTimeout(resolve, 0));
        }
        if (pending || entries === 0) throw new Error("ZIP is empty, incomplete or invalid.");
      } else {
        result.skipped++;
      }
    } catch (error) {
      result.errors.push(
        `${input.name}: ${error instanceof Error ? error.message : "Import failed."}`,
      );
      if (expanded > MAX_IMPORT_BYTES || count > MAX_IMPORT_FILES) break;
    }
  }
  return result;
}

async function savePdf(file: File): Promise<void> {
  const [{ loadPdf }, { createEmptySession }, { saveImportedProject }] = await Promise.all([
    import("./pdf"),
    import("../app/sessionState"),
    import("./persistence"),
  ]);
  const loaded = await loadPdf(file);
  try {
    const session = createEmptySession(
      { name: file.name, size: file.size, lastModified: file.lastModified },
      loaded.document.numPages,
    );
    await saveImportedProject(session, file);
  } finally {
    await loaded.loadingTask.destroy();
  }
}
