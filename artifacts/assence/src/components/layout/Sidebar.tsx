import { Link, useLocation } from "wouter";
import { Compass, MoonStar, Plus, Sparkles, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const navigation = [
  { name: "Dashboard", href: "/", icon: Compass },
  { name: "Novo Mapa", href: "/novo", icon: Plus },
  { name: "Mapas", href: "/mapas", icon: MoonStar },
];

export function Sidebar() {
  const [location] = useLocation();

  return (
    <div className="flex h-full w-64 flex-col border-r bg-sidebar">
      <div className="flex h-16 shrink-0 items-center px-6">
        <Link href="/" className="flex items-center gap-2 transition-opacity hover:opacity-80">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-primary">
            <Sparkles className="h-5 w-5" />
          </div>
          <span className="font-sans text-xl font-medium tracking-wide text-foreground">
            Assence
          </span>
        </Link>
      </div>

      <div className="flex flex-1 flex-col gap-y-7 overflow-y-auto px-4 py-4">
        <nav className="flex flex-1 flex-col">
          <ul role="list" className="-mx-2 space-y-1">
            {navigation.map((item) => {
              const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
              return (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    className={cn(
                      isActive
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                      "group flex gap-x-3 rounded-md p-2 text-sm leading-6 transition-colors"
                    )}
                  >
                    <item.icon
                      className={cn(
                        isActive ? "text-sidebar-accent-foreground" : "text-muted-foreground group-hover:text-sidebar-foreground",
                        "h-5 w-5 shrink-0 transition-colors"
                      )}
                      aria-hidden="true"
                    />
                    {item.name}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
      
      <div className="p-4 mt-auto border-t border-border/50">
        <div className="text-xs text-muted-foreground text-center font-sans italic">
          "As estrelas inclinam, não obrigam."
        </div>
      </div>
    </div>
  );
}
