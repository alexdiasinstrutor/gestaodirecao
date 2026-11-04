import React, { useRef, useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface SmartScrollNavProps {
  children: React.ReactNode;
  ariaLabel?: string;
  className?: string;
}

/**
 * Barra de navegação inteligente:
 * 1. Em telas amplas (Desktop), acomoda todos os itens visíveis sem cortar.
 * 2. Caso haja overflow horizontal (telas menores, zoom ou muitos itens):
 *    - Desliza automaticamente quando o mouse se aproxima da borda direita ou esquerda;
 *    - Suporta rolagem com a roda do mouse (wheel horizontal);
 *    - Exibe botões sutis de avanço/recuo nas extremidades quando há conteúdo oculto.
 */
export const SmartScrollNav: React.FC<SmartScrollNavProps> = ({
  children,
  ariaLabel = 'Menu de Navegação',
  className = ''
}) => {
  const navRef = useRef<HTMLElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const scrollSpeedRef = useRef<number>(0);

  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScrollBounds = useCallback(() => {
    const el = navRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 2);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 2);
  }, []);

  useEffect(() => {
    checkScrollBounds();
    const el = navRef.current;
    if (!el) return;

    const resizeObserver = new ResizeObserver(() => checkScrollBounds());
    resizeObserver.observe(el);
    window.addEventListener('resize', checkScrollBounds);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', checkScrollBounds);
    };
  }, [checkScrollBounds, children]);

  const stopAutoScroll = useCallback(() => {
    scrollSpeedRef.current = 0;
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const startAutoScrollLoop = useCallback(() => {
    if (rafRef.current !== null) return;

    const step = () => {
      const el = navRef.current;
      if (el && scrollSpeedRef.current !== 0) {
        el.scrollLeft += scrollSpeedRef.current;
        checkScrollBounds();
        rafRef.current = requestAnimationFrame(step);
      } else {
        rafRef.current = null;
      }
    };

    rafRef.current = requestAnimationFrame(step);
  }, [checkScrollBounds]);

  const handleMouseMove = (e: React.MouseEvent<HTMLElement>) => {
    const el = navRef.current;
    if (!el) return;

    // Only auto-scroll if content actually overflows
    if (el.scrollWidth <= el.clientWidth + 2) {
      stopAutoScroll();
      return;
    }

    const rect = el.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const edgeThreshold = Math.min(110, rect.width * 0.18); // 18% on each side (up to 110px)

    if (mouseX < edgeThreshold && el.scrollLeft > 0) {
      // Mouse near left edge -> scroll left (move menu right)
      const intensity = 1 - mouseX / edgeThreshold;
      scrollSpeedRef.current = -Math.max(2, intensity * 8);
      startAutoScrollLoop();
    } else if (
      mouseX > rect.width - edgeThreshold &&
      el.scrollLeft + el.clientWidth < el.scrollWidth
    ) {
      // Mouse near right edge -> scroll right (move menu left until end)
      const distanceIntoRightZone = mouseX - (rect.width - edgeThreshold);
      const intensity = distanceIntoRightZone / edgeThreshold;
      scrollSpeedRef.current = Math.max(2, intensity * 8);
      startAutoScrollLoop();
    } else {
      stopAutoScroll();
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLElement>) => {
    const el = navRef.current;
    if (!el || el.scrollWidth <= el.clientWidth) return;
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      el.scrollLeft += e.deltaY;
      checkScrollBounds();
    }
  };

  const scrollByAmount = (delta: number) => {
    const el = navRef.current;
    if (!el) return;
    el.scrollBy({ left: delta, behavior: 'smooth' });
    setTimeout(checkScrollBounds, 250);
  };

  useEffect(() => {
    return () => stopAutoScroll();
  }, [stopAutoScroll]);

  return (
    <div className="relative group">
      {/* Left Scroll Indicator Button */}
      {canScrollLeft && (
        <button
          type="button"
          onClick={() => scrollByAmount(-220)}
          className="flex items-center justify-center absolute left-1 top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full bg-slate-900/90 text-white shadow-md hover:bg-blue-600 transition-all cursor-pointer"
          title="Rolar menu para a esquerda"
          aria-label="Rolar menu para a esquerda"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      )}

      <nav
        ref={navRef}
        aria-label={ariaLabel}
        onMouseMove={handleMouseMove}
        onMouseLeave={stopAutoScroll}
        onScroll={checkScrollBounds}
        onWheel={handleWheel}
        className={`overflow-x-auto no-scrollbar scroll-smooth ${className}`}
      >
        {children}
      </nav>

      {/* Right Scroll Indicator Button */}
      {canScrollRight && (
        <button
          type="button"
          onClick={() => scrollByAmount(220)}
          className="flex items-center justify-center absolute right-1 top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full bg-slate-900/90 text-white shadow-md hover:bg-blue-600 transition-all cursor-pointer"
          title="Rolar menu para a direita"
          aria-label="Rolar menu para a direita"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

