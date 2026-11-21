"use client";

import * as React from "react";
import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { Folder, FolderOpen, X, Loader2, ChevronDown } from "lucide-react";
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
import { Input } from "@/components/ui/input";
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
  "aria-label"?: string;
}

function flattenTree(nodes: FolderNode[], result: FolderNode[] = []): FolderNode[] {
  for (const node of nodes) {
    result.push(node);
    if (node.children.length > 0) {
      flattenTree(node.children, result);
    }
  }
  return result;
}

function FolderTree({
  nodes,
  selectedPath,
  onSelect,
  focusedPath,
  onFocus,
  level = 0,
}: {
  nodes: FolderNode[];
  selectedPath: string;
  onSelect: (path: string) => void;
  focusedPath: string | null;
  onFocus: (path: string | null) => void;
  level?: number;
}) {
  return (
    <div className="space-y-1" role="tree">
      {nodes.map((node) => (
        <FolderTreeNode
          key={node.path}
          node={node}
          selectedPath={selectedPath}
          focusedPath={focusedPath}
          onSelect={onSelect}
          onFocus={onFocus}
          level={level}
        />
      ))}
    </div>
  );
}

interface FolderTreeNodeProps {
  node: FolderNode;
  selectedPath: string;
  focusedPath: string | null;
  onSelect: (path: string) => void;
  onFocus: (path: string | null) => void;
  level: number;
}

function FolderTreeNode({
  node,
  selectedPath,
  focusedPath,
  onSelect,
  onFocus,
  level,
}: FolderTreeNodeProps) {
  const isSelected = node.path === selectedPath;
  const isFocused = node.path === focusedPath;
  const hasChildren = node.children.length > 0;
  const isExpanded = hasChildren; // Could be controlled per-node if needed
  const indent = level * 1.5; // rem

  return (
    <div style={{ paddingLeft: `${indent}rem` }}>
      {hasChildren ? (
        <Collapsible open={isExpanded}>
          <CollapsibleTrigger
            asChild
            className={cn(
              "flex items-center gap-2 w-full px-2 py-1.5 rounded text-sm transition-colors",
              "hover:bg-accent hover:text-accent-foreground",
              "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
              isSelected && "bg-primary/10 text-primary",
              isFocused && "bg-accent text-accent-foreground"
            )}
            role="treeitem"
            aria-selected={isSelected}
            aria-expanded={isExpanded}
            onFocus={() => onFocus(node.path)}
            onBlur={() => onFocus(null)}
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
              focusedPath={focusedPath}
              onSelect={onSelect}
              onFocus={onFocus}
              level={level + 1}
            />
          </CollapsibleContent>
        </Collapsible>
      ) : (
        <button
          type="button"
          onClick={() => {
            onSelect(node.path);
            onFocus(null);
          }}
          className={cn(
            "flex items-center gap-2 w-full px-2 py-1.5 rounded text-sm transition-colors",
            "hover:bg-accent hover:text-accent-foreground",
            "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
            isSelected && "bg-primary/10 text-primary",
            isFocused && "bg-accent text-accent-foreground"
          )}
          role="treeitem"
          aria-selected={isSelected}
          onFocus={() => onFocus(node.path)}
          onBlur={() => onFocus(null)}
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
  "aria-label": ariaLabel = "Select folder",
}: FolderPickerProps) {
  const [folders, setFolders] = useState<string[]>([]);
  const [tree, setTree] = useState<FolderNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [focusedPath, setFocusedPath] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState(value);

  const inputRef = useRef<HTMLInputElement>(null);
  const popoverContentRef = useRef<HTMLDivElement>(null);
  const flatNodes = useMemo(() => flattenTree(tree), [tree]);

  // Sync inputValue with value prop
  useEffect(() => {
    setInputValue(value);
  }, [value]);

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
    setInputValue(path);
    onChange(path);
    setFocusedPath(null);
    setOpen(false);
  }, [onChange]);

  const handleClear = useCallback(() => {
    setInputValue("");
    onChange("");
    setFocusedPath(null);
    setOpen(false);
  }, [onChange]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    onChange(e.target.value);
  }, [onChange]);

  const handleInputFocus = useCallback(() => {
    if (!loading && !error && tree.length > 0) {
      setOpen(true);
    }
  }, [loading, error, tree.length]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setFocusedPath(null);
        inputRef.current?.focus();
      } else if (e.key === "ArrowDown" && !open) {
        e.preventDefault();
        if (flatNodes.length > 0) {
          const firstNode = flatNodes[0];
          if (firstNode) {
            setFocusedPath(firstNode.path);
            setOpen(true);
          }
        }
      } else if (e.key === "ArrowUp" && !open) {
        e.preventDefault();
        if (flatNodes.length > 0) {
          const lastNode = flatNodes[flatNodes.length - 1];
          if (lastNode) {
            setFocusedPath(lastNode.path);
            setOpen(true);
          }
        }
      } else if (open && flatNodes.length > 0) {
        const currentIndex = focusedPath ? flatNodes.findIndex((n) => n.path === focusedPath) : -1;
        if (e.key === "ArrowDown") {
          e.preventDefault();
          if (currentIndex >= 0 && currentIndex < flatNodes.length - 1) {
            const nextNode = flatNodes[currentIndex + 1];
            if (nextNode) {
              setFocusedPath(nextNode.path);
            }
          }
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          if (currentIndex > 0) {
            const prevNode = flatNodes[currentIndex - 1];
            if (prevNode) {
              setFocusedPath(prevNode.path);
            }
          }
        } else if (e.key === "Enter" || e.key === " ") {
          if (focusedPath) {
            e.preventDefault();
            handleSelect(focusedPath);
          }
        }
      }
    }, [open, flatNodes, focusedPath, handleSelect]);

  const handleTriggerKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        handleKeyDown(e);
      }
    },
    [handleKeyDown]
  );

  if (disabled) {
    return (
      <Input
        id={id}
        value={value}
        placeholder={placeholder}
        disabled
        className="cursor-not-allowed"
        aria-disabled={true}
        aria-label={ariaLabel}
      />
    );
  }

  const popoverContent = (
    <div
      ref={popoverContentRef}
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
              selectedPath={inputValue}
              focusedPath={focusedPath}
              onSelect={handleSelect}
              onFocus={setFocusedPath}
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
              selectedPath={inputValue}
              focusedPath={focusedPath}
              onSelect={handleSelect}
              onFocus={setFocusedPath}
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

  const trigger = (
    <div className="relative w-full" onKeyDown={handleTriggerKeyDown}>
      <Input
        ref={inputRef}
        id={id}
        value={inputValue}
        onChange={handleInputChange}
        onFocus={handleInputFocus}
        placeholder={placeholder}
        disabled={loading}
        className="pr-10"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-controls={open ? "folder-picker-content" : undefined}
        aria-autocomplete="list"
      />
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7"
        onClick={() => setOpen(!open)}
        disabled={loading}
        aria-label={open ? "Close folder picker" : "Open folder picker"}
      >
        <ChevronDown className={cn("h-4 w-4", open && "rotate-180")} />
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      </Button>
    </div>
  );

  return isMobile ? (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {trigger}
      </SheetTrigger>
      <SheetContent side="bottom">{sheetContent}</SheetContent>
    </Sheet>
  ) : (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {trigger}
      </PopoverTrigger>
      <PopoverContent
        id="folder-picker-content"
        align="start"
        sideOffset={8}
        className="w-96 max-h-[400px]"
      >
        {popoverContent}
      </PopoverContent>
    </Popover>
  );
}