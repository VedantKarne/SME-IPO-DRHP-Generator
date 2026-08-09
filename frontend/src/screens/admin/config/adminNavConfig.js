/**
 * adminNavConfig.js
 * 
 * Centralized navigation items configuration for the System Admin Console.
 * Defines the navigation tabs (Overview, Users, Roles & Permissions, Projects,
 * Audit Logs, System Monitoring, Regulatory Rules) and their icons/routes.
 * 
 * Kept separate from UI components per system modularity rules.
 */
import {
  LayoutDashboard,
  Users,
  ShieldCheck,
  FolderKanban,
  FileSpreadsheet,
  Activity,
  BookOpen
} from 'lucide-react';

export const ADMIN_NAV_ITEMS = [
  {
    id: 'overview',
    label: 'Overview',
    path: '/admin/overview',
    icon: LayoutDashboard,
  },
  {
    id: 'users',
    label: 'Users',
    path: '/admin/users',
    icon: Users,
  },
  {
    id: 'roles',
    label: 'Roles & Permissions',
    path: '/admin/roles',
    icon: ShieldCheck,
  },
  {
    id: 'projects',
    label: 'Projects',
    path: '/admin/projects',
    icon: FolderKanban,
  },
  {
    id: 'audit-logs',
    label: 'Audit Logs',
    path: '/admin/audit-logs',
    icon: FileSpreadsheet,
  },
  {
    id: 'monitoring',
    label: 'System Monitoring',
    path: '/admin/monitoring',
    icon: Activity,
  },
  {
    id: 'rules',
    label: 'Regulatory Rules',
    path: '/admin/rules',
    icon: BookOpen,
  },
];
