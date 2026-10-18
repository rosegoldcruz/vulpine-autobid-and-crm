export function normalizeRemotePath(input: string | null | undefined) {
  if (!input || input === "/") return "/";
  const decoded = input.replaceAll("\\", "/");
  const parts = decoded.split("/").filter(Boolean);
  const safeParts = parts.filter((part) => part !== "." && part !== "..");
  return `/${safeParts.join("/")}`;
}

export function parentPath(path: string) {
  const normalized = normalizeRemotePath(path);
  if (normalized === "/") return "/";
  const parts = normalized.split("/").filter(Boolean);
  parts.pop();
  return parts.length ? `/${parts.join("/")}` : "/";
}

export function joinRemotePath(base: string, name: string) {
  const normalized = normalizeRemotePath(base);
  const cleanName = name.replaceAll("/", "");
  return normalized === "/" ? `/${cleanName}` : `${normalized}/${cleanName}`;
}

export function breadcrumbs(path: string) {
  const normalized = normalizeRemotePath(path);
  const parts = normalized.split("/").filter(Boolean);
  const crumbs = [{ label: "Root", path: "/" }];
  let current = "";
  for (const part of parts) {
    current += `/${part}`;
    crumbs.push({ label: part, path: current });
  }
  return crumbs;
}
