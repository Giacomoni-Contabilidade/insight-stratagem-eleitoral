import * as React from "react";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DataProvider } from "@/contexts/DataContext";
import AppRoutes from "@/components/AppRoutes";

const queryClient = new QueryClient();

const App = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  function AppComponent(props, ref) {
    return (
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <BrowserRouter>
            <DataProvider>
              <div ref={ref} {...props}>
                <Toaster />
                <Sonner />
                <AppRoutes />
              </div>
            </DataProvider>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    );
  }
);

App.displayName = "App";

export default App;
