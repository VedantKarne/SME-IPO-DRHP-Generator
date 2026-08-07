import HeroAnimation from './HeroAnimation';

export default function LandingHero() {
  const scrollToSection = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <section className="border-b border-[#DEDAD0]">
      <div className="max-w-7xl mx-auto px-6 sm:px-8 py-16 sm:py-24">
        <div className="grid grid-cols-12 gap-8 items-center">

          {/* Left: Copy */}
          <div className="col-span-12 lg:col-span-7 flex flex-col items-start">
            {/* Badge */}
            <div className="inline-block px-3 py-1 bg-[#F1EEE6] border border-[#8A2E2E]/20 text-[#8A2E2E] font-sans font-bold text-xs uppercase tracking-widest rounded-sm mb-6">
              SME IPO DISCLOSURE DRAFTING SYSTEM
            </div>

            {/* Title */}
            <h1 className="text-4xl lg:text-5xl font-bold tracking-tight text-[#1C1B19] leading-[1.15] mb-4 max-w-[20ch]">
              Fragmented company records, turned into a disclosure-ready DRHP.
            </h1>

            {/* Subtitle */}
            <p className="text-lg text-[#5C5A54] mt-4 max-w-xl leading-relaxed">
              Nirmaan AI reads your financials, filings and board records, links every
              claim to its source, and drafts each DRHP section with the evidence attached —
              cutting the cost, time and intermediary dependence of a traditional filing.
            </p>

            {/* CTAs */}
            <div className="flex items-center gap-4 mt-8 flex-wrap">
              <button
                type="button"
                onClick={() => scrollToSection('features')}
                className="px-5 py-3 bg-[#8A2E2E] hover:bg-[#742525] text-white font-sans font-semibold text-sm rounded-sm transition-colors duration-150 flex items-center gap-2 cursor-pointer border border-transparent"
              >
                Explore Features ↓
              </button>
              <button
                type="button"
                onClick={() => scrollToSection('login')}
                className="px-5 py-3 bg-transparent hover:bg-[#F1EEE6] text-[#1C1B19] border border-[#DEDAD0] font-sans font-semibold text-sm rounded-sm transition-colors duration-150 flex items-center gap-2 cursor-pointer"
              >
                Quick Login →
              </button>
            </div>
          </div>

          {/* Right: Preview Card */}
          <div className="col-span-12 lg:col-span-5">
            <div className="border border-[#DEDAD0] bg-white p-6 rounded-sm shadow-sm w-full">
              <div className="flex items-center justify-between border-b border-[#DEDAD0] pb-3 mb-4">
                <span className="font-sans font-semibold text-xs text-[#5C5A54] uppercase tracking-wider">LIVE KNOWLEDGE LINKING</span>
                <span className="w-2 h-2 rounded-full bg-[#3D6B4F] animate-pulse" />
              </div>
              <HeroAnimation />
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
