import { useEffect, useRef, useState } from "react";
import { ExternalLink, RefreshCw, AlertCircle, Wifi, WifiOff } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getSyncthingStatus } from "@/services";
import { useSettings } from "@/lib/settings";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export function SyncthingDashboard() {
  const { settings } = useSettings();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [iframeError, setIframeError] = useState(false);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["syncthing", "status"],
    queryFn: getSyncthingStatus,
    refetchInterval: settings.pollIntervalMs,
    retry: 2,
  });

  const handleIframeLoad = () => {
    setIframeLoaded(true);
    setIframeError(false);
  };

  const handleIframeError = () => {
    setIframeLoaded(false);
    setIframeError(true);
  };

  const openInNewTab = (url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Syncthing Dashboard</CardTitle>
          <CardDescription>Loading Syncthing status...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="aspect-video bg-muted animate-pulse rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="size-5 text-destructive" />
            Syncthing Dashboard
          </CardTitle>
          <CardDescription>Failed to load Syncthing status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {error instanceof Error ? error.message : "Unknown error"}
            </p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="size-4 mr-2" /> Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return null;
  }

  const guiUrl = data.gui?.url;
  const guiReachable = data.gui?.reachable ?? false;

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2">
            Syncthing Dashboard
            <span
              className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${
                guiReachable ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"
              }`}
            >
              {guiReachable ? (
                <>
                  <Wifi className="size-3" />
                  Reachable
                </>
              ) : (
                <>
                  <WifiOff className="size-3" />
                  Local Only
                </>
              )}
            </span>
          </CardTitle>
          <CardDescription>
            Syncthing GUI running on {data.gui?.host}:{data.gui?.port}
          </CardDescription>
        </div>
        <div className="flex gap-2">
          {guiUrl && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => openInNewTab(guiUrl)}
              disabled={!guiReachable}
            >
              <ExternalLink className="size-4 mr-2" />
              Open in New Tab
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="relative aspect-video w-full">
          {guiUrl && (
            <iframe
              ref={iframeRef}
              src={guiUrl}
              title="Syncthing Dashboard"
              className="absolute inset-0 w-full h-full rounded-lg border-0"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
              onLoad={handleIframeLoad}
              onError={handleIframeError}
              style={{ display: iframeLoaded || iframeError ? "block" : "none" }}
            />
          )}
          {!guiUrl && (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <p>Syncthing GUI URL not available</p>
            </div>
          )}
          {(iframeError || (!iframeLoaded && guiUrl)) && (
            <div className="absolute inset-0 flex items-center justify-center bg-muted/50 rounded-lg p-4">
              <div className="text-center space-y-3">
                <AlertCircle className="mx-auto size-12 text-destructive" />
                <h3 className="text-lg font-semibold">
                  {iframeError ? "Failed to Load Dashboard" : "Loading Dashboard..."}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {iframeError
                    ? "The Syncthing GUI could not be loaded in this iframe. This may be due to browser security policies or the Syncthing instance not being reachable."
                    : "The Syncthing dashboard is loading..."}
                </p>
                {guiUrl && (
                  <Button variant="default" size="sm" onClick={() => openInNewTab(guiUrl)}>
                    <ExternalLink className="size-4 mr-2" />
                    Open in New Tab
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
        <div className="mt-3 grid grid-cols-3 gap-4 text-sm text-muted-foreground">
          <div>
            <span className="font-medium">Jobs Folder: </span>
            {data.jobs_folder.exists ? (
              <>
                <span className="text-green-600">●</span> {data.jobs_folder.state_files} state files
              </>
            ) : (
              <span className="text-red-600">Not found</span>
            )}
          </div>
          <div>
            <span className="font-medium">Nodes Folder: </span>
            {data.nodes_folder.exists ? (
              <>
                <span className="text-green-600">●</span> {data.nodes_folder.state_files} state
                files
              </>
            ) : (
              <span className="text-red-600">Not found</span>
            )}
          </div>
          <div>
            <span className="font-medium">Processed: </span>
            {data.processed_files_count} files
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
