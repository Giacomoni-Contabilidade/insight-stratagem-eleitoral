import * as React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AppLayout from "@/components/AppLayout";

const queryClient = new QueryClient();

const App = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  (props, ref) => (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <div ref={ref} {...props}>
          <Toaster />
          <Sonner />
          <AppLayout />
        </div>
      </TooltipProvider>
    </QueryClientProvider>
  )
);

App.displayName = "App";

export default App;
