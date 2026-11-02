import {
  Briefcase,
  FileCheck,
  Inbox,
  User,
  Settings,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  description: string;
}

export const NAV_ITEMS: NavItem[] = [
  {
    title: "Jobs",
    href: "/app/jobs",
    icon: Briefcase,
    description: "Discovered job listings matching your profile will appear here.",
  },
  {
    title: "Applications",
    href: "/app/applications",
    icon: FileCheck,
    description: "Active and completed job applications will appear here.",
  },
  {
    title: "Inbox",
    href: "/app/inbox",
    icon: Inbox,
    description: "Recruiter responses and application updates will appear here.",
  },
  {
    title: "Profile",
    href: "/app/profile",
    icon: User,
    description:
      "Your uploaded resume, parsed skills, and tailoring preferences will appear here.",
  },
  {
    title: "Settings",
    href: "/app/settings",
    icon: Settings,
    description:
      "Account settings, connected providers, and notification preferences will appear here.",
  },
];
