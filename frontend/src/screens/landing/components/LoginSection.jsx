/**
 * LoginSection.jsx
 *
 * Role-selection section on the landing page. Shows one card per role;
 * clicking a card persists the chosen role to localStorage (key:
 * "nirmaan_role") so App.jsx can route to the correct dashboard after
 * authentication completes.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import RoleCard from './RoleCard';
import { ROLE_OPTIONS } from '../config/roleOptions';

export default function LoginSection() {
  const navigate = useNavigate();
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (!toast) return undefined;
    const id = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(id);
  }, [toast]);

  const handleRoleClick = (role) => {
    if (role.action === 'navigate') {
      // Carry the selected role id forward as router state so Auth.jsx
      // knows which role is signing in, and can route post-login
      // accordingly (see utils/roleRouting.js).
      localStorage.setItem('nirmaan_role', role.id);
      navigate(role.to, { state: { role: role.id } });
    } else {
      setToast(role.toastMessage);
    }
  };

  return (
    <section id="login" className="lv-grid-light bg-[#F1EEE6] border-t border-[#DEDAD0]">
      <div className="max-w-7xl mx-auto px-6 sm:px-8 py-16 sm:py-24 text-center flex flex-col items-center">
        <h2 className="font-sans text-3xl font-bold text-[#1C1B19] mb-3 tracking-tight">
          Continue as
        </h2>
        <p className="font-sans text-sm text-[#5C5A54] mb-10">
          Select your role to enter the workspace.
        </p>

        <div className="lv-role-grid">
          {ROLE_OPTIONS.map((role) => (
            <RoleCard
              key={role.id}
              icon={role.icon}
              title={role.title}
              description={role.description}
              onClick={() => handleRoleClick(role)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
