"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Shield,
  Users,
  ArrowLeft,
  FlaskConical,
  KeyRound,
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

interface AdminSidebarProps {
  user: {
    name: string;
    email: string;
  };
}

interface NavItem {
  title: string;
  url: string;
  icon: typeof Shield;
}

const navItems: NavItem[] = [
  { title: "Email Whitelist", url: "/admin", icon: Users },
  { title: "API Keys", url: "/admin/api-keys", icon: KeyRound },
  { title: "LLM Playground", url: "/admin/test-llm", icon: FlaskConical },
  { title: "Workflow Test", url: "/admin/test-workflow", icon: FlaskConical },
];

export function AdminSidebar({ user }: AdminSidebarProps) {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();
  const isMobile = useIsMobile();

  const handleLinkClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  const renderNavItem = (item: NavItem) => {
    const isActive =
      item.url === "/admin"
        ? pathname === "/admin"
        : pathname.startsWith(item.url);

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
              <Link href="/admin" onClick={handleLinkClick}>
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Shield className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">Admin</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Management</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map(renderNavItem)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <Link href="/dashboard" onClick={handleLinkClick}>
                <ArrowLeft className="size-4" />
                <span>Back to Dashboard</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <SidebarSeparator />
        <SidebarUserBadge user={user} />
      </SidebarFooter>
    </Sidebar>
  );
}
