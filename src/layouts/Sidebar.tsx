import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { ChevronDown, Hotel } from "lucide-react";
import { NAV_ITEMS, type NavItem } from "@/config/navigation";
import { cn } from "@/lib/utils";
import { useSettings } from "@/hooks/useEntities";

function NavRow({
  item,
  onNavigate,
}: {
  item: NavItem;
  onNavigate?: () => void;
}) {
  const location = useLocation();
  const hasChildren = !!item.children?.length;
  const childActive =
    hasChildren &&
    item.children!.some((c) => location.pathname.startsWith(c.to));
  const [open, setOpen] = useState(childActive);
  const Icon = item.icon;

  if (hasChildren) {
    return (
      <div>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className={cn(
            "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
            "text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground",
            childActive && "text-sidebar-foreground",
          )}
        >
          <Icon className="h-[18px] w-[18px] shrink-0" />
          <span className="flex-1 text-left">{item.label}</span>
          <ChevronDown
            className={cn("h-4 w-4 transition-transform", open && "rotate-180")}
          />
        </button>
        {open && (
          <div className="mt-1 ml-4 space-y-0.5 border-l border-sidebar-accent pl-3">
            {item.children!.map((child) => (
              <NavLink
                key={child.to}
                to={child.to}
                onClick={onNavigate}
                className={({ isActive }) =>
                  cn(
                    "block rounded-md px-3 py-1.5 text-sm transition-colors",
                    "text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground",
                    isActive &&
                      "bg-sidebar-accent font-medium text-sidebar-foreground",
                  )
                }
              >
                {child.label}
              </NavLink>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <NavLink
      to={item.to}
      end={item.to === "/"}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
          "text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground",
          isActive &&
            "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
        )
      }
    >
      <Icon className="h-[18px] w-[18px] shrink-0" />
      <span>{item.label}</span>
    </NavLink>
  );
}

export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { data: settings } = useSettings();
  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <Hotel className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">HotelFlow</p>
          <p className="truncate text-xs text-sidebar-muted">
            {settings?.hotelName ?? "Hotel Management"}
          </p>
        </div>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-4">
        {NAV_ITEMS.map((item) => (
          <NavRow key={item.to} item={item} onNavigate={onNavigate} />
        ))}
      </nav>
    </div>
  );
}
