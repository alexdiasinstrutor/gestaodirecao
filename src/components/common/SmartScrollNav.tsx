import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
interface SmartScrollNavProps { children: React.ReactNode; ariaLabel?: string; className?: string }
/** Deliberate touch, keyboard and arrow navigation. Menu items never move on hover. */
export const SmartScrollNav: React.FC<SmartScrollNavProps> = ({ children, ariaLabel = 'Menu de Navegação', className = '' }) => {
  const navRef = useRef<HTMLElement>(null);
  const [bounds, setBounds] = useState({ left: false, right: false });
  const measure = useCallback(() => {
    const el = navRef.current;
    if (el) setBounds({ left: el.scrollLeft > 2, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 2 });
  }, []);
  useEffect(() => {
    const el = navRef.current; if (!el) return;
    const observer = new ResizeObserver(measure); observer.observe(el); measure();
    return () => observer.disconnect();
  }, [measure, children]);
  const scroll = (left: number) => navRef.current?.scrollBy({ left, behavior: 'smooth' });
  return <div className="relative group">
    {bounds.left && <button type="button" onClick={() => scroll(-240)} aria-label="Rolar menu para a esquerda" className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-9 h-9 flex items-center justify-center rounded-full bg-slate-900 text-white shadow-md"><ChevronLeft size={18}/></button>}
    <nav ref={navRef} aria-label={ariaLabel} onScroll={measure} className={'overflow-x-auto no-scrollbar scroll-smooth ' + className}>{children}</nav>
    {bounds.right && <button type="button" onClick={() => scroll(240)} aria-label="Rolar menu para a direita" className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-9 h-9 flex items-center justify-center rounded-full bg-slate-900 text-white shadow-md"><ChevronRight size={18}/></button>}
  </div>;
};
