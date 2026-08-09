// Single selectable role card used in the landing page's "Continue as"
// section (LoginSection.jsx). Presentational only — click handling and
// role data live in the parent / config module respectively.
export default function RoleCard({ icon: Icon, title, description, onClick }) {
  return (
    <button type="button" onClick={onClick} className="lv-role-card">
      <Icon size={24} strokeWidth={1.5} className="lv-role-icon" />
      <span className="lv-role-title">{title}</span>
      <p className="lv-role-desc">{description}</p>
    </button>
  );
}
