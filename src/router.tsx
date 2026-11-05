import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  // No global defaultOptions/onError: error handling is per-route via
  // useErrorHandler (issue #49). A global onError would double-notify on the
  // routes that already handle errors in their render body. createQueryErrorHandler
  // was removed (dead code, de-dupe window shorter than the poll interval).
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
