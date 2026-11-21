import { describe, it, expect } from "vitest";
import { buildTree } from "./folder-tree";

describe("folder-tree buildTree", () => {
  it("builds tree from flat list", () => {
    const folders = ["data", "data/in", "data/out", "projects", "projects/my-project", "shared"];
    const tree = buildTree(folders);
    console.log("tree:", JSON.stringify(tree, null, 2));
    expect(tree.length).toBeGreaterThan(0);
  });

  it("handles single folder", () => {
    const tree = buildTree(["data"]);
    console.log("single:", JSON.stringify(tree, null, 2));
    expect(tree.length).toBe(1);
  });
});