// Role options presented on the landing page's "Continue as" section
// (LoginSection.jsx). Each entry describes one selectable role card:
// its icon, copy, and how a click should be handled.
//
// action: 'navigate' -> role has a real downstream flow, route to `to`.
// action: 'toast'    -> role has no backend/dashboard flow yet, so we
//                       surface `toastMessage` instead of faking a redirect
//                       (see the Merchant Banker entry, which established
//                       this pattern first).
import { Building2, Briefcase, Calculator, Shield } from 'lucide-react';

export const ROLE_OPTIONS = [
  {
    id: 'founder',
    icon: Building2,
    title: 'Founder / Promoter',
    description: "Start your company's IPO workspace and prepare your DRHP draft.",
    action: 'navigate',
    to: '/auth',
  },
  {
    id: 'merchant_banker',
    icon: Briefcase,
    title: 'Merchant Banker',
    description: "Review and sign off on a company's disclosure draft.",
    action: 'navigate',
    to: '/auth',
  },
  {
    id: 'finance_ca',
    icon: Calculator,
    title: 'Finance / CA',
    description: 'Verify financial disclosures and certify statutory figures.',
    action: 'navigate',
    to: '/auth',
  },
  {
    id: 'admin',
    icon: Shield,
    title: 'System Admin',
    description: 'Manage system users, project permissions, regulatory rules, and audit logs.',
    action: 'navigate',
    to: '/auth',
  },
];
