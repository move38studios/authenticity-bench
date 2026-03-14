"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FlaskConical,
  Scale,
  BookOpen,
  Brain,
  Shuffle,
  Cpu,
  Shield,
  Beaker,
  MessageSquareText,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";
import { SidebarUserBadge } from "@/components/sidebar-user-badge";
import { useIsMobile } from "@/hooks/use-mobile";

interface DashboardSidebarProps {
  user: {
    name: string;
    email: string;
    role?: string | null;
  };
}

interface NavItem {
  title: string;
  url: string;
  icon: typeof FlaskConical;
}

const libraryItems: NavItem[] = [
  { title: "Dilemmas", url: "/dashboard/library/dilemmas", icon: Scale },
  { title: "Values Systems", url: "/dashboard/library/values", icon: BookOpen },
  { title: "Techniques", url: "/dashboard/library/techniques", icon: Brain },
  { title: "Modifiers", url: "/dashboard/library/modifiers", icon: Shuffle },
  { title: "Models", url: "/dashboard/library/models", icon: Cpu },
];

export function DashboardSidebar({ user }: DashboardSidebarProps) {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();
  const isMobile = useIsMobile();

  const handleLinkClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  const renderNavItem = (item: NavItem) => {
    const isActive = pathname.startsWith(item.url);

    return (
      <SidebarMenuItem key={item.title}>
        <SidebarMenuButton asChild isActive={isActive}>
          <Link href={item.url} onClick={handleLinkClick}>
            <item.icon className="size-4" />
            <span>{item.title}</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  return (
    <Sidebar variant="inset">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/dashboard" onClick={handleLinkClick}>
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <FlaskConical className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">
                    Authenticity Bench
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Experiments</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {renderNavItem({
                title: "Experiments",
                url: "/dashboard/experiments",
                icon: Beaker,
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {renderNavItem({
                title: "Analysis",
                url: "/dashboard/analysis",
                icon: MessageSquareText,
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Content Library</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {libraryItems.map(renderNavItem)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        {user.role === "admin" && (
          <>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link href="/admin" onClick={handleLinkClick}>
                    <Shield className="size-4" />
                    <span>Admin</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
            <SidebarSeparator />
          </>
        )}
        <SidebarUserBadge user={user} />
      </SidebarFooter>
    </Sidebar>
  );
}
