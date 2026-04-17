import React from 'react';

export const GenericLogo = ({ className }: { className?: string }) => (
  <div className={`flex flex-col items-center justify-center text-center ${className}`}>
    <div className="text-2xl font-black text-white tracking-tighter leading-none uppercase">
      Controle de Frota
    </div>
    <div className="text-[10px] font-bold text-emerald-500 tracking-[0.3em] uppercase mt-1">
      e Manutenção
    </div>
  </div>
);
