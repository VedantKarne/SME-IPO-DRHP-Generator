import { motion, useScroll, useTransform } from 'framer-motion';

const LINKS = [
  { id: 'features', label: 'Features' },
  { id: 'how-it-works', label: 'How it Works' },
  { id: 'security', label: 'Security' },
];

function scrollToId(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export default function LandingHeader() {
  const { scrollY } = useScroll();
  const markScale = useTransform(scrollY, [0, 240], [1, 1.18]);

  return (
    <header className="lv-header">
      <div className="lv-header-inner">
        <div className="lv-wordmark">
          <motion.span className="lv-wordmark-mark" style={{ scale: markScale }}>
            N
          </motion.span>
          Nirmaan AI
        </div>
        <nav className="lv-nav">
          {LINKS.map(link => (
            <button
              key={link.id}
              type="button"
              className="lv-nav-link"
              onClick={() => scrollToId(link.id)}
            >
              {link.label}
            </button>
          ))}
        </nav>
      </div>
    </header>
  );
}
