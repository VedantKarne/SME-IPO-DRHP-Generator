import { Lock, ShieldCheck, History } from 'lucide-react';

const POINTS = [
  {
    icon: Lock,
    title: 'Workspace isolation',
    desc: 'Each company’s documents, drafts and evidence live in a workspace scoped to that company only.',
  },
  {
    icon: ShieldCheck,
    title: 'Authenticated access',
    desc: 'Every session is authenticated; no drafting or document action happens without a signed-in user.',
  },
  {
    icon: History,
    title: 'Full audit trail',
    desc: 'Section edits, approvals and evidence links are tracked, so every change back to a source is traceable.',
  },
];

export default function SecuritySection() {
  return (
    <section id="security" className="lv-section">
      <div className="lv-section-inner">
        <h2 className="lv-section-heading">Governance you can show a regulator</h2>
        <p className="lv-section-sub">
          The workspace is built to survive scrutiny, not just look tidy.
        </p>
        <div className="lv-features-grid">
          {POINTS.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="lv-feature-card">
              <Icon size={22} strokeWidth={1.5} className="lv-feature-icon" />
              <div className="lv-feature-title">{title}</div>
              <p className="lv-feature-desc">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
