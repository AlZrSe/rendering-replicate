"use client";

import * as React from "react";
import { useEffect, useState, useCallback, useRef } from "react";
import { Folder, FolderOpen, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";

import { getSyncthingFolders, type SyncthingFolderList } from "@/services";
import { buildTree, type FolderNode } from "@/lib/folder-tree";

interface FolderPickerProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  id?: string;
  disabled?: boolean;
}

function FolderTree({
  nodes,
  selectedPath,
  onSelect,
  level = 0,
}: {
  nodes: FolderNode[];
  selectedPath: string;
  onSelect: (path: string) => void;
  level?: number;
}) {
  return (
    <div className="space-y-1" role="tree">
      {nodes.map((node) => (
        <FolderTreeNode
          key={node.path}
          node={node}
          selectedPath={selectedPath}
          onSelect={onSelect}
          level={level}
        />
      ))}
    </div>
  );
}

interface FolderTreeNodeProps {
  node: FolderNode;
  selectedPath: string;
  onSelect: (path: string) => void;
  level: number;
}

function FolderTreeNode({
  node,
  selectedPath,
  onSelect,
  level,
}: FolderTreeNodeProps) {
  const isSelected = node.path === selectedPath;
  const hasChildren = node.children.length > 0;
  const isExpanded = hasChildren; // Could be controlled per-node if needed
  const indent = level * 1.5; // rem

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case "Enter":
      case " ":
        e.preventDefault();
        onSelect(node.path);
        break;
      case "ArrowRight":
        // Could expand if we had per-node state
        break;
      case "ArrowLeft":
        // Could collapse if we had per-node state
        break;
    }
  };

  return (
    <div style={{ paddingLeft: `${indent}rem` }}>
      {hasChildren ? (
        <Collapsible open={isExpanded}>
          <CollapsibleTrigger
            asChild
            onKeyDown={handleKeyDown}
            className={cn(
              "flex items-center gap-2 w-full px-2 py-1.5 rounded text-sm transition-colors",
              "hover:bg-accent hover:text-accent-foreground",
              "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
              isSelected && "bg-primary/10 text-primary"
            )}
            role="treeitem"
            aria-selected={isSelected}
            aria-expanded={isExpanded}
          >
            {isExpanded ? (
              <FolderOpen className="h-4 w-4 text-muted-foreground" />
            ) : (
              <Folder className="h-4 w-4 text-muted-foreground" />
            )}
            <span className="flex-1 truncate">{node.name}</span>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <FolderTree
              nodes={node.children}
              selectedPath={selectedPath}
              onSelect={onSelect}
              level={level + 1}
            />
          </CollapsibleContent>
        </Collapsible>
      ) : (
        <button
          type="button"
          onClick={() => onSelect(node.path)}
          onKeyDown={handleKeyDown}
          className={cn(
            "flex items-center gap-2 w-full px-2 py-1.5 rounded text-sm transition-colors",
            "hover:bg-accent hover:text-accent-foreground",
            "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
            isSelected && "bg-primary/10 text-primary"
          )}
          role="treeitem"
          aria-selected={isSelected}
        >
          <Folder className="h-4 w-4 text-muted-foreground" />
          <span className="flex-1 truncate">{node.name}</span>
        </button>
      )}
    </div>
  );
}

export function FolderPicker({
  value,
  onChange,
  placeholder = "Select folder...",
  id,
  disabled = false,
}: FolderPickerProps) {
  const [folders, setFolders] = useState<string[]>([]);
  const [tree, setTree] = useState<FolderNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const triggerRef = useRef<HTMLButtonElement>(null);

  // Fetch folders on mount
  useEffect(() => {
    let mounted = true;

    async function loadFolders() {
      try {
        setLoading(true);
        setError(null);
        const data: SyncthingFolderList = await getSyncthingFolders();
        if (mounted) {
          setFolders(data.folders);
          setTree(buildTree(data.folders));
        }
      } catch (err: unknown) {
        if (mounted) {
          setError(err instanceof Error ? err.message : "Failed to load folders");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadFolders();
    return () => {
      mounted = false;
    };
  }, []);

  // Check mobile viewport
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const handleSelect = useCallback((path: string) => {
    onChange(path);
    setOpen(false);
  }, [onChange]);

  const handleClear = useCallback(() => {
    onChange("");
    setOpen(false);
  }, [onChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    },
    []
  );

  if (disabled) {
    return (
      <button
        type="button"
        disabled
        className={cn(
          "flex items-center justify-between w-full px-3 py-2 text-sm bg-muted",
          "border border-input rounded-md text-muted-foreground",
          "cursor-not-allowed"
        )}
        aria-disabled={true}
      >
        <span className="truncate">{value || placeholder}</span>
        <Folder className="h-4 w-4 opacity-50" />
      </button>
    );
  }

  const triggerContent = (
    <div className="flex items-center justify-between w-full">
      <span className="truncate">
        {value ? (
          <>
            <Folder className="inline h-4 w-4 mr-1 text-muted-foreground" />
            {value}
          </>
        ) : (
          <span className="text-muted-foreground">{placeholder}</span>
        )}
      </span>
      <Folder className="h-4 w-4 opacity-50" />
    </div>
  );

  const popoverContent = (
    <div
      className="w-96 max-h-[400px]"
      onKeyDown={handleKeyDown}
    >
      {loading ? (
        <div className="p-4 space-y-3">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      ) : error ? (
        <div className="p-4 text-center text-sm text-destructive">
          {error}
          <Button
            variant="ghost"
            size="sm"
            className="mt-2"
            onClick={() => {
              setLoading(true);
              setError(null);
              getSyncthingFolders().then((data: SyncthingFolderList) => {
                setFolders(data.folders);
                setTree(buildTree(data.folders));
                setLoading(false);
              }).catch((err: unknown) => {
                setError(err instanceof Error ? err.message : "Failed to load folders");
                setLoading(false);
              });
            }}
          >
            Retry
          </Button>
        </div>
      ) : tree.length === 0 ? (
        <div className="p-4 text-center text-sm text-muted-foreground">
          No folders found
        </div>
      ) : (
        <>
          <ScrollArea className="h-[320px] pr-2">
            <FolderTree
              nodes={tree}
              selectedPath={value}
              onSelect={handleSelect}
            />
          </ScrollArea>
          <Separator className="my-2" />
          <div className="flex justify-end p-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClear}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4 mr-1" />
              Clear selection
            </Button>
          </div>
        </>
      )}
    </div>
  );

  const sheetContent = (
    <div className="flex flex-col h-full" onKeyDown={handleKeyDown}>
      <SheetHeader>
        <SheetTitle>Select Folder</SheetTitle>
        <SheetDescription>
          Choose a folder from the Syncthing directory
        </SheetDescription>
      </SheetHeader>
      <Separator />
      <div className="flex-1 overflow-hidden">
        {loading ? (
          <div className="p-4 space-y-3">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : error ? (
          <div className="p-4 text-center text-sm text-destructive">
            {error}
            <Button
              variant="ghost"
              size="sm"
              className="mt-2"
              onClick={() => {
                setLoading(true);
                setError(null);
                getSyncthingFolders().then((data: SyncthingFolderList) => {
                  setFolders(data.folders);
                  setTree(buildTree(data.folders));
                  setLoading(false);
                }).catch((err: unknown) => {
                  setError(err instanceof Error ? err.message : "Failed to load folders");
                  setLoading(false);
                });
              }}
            >
              Retry
            </Button>
          </div>
        ) : tree.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            No folders found
          </div>
        ) : (
          <ScrollArea className="h-full">
            <FolderTree
              nodes={tree}
              selectedPath={value}
              onSelect={handleSelect}
            />
          </ScrollArea>
        )}
      </div>
      <Separator />
      <SheetFooter className="p-4">
        <div className="w-full flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClear}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4 mr-1" />
            Clear selection
          </Button>
        </div>
      </SheetFooter>
    </div>
  );

  return isMobile ? (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          ref={triggerRef}
          variant="outline"
          className="w-full justify-between"
          disabled={loading}
        >
          {triggerContent}
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom">{sheetContent}</SheetContent>
    </Sheet>
  ) : (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          ref={triggerRef}
          variant="outline"
          className="w-full justify-between"
          disabled={loading}
        >
          {triggerContent}
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={8}>
        {popoverContent}
      </PopoverContent>
    </Popover>
  );
}