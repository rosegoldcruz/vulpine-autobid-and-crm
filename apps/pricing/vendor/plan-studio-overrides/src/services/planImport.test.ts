// @vitest-environment node
import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { zipSync, strToU8 } from "fflate";
import { importPlanFiles, safePlanPath } from "./planImport";
import { validatePdfFile, MAX_PDF_SIZE_BYTES } from "./pdfValidation";
import { createEmptySession } from "../app/sessionState";
import { collectDroppedFiles } from "../app/useFileDropZone";
import {
  saveImportedProject,
  replaceSavedSession,
  loadSavedSession,
  listSavedProjects,
  resetPersistenceForTests,
} from "./persistence";

afterEach(resetPersistenceForTests);
const progress = () => {};
const zip = (entries: Record<string, Uint8Array>) =>
  new File([zipSync(entries).slice().buffer], "plans.zip");

describe("plan imports", () => {
  it("keeps relative paths from folder picker selections", async () => {
    const file = new File(["pdf"], "plan.pdf");
    Object.defineProperty(file, "webkitRelativePath", { value: "Site/Level 1/plan.pdf" });
    const names: string[] = [];
    const result = await importPlanFiles([file], progress, async (pdf) => {
      names.push(pdf.name);
    });
    expect(result.imported).toBe(1);
    expect(names).toEqual(["Site/Level 1/plan.pdf"]);
  });
  it("walks all directory reader batches and nested folders", async () => {
    const entry = (name: string) => ({
      name,
      isFile: true,
      file: (done: (f: File) => void) => done(new File(["pdf"], name)),
    });
    let batch = 0;
    const directory = {
      name: "Site",
      isDirectory: true,
      createReader: () => ({
        readEntries: (done: (entries: unknown[]) => void) =>
          done(batch++ === 0 ? [entry("a.pdf")] : batch === 2 ? [entry("b.pdf")] : []),
      }),
    };
    const files = await collectDroppedFiles({
      files: [],
      items: [{ webkitGetAsEntry: () => directory }],
    } as unknown as DataTransfer);
    expect(files.map((f) => f.name)).toEqual(["Site/a.pdf", "Site/b.pdf"]);
  });
  it("accepts PDFs above the old 100 MB ceiling through 1 GB", () => {
    expect(() =>
      validatePdfFile({
        name: "large.pdf",
        type: "application/pdf",
        size: 150 * 1024 ** 2,
      } as File),
    ).not.toThrow();
    expect(() =>
      validatePdfFile({ name: "large.pdf", size: MAX_PDF_SIZE_BYTES } as File),
    ).not.toThrow();
    expect(() =>
      validatePdfFile({ name: "large.pdf", size: MAX_PDF_SIZE_BYTES + 1 } as File),
    ).toThrow("1 GB");
  });
  it("imports nested ZIP PDFs sequentially with distinct paths and skips other files", async () => {
    const names: string[] = [];
    const result = await importPlanFiles(
      [
        zip({
          "A/plan.pdf": strToU8("a"),
          "B/plan.pdf": strToU8("b"),
          "readme.txt": strToU8("text"),
        }),
      ],
      progress,
      async (file) => {
        names.push(file.name);
      },
    );
    expect(names).toEqual(["A/plan.pdf", "B/plan.pdf"]);
    expect(result).toEqual({ imported: 2, skipped: 1, errors: [] });
  });
  it("keeps successful files when one PDF fails", async () => {
    const result = await importPlanFiles(
      [new File(["bad"], "bad.pdf"), new File(["ok"], "ok.pdf")],
      progress,
      async (file) => {
        if (file.name === "bad.pdf") throw new Error("Invalid PDF");
      },
    );
    expect(result.imported).toBe(1);
    expect(result.errors[0]).toContain("Invalid PDF");
  });
  it("rejects unsafe paths and broken archives", async () => {
    expect(() => safePlanPath("../bad.pdf")).toThrow("Unsafe");
    expect(() => safePlanPath("C:\\bad.pdf")).toThrow("Unsafe");
    const result = await importPlanFiles(
      [new File(["not a zip"], "broken.zip")],
      progress,
      async () => {},
    );
    expect(result.imported).toBe(0);
    expect(result.errors.length).toBe(1);
  });
  it("bounds archive PDF count", async () => {
    const entries = Object.fromEntries(
      Array.from({ length: 501 }, (_, i) => [`${i}.pdf`, strToU8("x")]),
    );
    const result = await importPlanFiles([zip(entries)], progress, async () => {});
    expect(result.errors.join()).toContain("500 PDFs");
  });
  it("adds library projects without replacing the active session", async () => {
    const active = createEmptySession({ name: "working.pdf", size: 3, lastModified: 1 }, 1);
    await replaceSavedSession(active, new Blob(["pdf"]), null, "working");
    const imported = createEmptySession({ name: "folder/new.pdf", size: 3, lastModified: 1 }, 2);
    await saveImportedProject(imported, new Blob(["new"]));
    const saved = await loadSavedSession();
    expect(JSON.stringify(saved)).toContain("working.pdf");
    expect((await listSavedProjects()).map((p) => p.name).sort()).toEqual([
      "folder/new.pdf",
      "working.pdf",
    ]);
  });
});
