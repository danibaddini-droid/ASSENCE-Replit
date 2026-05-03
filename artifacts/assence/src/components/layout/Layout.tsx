import { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { Sparkles } from "lucide-react";

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      <div className="hidden md:flex">
        <Sidebar />
      </div>
      
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Mobile Header */}
        <div className="md:hidden flex items-center justify-between p-4 border-b bg-sidebar">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-primary">
              <Sparkles className="h-5 w-5" />
            </div>
            <span className="font-serif text-xl font-medium tracking-wide text-foreground">
              Assence
            </span>
          </div>
        </div>

        <main className="flex-1 overflow-y-auto relative z-10">
          <div className="absolute inset-0 stars-bg -z-10 opacity-30 pointer-events-none" />
          <div className="absolute inset-0 constellation-lines -z-10 opacity-20 pointer-events-none" />
          
          <div className="p-6 md:p-8 lg:p-10 max-w-7xl mx-auto h-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
