export type DriveItemType = "file" | "folder" | "unknown";

export type DriveItem = {
  name: string;
  path: string;
  type: DriveItemType;
  size: number;
  modifiedAt: string | null;
  rights?: string;
};

export type RecentDriveItem = DriveItem & {
  lastAccessedAt: string | null;
  recentAt: string | null;
};

export type DirectoryListing = {
  path: string;
  parent: string;
  items: DriveItem[];
  generatedAt: string;
};
