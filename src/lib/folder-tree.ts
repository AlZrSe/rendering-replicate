/**
 * Utility functions for building folder trees from flat lists.
 * Shared between client and server components.
 */

export interface FolderNode {
  name: string;
  path: string;
  children: FolderNode[];
  isRoot?: boolean;
}

/**
 * Builds a tree structure from a flat list of folder paths.
 * Input should be sorted for consistent output.
 */
export function buildTree(folders: string[]): FolderNode[] {
  const root: FolderNode = { name: "", path: "", children: [], isRoot: true };
  const pathMap = new Map<string, FolderNode>();
  pathMap.set("", root);

  for (const folder of folders) {
    const parts = folder.split("/");
    let currentPath = "";
    for (const part of parts) {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      if (!pathMap.has(currentPath)) {
        const node: FolderNode = {
          name: part,
          path: currentPath,
          children: [],
        };
        pathMap.set(currentPath, node);
        // Get parent path by removing the last "/part" segment
        const lastSlashIndex = currentPath.lastIndexOf("/");
        const parentPath = lastSlashIndex >= 0 ? currentPath.slice(0, lastSlashIndex) : "";
        pathMap.get(parentPath)!.children.push(node);
      }
    }
  }
  return root.children;
}