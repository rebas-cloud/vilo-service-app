import { useState, useCallback, useRef, TouchEvent } from 'react';
import { IconX } from '@tabler/icons-react';

import viloLogo from '../assets/VILO.svg';

interface AboutViloProps {
  onClose: () => void;
}

const slides = [
  {
    id: 1,
    content: (
      <div className="flex flex-col items-center justify-center h-full px-8 text-center">
        <img src={viloLogo} alt="Vilo" className="mb-6 h-14 w-auto" />
        <p className="text-xl text-white/90 font-light leading-relaxed max-w-md">
          Die Intelligenzschicht{' '}
          <span className="text-[#7bb7ef]">fur Unternehmen</span>
        </p>
        <div className="mt-10 w-12 h-px bg-white/20" />
        <p className="mt-6 text-white/40 text-sm font-light tracking-wide">
          Kein weiteres Tool. Eine neue Schicht.
        </p>
      </div>
    ),
  },
  {
    id: 2,
    content: (
      <div className="flex flex-col justify-center h-full px-8">
        <p className="text-white/40 text-xs font-medium tracking-[0.2em] uppercase mb-8">
          Problem
        </p>
        <h2 className="text-2xl font-semibold text-white leading-snug max-w-sm">
          Unternehmen nutzen viele Systeme.
        </h2>
        <h2 className="text-2xl font-semibold text-white/50 leading-snug mt-2 max-w-sm">
          Aber nichts ist wirklich verbunden.
        </h2>
        <div className="mt-12 w-12 h-px bg-white/10" />
        <p className="mt-6 text-white/30 text-sm font-light max-w-xs leading-relaxed">
          Daten existieren -- arbeiten aber nicht zusammen.
        </p>
      </div>
    ),
  },
  {
    id: 3,
    content: (
      <div className="flex flex-col justify-center h-full px-8">
        <p className="text-white/40 text-xs font-medium tracking-[0.2em] uppercase mb-8">
          Insight
        </p>
        <h2 className="text-2xl font-semibold text-white leading-snug max-w-sm">
          Das Problem sind nicht die Daten.
        </h2>
        <div className="mt-8" />
        <p className="text-lg text-white/60 font-light leading-relaxed max-w-sm">
          Es fehlt <span className="text-[#7bb7ef]">Verstandnis</span> zwischen
          Systemen, Prozessen und Entscheidungen.
        </p>
      </div>
    ),
  },
  {
    id: 4,
    content: (
      <div className="flex flex-col justify-center h-full px-8">
        <p className="text-white/40 text-xs font-medium tracking-[0.2em] uppercase mb-8">
          Losung
        </p>
        <h2 className="text-2xl font-semibold text-white leading-snug max-w-sm mb-10">
          VILO ist der Layer uber allen Systemen.
        </h2>
        <div className="space-y-4">
          <p className="text-lg text-white/70 font-light">Es hort zu.</p>
          <p className="text-lg text-white/70 font-light">Es versteht.</p>
          <p className="text-lg text-[#7bb7ef] font-light">Es verbindet.</p>
        </div>
      </div>
    ),
  },
  {
    id: 5,
    content: (
      <div className="flex flex-col justify-center h-full px-8">
        <p className="text-white/40 text-xs font-medium tracking-[0.2em] uppercase mb-8">
          Wie VILO arbeitet
        </p>
        <h2 className="text-xl font-semibold text-white leading-snug max-w-sm mb-10">
          VILO lauft im Hintergrund.
        </h2>
        <div className="space-y-5">
          <div className="flex items-start gap-3">
            <div className="w-1 h-1 rounded-full bg-[#7bb7ef] mt-2.5 flex-shrink-0" />
            <p className="text-white/60 font-light">Analysiert Meetings</p>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-1 h-1 rounded-full bg-[#7bb7ef] mt-2.5 flex-shrink-0" />
            <p className="text-white/60 font-light">
              Verbindet Entscheidungen mit Daten
            </p>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-1 h-1 rounded-full bg-[#7bb7ef] mt-2.5 flex-shrink-0" />
            <p className="text-white/60 font-light">Erkennt Muster</p>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 6,
    content: (
      <div className="flex flex-col justify-center h-full px-8">
        <p className="text-white/40 text-xs font-medium tracking-[0.2em] uppercase mb-8">
          Unterschied
        </p>
        <h2 className="text-xl font-semibold text-white/50 leading-snug max-w-sm mb-10">
          Andere Systeme zeigen die Vergangenheit.
        </h2>
        <div className="space-y-3">
          <p className="text-2xl font-semibold text-white">
            VILO zeigt:
          </p>
          <p className="text-2xl font-light text-[#7bb7ef]">Jetzt.</p>
          <p className="text-2xl font-light text-[#7bb7ef]">
            Nachster Schritt.
          </p>
        </div>
      </div>
    ),
  },
  {
    id: 7,
    content: (
      <div className="flex flex-col items-center justify-center h-full px-8 text-center">
        <p className="text-white/40 text-xs font-medium tracking-[0.2em] uppercase mb-12">
          Architektur
        </p>
        <div className="space-y-6">
          <div className="text-white/30 text-sm font-light tracking-wide">Hardware</div>
          <div className="w-px h-6 bg-white/10 mx-auto" />
          <div className="text-white/50 text-sm font-light tracking-wide">Systeme</div>
          <div className="w-px h-6 bg-[#7bb7ef]/30 mx-auto" />
          <img src={viloLogo} alt="Vilo" className="mx-auto h-8 w-auto" />
        </div>
        <div className="mt-12 w-12 h-px bg-white/10" />
        <p className="mt-6 text-white/40 text-sm font-light tracking-wide">
          Versteht &middot; Verbindet &middot; Optimiert
        </p>
      </div>
    ),
  },
  {
    id: 8,
    content: (
      <div className="flex flex-col justify-center h-full px-8">
        <p className="text-white/40 text-xs font-medium tracking-[0.2em] uppercase mb-8">
          Produkt
        </p>
        <h2
          className="text-3xl font-bold text-white mb-10"
          style={{ fontFamily: 'Otista, sans-serif', letterSpacing: '0.03em' }}
        >
          vilo os
        </h2>
        <div className="space-y-4">
          <p className="text-lg text-white/60 font-light">Fortschritt.</p>
          <p className="text-lg text-white/60 font-light">Prognosen.</p>
          <p className="text-lg text-[#7bb7ef] font-light">Optimierung.</p>
        </div>
      </div>
    ),
  },
  {
    id: 9,
    content: (
      <div className="flex flex-col justify-center h-full px-8">
        <p className="text-white/40 text-xs font-medium tracking-[0.2em] uppercase mb-8">
          Vision
        </p>
        <h2 className="text-2xl font-semibold text-white leading-snug max-w-sm mb-6">
          Vom Assistenten zum operativen{' '}
          <span className="text-[#7bb7ef]">Gehirn</span>.
        </h2>
        <div className="mt-6 w-12 h-px bg-white/10" />
        <div className="mt-8 space-y-3">
          <p className="text-white/40 text-sm font-light">
            Pilotphase startet Q3.
          </p>
          <p className="text-white/50 text-sm font-medium">
            Ziel: Selbstoptimierende Unternehmen.
          </p>
        </div>
      </div>
    ),
  },
];

export function AboutVilo({ onClose }: AboutViloProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

  const goToSlide = useCallback(
    (index: number) => {
      if (isAnimating || index < 0 || index >= slides.length) return;
      setIsAnimating(true);
      setCurrentSlide(index);
      setTimeout(() => setIsAnimating(false), 400);
    },
    [isAnimating],
  );

  const handleTouchStart = useCallback((e: TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchEndX.current = e.touches[0].clientX;
  }, []);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
  }, []);

  const handleTouchEnd = useCallback(() => {
    const diff = touchStartX.current - touchEndX.current;
    const threshold = 50;
    if (diff > threshold) {
      goToSlide(currentSlide + 1);
    } else if (diff < -threshold) {
      goToSlide(currentSlide - 1);
    }
  }, [currentSlide, goToSlide]);

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col"
      style={{
        background: '#0A0A0A',
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {/* Close button */}
      <div className="flex justify-end px-5 pt-4">
        <button
          onClick={onClose}
          className="p-2 rounded-full text-white/30 hover:text-white/60 transition-colors"
        >
          <IconX className="w-5 h-5" />
        </button>
      </div>

      {/* Slide content */}
      <div
        className="flex-1 overflow-hidden"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div
          className="h-full transition-opacity duration-400 ease-out"
          style={{ opacity: isAnimating ? 0 : 1 }}
          key={currentSlide}
        >
          {slides[currentSlide].content}
        </div>
      </div>

      {/* Navigation dots */}
      <div className="flex items-center justify-center gap-2 pb-6 pt-4">
        {slides.map((_, index) => (
          <button
            key={index}
            onClick={() => goToSlide(index)}
            className="transition-all duration-300"
            style={{
              width: index === currentSlide ? 20 : 6,
              height: 6,
              borderRadius: 3,
              background:
                index === currentSlide
                  ? '#7bb7ef'
                  : 'rgba(255,255,255,0.15)',
            }}
          />
        ))}
      </div>

      {/* Slide counter */}
      <div className="text-center pb-4">
        <span className="text-white/20 text-xs font-light">
          {currentSlide + 1} / {slides.length}
        </span>
      </div>
    </div>
  );
}
