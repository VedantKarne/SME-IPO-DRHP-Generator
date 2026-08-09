/**
 * AdminUsers.jsx
 * 
 * System Admin users management page.
 * Displays a clean data table of all platform users with roles,
 * project assignments, and active status.
 * 
 * Actions: Create user, Invite user, Assign/Change role, Remove user,
 * Deactivate account, search and filter by role/project.
 */
import { useState, useEffect, useMemo } from 'react';
import { UserPlus, Mail, Search, Shield, Trash2, UserCheck, UserX, Edit3, X } from 'lucide-react';
import { fetchAdminUsers, createAdminUserApi, updateAdminUserApi, deleteAdminUserApi } from './api';

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [deletingUser, setDeletingUser] = useState(null);

  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formRole, setFormRole] = useState('promoter');
  const [formProject, setFormProject] = useState('TechServ Solutions Ltd');

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    const dst = await fetchAdminUsers();
    setUsers(dst);
    setLoading(false);
  };

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchesSearch = !searchQuery ||
        u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (u.company_name || '').toLowerCase().includes(searchQuery.toLowerCase());

      const matchesRole = roleFilter === 'all' || u.role === roleFilter;
      const matchesStatus = statusFilter === 'all' ||
        (statusFilter === 'active' ? u.is_active : !u.is_active);

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, searchQuery, roleFilter, statusFilter]);

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!formEmail.trim()) return;
    const newUser = await createAdminUserApi({
      name: formName.trim() || formEmail.split('@')[0],
      email: formEmail.trim(),
      role: formRole,
      company_name: formProject,
    });
    setUsers((prev) => [newUser, ...prev]);
    setShowCreateModal(false);
    resetForm();
  };

  const handleInviteUser = async (e) => {
    e.preventDefault();
    if (!formEmail.trim()) return;
    const newUser = await createAdminUserApi({
      name: formName.trim() || formEmail.split('@')[0],
      email: formEmail.trim(),
      role: formRole,
      company_name: formProject,
    });
    setUsers((prev) => [newUser, ...prev]);
    setShowInviteModal(false);
    resetForm();
  };

  const handleToggleStatus = async (user) => {
    await updateAdminUserApi(user.id, { is_active: !user.is_active });
    setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, is_active: !user.is_active } : u)));
  };

  const handleUpdateRole = async (e) => {
    e.preventDefault();
    if (!editingUser) return;
    await updateAdminUserApi(editingUser.id, { role: formRole });
    setUsers((prev) => prev.map((u) => (u.id === editingUser.id ? { ...u, role: formRole } : u)));
    setEditingUser(null);
  };

  const handleDeleteUser = async () => {
    if (!deletingUser) return;
    await deleteAdminUserApi(deletingUser.id);
    setUsers((prev) => prev.filter((u) => u.id !== deletingUser.id));
    setDeletingUser(null);
  };

  const resetForm = () => {
    setFormName('');
    setFormEmail('');
    setFormRole('promoter');
    setFormProject('TechServ Solutions Ltd');
  };

  const getRoleBadgeClass = (role) => {
    switch (role) {
      case 'admin': return 'admin-badge-red';
      case 'finance_ca': return 'admin-badge-amber';
      case 'merchant_banker': return 'admin-badge-green';
      case 'legal_advisor': return 'admin-badge-blue';
      default: return 'admin-badge-gray';
    }
  };

  const formatRoleLabel = (role) => {
    switch (role) {
      case 'admin': return 'System Admin';
      case 'finance_ca': return 'Finance / CA';
      case 'merchant_banker': return 'Merchant Banker';
      case 'legal_advisor': return 'Legal Advisor';
      default: return 'Founder / Promoter';
    }
  };

  return (
    <div className="admin-page-container">
      <header className="admin-page-header">
        <div className="admin-header-flex">
          <div>
            <h1 className="admin-page-title">Users Management</h1>
            <p className="admin-page-subtitle">
              Manage platform accounts, role assignments, and project access controls.
            </p>
          </div>
          <div className="admin-header-actions">
            <button
              type="button"
              className="admin-btn admin-btn-secondary"
              onClick={() => { resetForm(); setShowInviteModal(true); }}
            >
              <Mail size={15} />
              <span>Invite User</span>
            </button>
            <button
              type="button"
              className="admin-btn admin-btn-primary"
              onClick={() => { resetForm(); setShowCreateModal(true); }}
            >
              <UserPlus size={15} />
              <span>Create User</span>
            </button>
          </div>
        </div>
      </header>

      {/* Filter Bar */}
      <div className="admin-filter-bar">
        <div className="admin-search-box">
          <Search size={15} className="admin-search-icon" />
          <input
            type="text"
            placeholder="Search users by name, email, or project..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="admin-search-input"
          />
        </div>

        <div className="admin-filter-dropdowns">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="admin-select"
          >
            <option value="all">All Roles</option>
            <option value="promoter">Founder / Promoter</option>
            <option value="finance_ca">Finance / CA</option>
            <option value="merchant_banker">Merchant Banker</option>
            <option value="legal_advisor">Legal Advisor</option>
            <option value="admin">System Admin</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="admin-select"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      {/* Users Data Table */}
      <div className="admin-table-card">
        <table className="admin-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Assigned Role</th>
              <th>Associated Project</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan="5" className="admin-empty-table">
                  No users found matching your filters.
                </td>
              </tr>
            ) : (
              filteredUsers.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div className="admin-table-user">
                      <div className="admin-avatar">{u.name.charAt(0).toUpperCase()}</div>
                      <div>
                        <div className="admin-user-name">{u.name}</div>
                        <div className="admin-user-email">{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className={`admin-badge ${getRoleBadgeClass(u.role)}`}>
                      {formatRoleLabel(u.role)}
                    </span>
                  </td>
                  <td className="admin-project-cell">{u.company_name || 'TechServ Solutions Ltd'}</td>
                  <td>
                    <span className={`admin-status-pill ${u.is_active ? 'active' : 'inactive'}`}>
                      <span className="dot"></span>
                      {u.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <div className="admin-actions-cell">
                      <button
                        type="button"
                        className="admin-icon-btn"
                        title="Change Role"
                        onClick={() => { setEditingUser(u); setFormRole(u.role); }}
                      >
                        <Edit3 size={15} />
                      </button>

                      <button
                        type="button"
                        className={`admin-icon-btn ${u.is_active ? 'warning' : 'success'}`}
                        title={u.is_active ? 'Deactivate Account' : 'Activate Account'}
                        onClick={() => handleToggleStatus(u)}
                      >
                        {u.is_active ? <UserX size={15} /> : <UserCheck size={15} />}
                      </button>

                      <button
                        type="button"
                        className="admin-icon-btn danger"
                        title="Remove User"
                        onClick={() => setDeletingUser(u)}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create / Invite Modal */}
      {(showCreateModal || showInviteModal) && (
        <div className="admin-modal-overlay">
          <div className="admin-modal-card">
            <div className="admin-modal-header">
              <h3>{showCreateModal ? 'Create New User Account' : 'Invite User to Platform'}</h3>
              <button type="button" onClick={() => { setShowCreateModal(false); setShowInviteModal(false); }} className="admin-close-btn">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={showCreateModal ? handleCreateUser : handleInviteUser}>
              <div className="admin-form-group">
                <label>User Name</label>
                <input
                  type="text"
                  placeholder="e.g. Shruti Joshi"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="admin-input"
                />
              </div>
              <div className="admin-form-group">
                <label>Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="name@company.com"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  className="admin-input"
                />
              </div>
              <div className="admin-form-group">
                <label>System Role</label>
                <select
                  value={formRole}
                  onChange={(e) => setFormRole(e.target.value)}
                  className="admin-select-full"
                >
                  <option value="promoter">Founder / Promoter</option>
                  <option value="finance_ca">Finance / CA</option>
                  <option value="merchant_banker">Merchant Banker</option>
                  <option value="legal_advisor">Legal Advisor</option>
                  <option value="admin">System Admin</option>
                </select>
              </div>
              <div className="admin-form-group">
                <label>Associated Project / Company</label>
                <input
                  type="text"
                  value={formProject}
                  onChange={(e) => setFormProject(e.target.value)}
                  className="admin-input"
                />
              </div>
              <div className="admin-modal-footer">
                <button type="button" className="admin-btn admin-btn-secondary" onClick={() => { setShowCreateModal(false); setShowInviteModal(false); }}>
                  Cancel
                </button>
                <button type="submit" className="admin-btn admin-btn-primary">
                  {showCreateModal ? 'Create Account' : 'Send Email Invite'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Change Role Modal */}
      {editingUser && (
        <div className="admin-modal-overlay">
          <div className="admin-modal-card">
            <div className="admin-modal-header">
              <h3>Change Role for {editingUser.name}</h3>
              <button type="button" onClick={() => setEditingUser(null)} className="admin-close-btn">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleUpdateRole}>
              <div className="admin-form-group">
                <label>Current Role: {formatRoleLabel(editingUser.role)}</label>
                <select
                  value={formRole}
                  onChange={(e) => setFormRole(e.target.value)}
                  className="admin-select-full"
                >
                  <option value="promoter">Founder / Promoter</option>
                  <option value="finance_ca">Finance / CA</option>
                  <option value="merchant_banker">Merchant Banker</option>
                  <option value="legal_advisor">Legal Advisor</option>
                  <option value="admin">System Admin</option>
                </select>
              </div>
              <div className="admin-modal-footer">
                <button type="button" className="admin-btn admin-btn-secondary" onClick={() => setEditingUser(null)}>
                  Cancel
                </button>
                <button type="submit" className="admin-btn admin-btn-primary">
                  Save Role Assignment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete User Confirmation Modal */}
      {deletingUser && (
        <div className="admin-modal-overlay">
          <div className="admin-modal-card">
            <div className="admin-modal-header">
              <h3>Remove User Account</h3>
              <button type="button" onClick={() => setDeletingUser(null)} className="admin-close-btn">
                <X size={18} />
              </button>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--ink-soft)', marginBottom: 20 }}>
              Are you sure you want to remove <strong>{deletingUser.name}</strong> ({deletingUser.email})? This action cannot be undone.
            </p>
            <div className="admin-modal-footer">
              <button type="button" className="admin-btn admin-btn-secondary" onClick={() => setDeletingUser(null)}>
                Cancel
              </button>
              <button type="button" className="admin-btn admin-btn-danger" onClick={handleDeleteUser}>
                Remove User
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
