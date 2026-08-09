/**
 * AdminProjects.jsx
 * 
 * System Admin Projects management page.
 * Displays all active SME IPO DRHP drafting projects/companies,
 * lifecycle stages, and assigned team members across roles.
 * 
 * Actions: Assign users to project, view project details.
 */
import { useState, useEffect } from 'react';
import { Briefcase, UserPlus, Link as LinkIcon, Building2, CheckCircle, Clock, X } from 'lucide-react';
import { fetchAdminProjects, fetchAdminUsers } from './api';

export default function AdminProjects() {
  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedProject, setSelectedProject] = useState(null);
  const [selectedUserToAssign, setSelectedUserToAssign] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [pList, uList] = await Promise.all([
      fetchAdminProjects(),
      fetchAdminUsers(),
    ]);
    setProjects(pList);
    setUsers(uList);
    setLoading(false);
  };

  const handleAssignUser = (e) => {
    e.preventDefault();
    if (!selectedProject || !selectedUserToAssign) return;

    const userObj = users.find((u) => u.id === selectedUserToAssign || u.name === selectedUserToAssign);
    const userName = userObj ? userObj.name : selectedUserToAssign;

    setProjects((prev) =>
      prev.map((p) => {
        if (p.id === selectedProject.id) {
          const currentList = p.assigned_users || [];
          if (!currentList.includes(userName)) {
            return { ...p, assigned_users: [...currentList, userName] };
          }
        }
        return p;
      })
    );

    setSelectedProject(null);
    setSelectedUserToAssign('');
  };

  return (
    <div className="admin-page-container">
      <header className="admin-page-header">
        <h1 className="admin-page-title">Projects Management</h1>
        <p className="admin-page-subtitle">
          Manage active SME IPO filings, monitor workflow stages, and assign multi-disciplinary teams.
        </p>
      </header>

      {/* Projects Grid */}
      <div className="admin-projects-grid">
        {projects.map((prj) => (
          <div key={prj.id} className="admin-project-card">
            <div className="admin-project-card-header">
              <div className="admin-project-icon">
                <Building2 size={20} />
              </div>
              <div className="admin-project-title-area">
                <h3 className="admin-project-name">{prj.name}</h3>
                <div className="admin-project-cin">CIN: {prj.cin}</div>
              </div>
              <span className={`admin-badge ${prj.status === 'Completed' ? 'admin-badge-green' : 'admin-badge-amber'}`}>
                {prj.status}
              </span>
            </div>

            <div className="admin-project-stage-box">
              <div className="stage-label">Current Stage</div>
              <div className="stage-value">
                {prj.status === 'Completed' ? <CheckCircle size={14} color="#2D6A4F" /> : <Clock size={14} color="#B45309" />}
                <span>{prj.stage}</span>
              </div>
            </div>

            {/* Assigned Users List */}
            <div className="admin-project-team">
              <div className="team-header">
                <span>Assigned Team Members</span>
                <button
                  type="button"
                  className="admin-inline-btn"
                  onClick={() => setSelectedProject(prj)}
                >
                  <UserPlus size={13} />
                  <span>Assign</span>
                </button>
              </div>

              <div className="team-tags">
                {(prj.assigned_users || []).map((uName, idx) => (
                  <span key={idx} className="team-tag">
                    {uName}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Assign User Modal */}
      {selectedProject && (
        <div className="admin-modal-overlay">
          <div className="admin-modal-card">
            <div className="admin-modal-header">
              <h3>Assign User to {selectedProject.name}</h3>
              <button type="button" onClick={() => setSelectedProject(null)} className="admin-close-btn">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleAssignUser}>
              <div className="admin-form-group">
                <label>Select Team Member</label>
                <select
                  value={selectedUserToAssign}
                  onChange={(e) => setSelectedUserToAssign(e.target.value)}
                  className="admin-select-full"
                  required
                >
                  <option value="">-- Choose User --</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.name}>
                      {u.name} ({u.email}) &mdash; {u.role}
                    </option>
                  ))}
                </select>
              </div>
              <div className="admin-modal-footer">
                <button type="button" className="admin-btn admin-btn-secondary" onClick={() => setSelectedProject(null)}>
                  Cancel
                </button>
                <button type="submit" className="admin-btn admin-btn-primary">
                  Assign to Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
