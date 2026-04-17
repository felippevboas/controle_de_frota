import React, { useState, useRef, useEffect } from 'react';
import { X, Search } from 'lucide-react';
import { cn } from '../lib/utils';

export function MultiSelect({
  options,
  selectedIds,
  onChange,
  placeholder = "Buscar e selecionar..."
}: {
  options: { id: string; name: string; category?: string; nature?: string }[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  placeholder?: string;
}) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredOptions = options.filter(opt => 
    !selectedIds.includes(opt.id) && 
    (opt.name.toLowerCase().includes(query.toLowerCase()) || 
     (opt.category && opt.category.toLowerCase().includes(query.toLowerCase())))
  );

  const selectedOptions = options.filter(opt => selectedIds.includes(opt.id));

  const handleSelect = (id: string) => {
    onChange([...selectedIds, id]);
    setQuery('');
  };

  const handleRemove = (id: string) => {
    onChange(selectedIds.filter(selectedId => selectedId !== id));
  };

  return (
    <div className={cn("relative w-full", isOpen ? "z-50" : "z-0")} ref={wrapperRef}>
      <div 
        className={cn(
          "min-h-[42px] w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1.5 flex flex-wrap gap-2 items-center transition-all cursor-text",
          isOpen ? "ring-2 ring-emerald-500/20 border-emerald-500" : ""
        )}
        onClick={() => setIsOpen(true)}
      >
        {selectedOptions.map(opt => (
          <span key={opt.id} className="flex items-center gap-1 bg-zinc-800 text-white text-xs px-2 py-1 rounded-md border border-zinc-700">
            {opt.name}
            <button 
              type="button"
              onClick={(e) => { e.stopPropagation(); handleRemove(opt.id); }}
              className="text-zinc-400 hover:text-rose-400 focus:outline-none"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        <div className="flex-1 min-w-[120px] flex items-center gap-2 px-1">
          <Search className="w-4 h-4 text-zinc-500" />
          <input
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setIsOpen(true); }}
            onFocus={() => setIsOpen(true)}
            placeholder={selectedIds.length === 0 ? placeholder : "Adicionar mais..."}
            className="bg-transparent border-none text-sm text-white focus:ring-0 outline-none w-full p-0"
          />
        </div>
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl max-h-60 overflow-y-auto custom-scrollbar">
          {filteredOptions.length > 0 ? (
            <div className="p-1">
              {filteredOptions.map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleSelect(opt.id)}
                  className="w-full text-left px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white rounded-md transition-colors flex justify-between items-center"
                >
                  <span>{opt.name}</span>
                  {(opt.nature || opt.category) && (
                    <span className="text-[10px] uppercase text-zinc-500 font-bold">{opt.nature || opt.category}</span>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <div className="px-4 py-3 text-sm text-zinc-500 text-center">
              Nenhum serviço encontrado.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
