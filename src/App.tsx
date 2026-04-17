import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { clsx } from 'clsx';
// Forçando atualização do preview para corrigir problema de carregamento
import { 
  LayoutDashboard, 
  Truck, 
  Users, 
  Fuel, 
  Wrench, 
  Disc, 
  FileText, 
  AlertTriangle, 
  AlertCircle,
  Settings,
  Database,
  Briefcase,
  User,
  UserX,
  UserCheck,
  Menu,
  X,
  Plus,
  RefreshCw,
  Edit2,
  Trash2,
  Info,
  MoreVertical,
  CheckCircle2, 
  Clock,
  ShieldCheck,
  Calendar,
  MapPin,
  DollarSign,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  Search,
  Upload,
  Download,
  FileSpreadsheet,
  Filter,
  Target,
  Copy,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  LogOut,
  Eye,
  Building2,
  FileCheck,
  ClipboardList,
  Droplets,
  XCircle,
  ShieldAlert,
  History,
  MessageSquare
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend,
  ResponsiveContainer, 
  LineChart, 
  Line,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { formatCurrency, formatNumber, formatDate, parseExcelDate, getLocalISODate, getFirstDayOfMonth, cn } from './lib/utils';
import { format, addMonths, isAfter, isBefore, startOfDay, endOfDay, differenceInDays, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Vehicle, Driver, Helper, FuelRecord, MaintenancePlan,
  FleetCategory, VehicleType, Brand, Model, MaintenanceType, Supplier,
  ResponsibleCompany,
  User as UserType, Profile, AppPermissions, FleetDocument, DocumentType
} from './types';
import { MultiSelect } from './components/MultiSelect';
import { LoginView } from './components/LoginView';
import { GenericLogo } from './components/GenericLogo';

// --- Components ---

let globalToken = localStorage.getItem('fleet_token') || '';

const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
  const token = globalToken || localStorage.getItem('fleet_token');
  if (!token) {
    console.warn(`[fetchWithAuth] No token found for ${url}`);
  }
  
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  } as any;
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const response = await fetch(url, {
    ...options,
    headers
  });

  if (response.status === 401) {
    if (token) {
      window.dispatchEvent(new Event('auth-error'));
    }
  }

  return response;
};

const Modal = ({ isOpen, onClose, title, children, size = 'md' }: { 
  isOpen: boolean, 
  onClose: () => void, 
  title: string, 
  children: React.ReactNode,
  size?: 'sm' | 'md' | 'lg' | 'xl'
}) => {
  if (!isOpen) return null;
  
  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-5xl'
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className={cn(
        "bg-zinc-900 border border-zinc-800 rounded-2xl w-full shadow-2xl my-auto",
        sizeClasses[size]
      )}>
        <div className="px-6 py-4 border-b border-zinc-800 flex justify-between items-center">
          <h3 className="text-xl font-bold text-white">{title}</h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>
        <div className="p-6 overflow-visible">
          {children}
        </div>
      </div>
    </div>
  );
};

const ConfirmModal = ({ isOpen, onClose, onConfirm, title, message, confirmText = "Confirmar", cancelText = "Cancelar", variant = "danger" }: { 
  isOpen: boolean, 
  onClose: () => void, 
  onConfirm: () => void, 
  title: string, 
  message: string, 
  confirmText?: string, 
  cancelText?: string,
  variant?: "danger" | "primary"
}) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
        <div className="p-6 text-center">
          <div className={cn(
            "w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4",
            variant === "danger" ? "bg-rose-500/10 text-rose-500" : "bg-emerald-500/10 text-emerald-500"
          )}>
            {variant === "danger" ? <Trash2 className="w-8 h-8" /> : <Settings className="w-8 h-8" />}
          </div>
          <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
          <p className="text-zinc-400 mb-6">{message}</p>
          <div className="flex space-x-3">
            <button 
              onClick={onClose}
              className="flex-1 px-4 py-2.5 bg-zinc-800 text-white rounded-xl hover:bg-zinc-700 transition-colors font-medium"
            >
              {cancelText}
            </button>
            <button 
              onClick={() => { onConfirm(); onClose(); }}
              className={cn(
                "flex-1 px-4 py-2.5 text-white rounded-xl transition-colors font-medium",
                variant === "danger" ? "bg-rose-600 hover:bg-rose-500" : "bg-emerald-600 hover:bg-emerald-500"
              )}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const Pagination = ({ 
  currentPage, 
  totalPages, 
  onPageChange, 
  itemsPerPage, 
  onItemsPerPageChange,
  totalItems
}: { 
  currentPage: number, 
  totalPages: number, 
  onPageChange: (page: number) => void,
  itemsPerPage: number,
  onItemsPerPageChange: (items: number) => void,
  totalItems: number
}) => {
  return (
    <div className="flex items-center justify-between border-t border-zinc-800 bg-zinc-900/50 px-4 py-3 sm:px-6 mt-4 rounded-lg">
      <div className="flex flex-1 justify-between sm:hidden">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="relative inline-flex items-center rounded-md border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-700 disabled:opacity-50"
        >
          Anterior
        </button>
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages || totalPages === 0}
          className="relative ml-3 inline-flex items-center rounded-md border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-700 disabled:opacity-50"
        >
          Próxima
        </button>
      </div>
      <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <p className="text-sm text-zinc-400">
            Mostrando <span className="font-medium text-white">{totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1}</span> a <span className="font-medium text-white">{Math.min(currentPage * itemsPerPage, totalItems)}</span> de <span className="font-medium text-white">{totalItems}</span> resultados
          </p>
          <div className="flex items-center gap-2">
            <span className="text-sm text-zinc-400">Itens por página:</span>
            <select
              value={itemsPerPage}
              onChange={(e) => {
                onItemsPerPageChange(Number(e.target.value));
                onPageChange(1);
              }}
              className="bg-zinc-800 border border-zinc-700 rounded text-sm text-white px-2 py-1 outline-none focus:border-emerald-500"
            >
              <option value={20}>20</option>
              <option value={30}>30</option>
              <option value={40}>40</option>
              <option value={50}>50</option>
            </select>
          </div>
        </div>
        <div>
          <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
            <button
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="relative inline-flex items-center rounded-l-md px-2 py-2 text-zinc-400 ring-1 ring-inset ring-zinc-700 hover:bg-zinc-800 focus:z-20 focus:outline-offset-0 disabled:opacity-50"
            >
              <span className="sr-only">Anterior</span>
              <ChevronLeft className="h-5 w-5" aria-hidden="true" />
            </button>
            
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(page => page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1)
              .map((page, index, array) => {
                if (index > 0 && page - array[index - 1] > 1) {
                  return (
                    <React.Fragment key={`ellipsis-${page}`}>
                      <span className="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-zinc-500 ring-1 ring-inset ring-zinc-700 focus:outline-offset-0">
                        ...
                      </span>
                      <button
                        onClick={() => onPageChange(page)}
                        className={`relative inline-flex items-center px-4 py-2 text-sm font-semibold ${currentPage === page ? 'z-10 bg-emerald-600 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600' : 'text-zinc-300 ring-1 ring-inset ring-zinc-700 hover:bg-zinc-800'} focus:z-20 focus:outline-offset-0`}
                      >
                        {page}
                      </button>
                    </React.Fragment>
                  );
                }
                return (
                  <button
                    key={page}
                    onClick={() => onPageChange(page)}
                    className={`relative inline-flex items-center px-4 py-2 text-sm font-semibold ${currentPage === page ? 'z-10 bg-emerald-600 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600' : 'text-zinc-300 ring-1 ring-inset ring-zinc-700 hover:bg-zinc-800'} focus:z-20 focus:outline-offset-0`}
                  >
                    {page}
                  </button>
                );
              })}

            <button
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage === totalPages || totalPages === 0}
              className="relative inline-flex items-center rounded-r-md px-2 py-2 text-zinc-400 ring-1 ring-inset ring-zinc-700 hover:bg-zinc-800 focus:z-20 focus:outline-offset-0 disabled:opacity-50"
            >
              <span className="sr-only">Próxima</span>
              <ChevronRight className="h-5 w-5" aria-hidden="true" />
            </button>
          </nav>
        </div>
      </div>
    </div>
  );
};

const Input = ({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) => (
  <div className="space-y-1.5 mb-4">
    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">{label}</label>
    <input
      {...props}
      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all outline-none"
    />
  </div>
);

const Select = ({ label, options, ...props }: { label: string, options: { value: string | number, label: string }[] } & React.SelectHTMLAttributes<HTMLSelectElement>) => (
  <div className="space-y-1.5 mb-4">
    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">{label}</label>
    <select
      {...props}
      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all outline-none"
    >
      <option value="">Selecione...</option>
      {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
    </select>
  </div>
);

const SidebarItem = ({ icon: Icon, label, active, onClick, badge }: { icon: any, label: string, active: boolean, onClick: () => void, badge?: number }) => (
  <button
    onClick={onClick}
    className={cn(
      "flex items-center w-full px-4 py-3 text-sm font-medium transition-colors rounded-lg mb-1 relative",
      active 
        ? "bg-emerald-600 text-white shadow-lg shadow-emerald-900/20" 
        : "text-zinc-400 hover:text-white hover:bg-zinc-800"
    )}
  >
    <Icon className="w-5 h-5 mr-3" />
    <span className="flex-1 text-left">{label}</span>
    {badge !== undefined && badge > 0 && (
      <span className="ml-auto bg-rose-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center shadow-sm">
        {badge}
      </span>
    )}
  </button>
);

const ExpandableFilters = ({ children, isOpen, onToggle }: { children: React.ReactNode, isOpen: boolean, onToggle: () => void }) => {
  return (
    <div className="relative z-20 bg-zinc-900/50 border border-zinc-800 rounded-xl transition-all duration-300 overflow-visible">
      <button 
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center justify-between text-zinc-400 hover:text-white transition-colors"
      >
        <div className="flex items-center">
          <Filter className="w-4 h-4 mr-2" />
          <span className="text-sm font-medium uppercase tracking-wider">Filtros</span>
        </div>
        {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      {isOpen && (
        <div className="px-4 pb-4 border-t border-zinc-800 pt-4 animate-in fade-in slide-in-from-top-2 duration-200 overflow-visible">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 overflow-visible">
            {children}
          </div>
        </div>
      )}
    </div>
  );
};

const Card = ({ title, children, className, ...props }: { title?: string, children: React.ReactNode, className?: string, [key: string]: any }) => (
  <div className={cn("bg-zinc-900 border border-zinc-800 rounded-xl flex flex-col overflow-visible", className)} {...props}>
    {title && (
      <div className="px-6 py-4 border-b border-zinc-800">
        <h3 className="text-lg font-semibold text-white">{title}</h3>
      </div>
    )}
    <div className="p-6 flex-1 flex flex-col">{children}</div>
  </div>
);

const StatCard = ({ title, value, subValue, icon: Icon, trend, trendValue, variant = 'primary' }: { title: string, value: string | number, subValue?: string, icon: any, trend?: 'up' | 'down', trendValue?: number, variant?: 'primary' | 'warning' | 'danger' }) => (
  <Card className="relative overflow-hidden group">
    <div className="flex justify-between items-start">
      <div>
        <p className="text-sm font-medium text-zinc-400 uppercase tracking-wider">{title}</p>
        <h3 className="mt-2 text-3xl font-bold text-white tracking-tight">{value}</h3>
        {subValue && <p className="mt-1 text-sm text-zinc-500">{subValue}</p>}
      </div>
      <div className={cn(
        "p-3 rounded-xl transition-colors",
        variant === 'primary' ? "bg-zinc-800 group-hover:bg-emerald-600/20" :
        variant === 'warning' ? "bg-amber-500/10 text-amber-500" :
        "bg-rose-500/10 text-rose-500"
      )}>
        <Icon className={cn(
          "w-6 h-6",
          variant === 'primary' ? "text-emerald-500" : ""
        )} />
      </div>
    </div>
    {trendValue !== undefined && (
      <div className={cn(
        "mt-4 flex items-center text-sm font-medium",
        trendValue >= 0 ? "text-rose-400" : "text-emerald-400"
      )}>
        {trendValue >= 0 ? <ArrowUpRight className="w-4 h-4 mr-1" /> : <ArrowDownRight className="w-4 h-4 mr-1" />}
        <span>{Math.abs(trendValue).toFixed(1)}% vs período anterior</span>
      </div>
    )}
  </Card>
);

// --- Views ---

const HelpersView = ({ 
  helpers, 
  searchQuery, 
  setSearchQuery, 
  onAdd, 
  onEdit, 
  onDelete, 
  onToggleStatus,
  branches,
  canCreate,
  canEdit,
  canDelete,
  canExport = true
}: { 
  helpers: Helper[], 
  searchQuery: string,
  setSearchQuery: (s: string) => void,
  onAdd: () => void, 
  onEdit: (h: Helper) => void,
  onDelete: (id: number) => void,
  onToggleStatus: (h: Helper) => void,
  branches: string[],
  canCreate?: boolean,
  canEdit?: boolean,
  canDelete?: boolean,
  canExport?: boolean
}) => {
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [branchFilter, setBranchFilter] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  const handleExport = async () => {
    try {
      const res = await fetchWithAuth('/api/helpers/export');
      if (res.ok) {
        const data = await res.json();
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Ajudantes");
        XLSX.writeFile(wb, "ajudantes_cadastro.xlsx");
      }
    } catch (e) {
      console.error(e);
      alert('Erro ao exportar dados.');
    }
  };

  const filteredHelpers = helpers.filter(h => {
    const matchesSearch = (h.name || '').toLowerCase().includes((searchQuery || '').toLowerCase()) || 
                         (h.cpf || '').toLowerCase().includes((searchQuery || '').toLowerCase());
    const matchesStatus = statusFilter.length === 0 || statusFilter.includes(h.status);
    const matchesBranch = branchFilter.length === 0 || branchFilter.includes(h.branch);
    
    return matchesSearch && matchesStatus && matchesBranch;
  });

  const totalPages = Math.ceil(filteredHelpers.length / itemsPerPage);
  const paginatedHelpers = filteredHelpers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h2 className="text-2xl font-bold text-white">Gestão de Ajudantes</h2>
        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 w-full md:w-64">
            <Search className="w-4 h-4 text-zinc-500 mr-2" />
            <input 
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por nome, CPF..."
              className="bg-transparent border-none text-sm text-white focus:ring-0 outline-none w-full"
            />
          </div>
          <div className="flex items-center gap-2">
            {canExport && (
              <button 
                onClick={handleExport}
                className="flex items-center px-4 py-2 bg-zinc-800 text-white rounded-lg hover:bg-zinc-700 transition-colors whitespace-nowrap"
                title="Exportar para Excel"
              >
                <Download className="w-5 h-5 mr-2" />
                Exportar
              </button>
            )}
            {canCreate && (
              <button 
                onClick={onAdd}
                className="flex items-center px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors whitespace-nowrap"
              >
                <Plus className="w-4 h-4 mr-2" />
                Novo Ajudante
              </button>
            )}
          </div>
        </div>
      </div>

      <ExpandableFilters isOpen={isFiltersOpen} onToggle={() => setIsFiltersOpen(!isFiltersOpen)}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-500 uppercase">Status</label>
            <MultiSelect
              options={[
                { id: 'Ativo', name: 'Ativo' },
                { id: 'Inativo', name: 'Inativo' }
              ]}
              selectedIds={statusFilter}
              onChange={setStatusFilter}
              placeholder="Todos Status"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-500 uppercase">Filial</label>
            <MultiSelect
              options={branches.map(b => ({ id: b, name: b }))}
              selectedIds={branchFilter}
              onChange={setBranchFilter}
              placeholder="Todas Filiais"
            />
          </div>
        </div>
      </ExpandableFilters>

      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="px-4 py-3 text-sm font-medium text-zinc-400 uppercase">Nome</th>
                <th className="px-4 py-3 text-sm font-medium text-zinc-400 uppercase">CPF</th>
                <th className="px-4 py-3 text-sm font-medium text-zinc-400 uppercase">Filial</th>
                <th className="px-4 py-3 text-sm font-medium text-zinc-400 uppercase">Status</th>
                <th className="px-4 py-3 text-sm font-medium text-zinc-400 uppercase text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {paginatedHelpers.map((h) => (
                <tr key={h.id} className="hover:bg-zinc-800/30 transition-colors group">
                  <td className="px-4 py-4">
                    <div className="flex items-center">
                      <div className="w-8 h-8 bg-zinc-800 rounded-full flex items-center justify-center mr-3 group-hover:bg-emerald-600/20 transition-colors">
                        <User className="w-4 h-4 text-zinc-400 group-hover:text-emerald-500" />
                      </div>
                      <span className="text-white font-medium">{h.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-zinc-400 text-sm">{h.cpf || '-'}</td>
                  <td className="px-4 py-4 text-zinc-400 text-sm">{h.branch || '-'}</td>
                  <td className="px-4 py-4">
                    {canEdit ? (
                      <button 
                        onClick={() => onToggleStatus(h)}
                        className={cn(
                          "px-2 py-1 text-xs font-medium rounded-full transition-colors",
                          h.status === 'Ativo' ? "bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20" : "bg-rose-500/10 text-rose-500 hover:bg-rose-500/20"
                        )}
                        title={h.status === 'Ativo' ? "Desativar" : "Ativar"}
                      >
                        {h.status}
                      </button>
                    ) : (
                      <span className={cn(
                        "px-2 py-1 text-xs font-medium rounded-full",
                        h.status === 'Ativo' ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"
                      )}>
                        {h.status}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-4 text-right">
                    <div className="flex items-center justify-end space-x-2">
                      {canEdit && (
                        <button 
                          onClick={() => onEdit(h)}
                          className="p-1.5 text-zinc-400 hover:text-emerald-500 transition-colors"
                          title="Editar"
                        >
                          <Settings className="w-4 h-4" />
                        </button>
                      )}
                      {canDelete && (
                        <button 
                          onClick={() => onDelete(h.id)}
                          className="p-1.5 text-zinc-400 hover:text-rose-500 transition-colors"
                          title="Excluir"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredHelpers.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-zinc-500 italic">
                    Nenhum ajudante encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
        itemsPerPage={itemsPerPage}
        onItemsPerPageChange={setItemsPerPage}
        totalItems={filteredHelpers.length}
      />
    </div>
  );
};

const SuppliersView = ({ 
  suppliers, 
  searchQuery, 
  setSearchQuery, 
  onAdd, 
  onEdit, 
  onDelete,
  onToggleStatus,
  canCreate,
  canEdit,
  canDelete,
  canExport = true
}: { 
  suppliers: Supplier[], 
  searchQuery: string,
  setSearchQuery: (s: string) => void,
  onAdd: () => void,
  onEdit: (s: Supplier) => void,
  onDelete: (id: number) => void,
  onToggleStatus: (s: Supplier) => void,
  canCreate?: boolean,
  canEdit?: boolean,
  canDelete?: boolean,
  canExport?: boolean
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  const handleExport = async () => {
    try {
      const res = await fetchWithAuth('/api/suppliers/export');
      if (res.ok) {
        const data = await res.json();
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Fornecedores");
        XLSX.writeFile(wb, "fornecedores_cadastro.xlsx");
      }
    } catch (e) {
      console.error(e);
      alert('Erro ao exportar dados.');
    }
  };

  const filteredSuppliers = suppliers.filter(s => 
    (s.name || '').toLowerCase().includes((searchQuery || '').toLowerCase()) ||
    (s.trade_name || '').toLowerCase().includes((searchQuery || '').toLowerCase()) ||
    String(s.cnpj || '').includes(searchQuery) ||
    (s.city || '').toLowerCase().includes((searchQuery || '').toLowerCase())
  );

  const totalPages = Math.ceil(filteredSuppliers.length / itemsPerPage);
  const paginatedSuppliers = filteredSuppliers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h2 className="text-2xl font-bold text-white">Fornecedores</h2>
        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 w-full md:w-64">
            <Search className="w-4 h-4 text-zinc-500 mr-2" />
            <input 
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar fornecedor..."
              className="bg-transparent border-none text-sm text-white focus:ring-0 outline-none w-full"
            />
          </div>
          <div className="flex items-center gap-2">
            {canExport && (
              <button 
                onClick={handleExport}
                className="flex items-center px-4 py-2 bg-zinc-800 text-white rounded-lg hover:bg-zinc-700 transition-colors whitespace-nowrap"
                title="Exportar para Excel"
              >
                <Download className="w-5 h-5 mr-2" />
                Exportar
              </button>
            )}
            {canCreate && (
              <button onClick={onAdd} className="flex items-center px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 transition-colors whitespace-nowrap">
                <Plus className="w-5 h-5 mr-2" />
                Novo Fornecedor
              </button>
            )}
          </div>
        </div>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="px-4 py-3 text-sm font-medium text-zinc-400 uppercase">Nome</th>
                <th className="px-4 py-3 text-sm font-medium text-zinc-400 uppercase">CNPJ</th>
                <th className="px-4 py-3 text-sm font-medium text-zinc-400 uppercase">Contato</th>
                <th className="px-4 py-3 text-sm font-medium text-zinc-400 uppercase">Localização</th>
                <th className="px-4 py-3 text-sm font-medium text-zinc-400 uppercase">Status</th>
                <th className="px-4 py-3 text-sm font-medium text-zinc-400 uppercase text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {paginatedSuppliers.map((s) => (
                <tr key={s.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                  <td className="px-4 py-4">
                    <div className="flex flex-col">
                      <p className="text-white font-bold">{s.trade_name || s.name}</p>
                      {s.trade_name && <p className="text-zinc-500 text-xs">{s.name}</p>}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-zinc-400 text-sm">{s.cnpj || '-'}</td>
                  <td className="px-4 py-4">
                    <div className="flex flex-col">
                      <span className="text-zinc-300 text-sm">{s.phone || '-'}</span>
                      <span className="text-zinc-500 text-xs">{s.email || '-'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-zinc-400 text-sm">
                    {s.city ? `${s.city} - ${s.state}` : '-'}
                  </td>
                  <td className="px-4 py-4">
                    {canEdit ? (
                      <button 
                        onClick={() => onToggleStatus(s)}
                        className={cn(
                          "px-2 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md transition-colors",
                          s.status === 'Ativo' ? "bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20" : "bg-zinc-800 text-zinc-500 hover:bg-zinc-700"
                        )}
                      >
                        {s.status}
                      </button>
                    ) : (
                      <span className={cn(
                        "px-2 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md",
                        s.status === 'Ativo' ? "bg-emerald-500/10 text-emerald-500" : "bg-zinc-800 text-zinc-500"
                      )}>
                        {s.status}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center justify-end space-x-2">
                      {canEdit && (
                        <button onClick={() => onEdit(s)} className="p-1 text-zinc-400 hover:text-white transition-colors">
                          <Settings className="w-4 h-4" />
                        </button>
                      )}
                      {canDelete && (
                        <button onClick={() => onDelete(s.id)} className="p-1 text-zinc-400 hover:text-rose-500 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {suppliers.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-zinc-500">Nenhum fornecedor cadastrado.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
        itemsPerPage={itemsPerPage}
        onItemsPerPageChange={setItemsPerPage}
        totalItems={filteredSuppliers.length}
      />
    </div>
  );
};

const DashboardView = ({ 
  stats, 
  period, 
  setPeriod, 
  vehicles, 
  models,
  fleetCategories,
  responsibleCompanies,
  plateQuery, 
  setPlateQuery,
  modelQuery,
  setModelQuery,
  fuelTypeQuery,
  setFuelTypeQuery,
  serviceQuery,
  setServiceQuery,
  fleetTypeQuery,
  setFleetTypeQuery,
  responsibleQuery,
  setResponsibleQuery,
  consumptionStatusFilter,
  setConsumptionStatusFilter,
  branchQuery,
  setBranchQuery,
  plans,
  maintenanceOrders,
  lastRefreshTime
}: { 
  stats: any, 
  period: number, 
  setPeriod: (p: number) => void,
  vehicles: Vehicle[],
  models: Model[],
  fleetCategories: FleetCategory[],
  responsibleCompanies: ResponsibleCompany[],
  plateQuery: string[], 
  setPlateQuery: (s: string[]) => void,
  modelQuery: string[],
  setModelQuery: (s: string[]) => void,
  fuelTypeQuery: string[],
  setFuelTypeQuery: (s: string[]) => void,
  serviceQuery: string[],
  setServiceQuery: (s: string[]) => void,
  fleetTypeQuery: string[],
  setFleetTypeQuery: (s: string[]) => void,
  responsibleQuery: string[],
  setResponsibleQuery: (s: string[]) => void,
  consumptionStatusFilter: string[],
  setConsumptionStatusFilter: (s: string[]) => void,
  branchQuery: string[],
  setBranchQuery: (s: string[]) => void,
  plans: MaintenancePlan[],
  maintenanceOrders: any[],
  lastRefreshTime: Date
}) => {
  const [activeTab, setActiveTab] = useState<'financial' | 'operational'>('financial');
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);

  useEffect(() => {
    if (stats) {
      console.log('[DASHBOARD] Stats recebidos:', stats);
    }
  }, [stats]);

  const data = stats?.costEvolution?.length > 0 ? stats.costEvolution : [
    { name: 'Sem dados', cost: 0 }
  ];

  const pieData = stats?.fuelDistribution?.length > 0 ? stats.fuelDistribution : [
    { name: 'Sem dados', value: 1 }
  ];

  const stationPriceData = stats?.stationPriceStats || [];

  const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6'];

  if (!stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-zinc-500 text-sm">Carregando estatísticas...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex flex-col space-y-1">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-white">Dashboard</h2>
            <span className="text-[10px] text-zinc-500 uppercase tracking-widest bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">
              Auto-refresh: {lastRefreshTime.toLocaleTimeString('pt-BR')}
            </span>
          </div>
          <div className="flex bg-zinc-900 p-1 rounded-lg border border-zinc-800">
            <button 
              onClick={() => setActiveTab('financial')}
              className={cn(
                "px-4 py-1.5 text-xs font-bold uppercase tracking-wider rounded-md transition-all",
                activeTab === 'financial' 
                  ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20" 
                  : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              Financeiro
            </button>
            <button 
              onClick={() => setActiveTab('operational')}
              className={cn(
                "px-4 py-1.5 text-xs font-bold uppercase tracking-wider rounded-md transition-all",
                activeTab === 'operational' 
                  ? "bg-blue-500 text-white shadow-lg shadow-blue-500/20" 
                  : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              Operacional
            </button>
          </div>
        </div>
        
        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5">
            <span className="text-xs font-medium text-zinc-500 uppercase mr-3">Período:</span>
            <select 
              value={period} 
              onChange={(e) => setPeriod(parseInt(e.target.value))}
              className="bg-transparent border-none text-sm text-emerald-500 focus:ring-0 outline-none cursor-pointer font-semibold"
            >
              <option value={7} className="bg-zinc-900 text-white">7 dias</option>
              <option value={15} className="bg-zinc-900 text-white">15 dias</option>
              <option value={30} className="bg-zinc-900 text-white">30 dias</option>
              <option value={90} className="bg-zinc-900 text-white">90 dias</option>
              <option value={180} className="bg-zinc-900 text-white">180 dias</option>
              <option value={365} className="bg-zinc-900 text-white">365 dias</option>
              <option value={9999} className="bg-zinc-900 text-white">Todo o Período</option>
            </select>
          </div>
          <button 
            onClick={() => setIsFiltersOpen(!isFiltersOpen)}
            className={cn(
              "p-2 rounded-lg border transition-all",
              isFiltersOpen 
                ? "bg-emerald-500/10 border-emerald-500/50 text-emerald-500" 
                : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white"
            )}
          >
            <Filter className="w-5 h-5" />
          </button>
        </div>
      </div>

      <ExpandableFilters isOpen={isFiltersOpen} onToggle={() => setIsFiltersOpen(!isFiltersOpen)}>
        <div className="space-y-1">
          <label className="text-xs font-medium text-zinc-500 uppercase">Tipo de Frota</label>
          <MultiSelect
            options={fleetCategories.map(cat => ({ id: cat.id.toString(), name: cat.name }))}
            selectedIds={fleetTypeQuery}
            onChange={setFleetTypeQuery}
            placeholder="Todos Tipos"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-zinc-500 uppercase">Combustível</label>
          <MultiSelect
            options={(stats?.availableFuelTypes || []).map((f: string) => ({ id: f, name: f }))}
            selectedIds={fuelTypeQuery}
            onChange={setFuelTypeQuery}
            placeholder="Todos Comb."
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-zinc-500 uppercase">Serviço</label>
          <MultiSelect
            options={(stats?.availableServices || []).map((s: string) => ({ id: s, name: s }))}
            selectedIds={serviceQuery}
            onChange={setServiceQuery}
            placeholder="Todos Serviços"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-zinc-500 uppercase">Placa</label>
          <MultiSelect
            options={vehicles.map(v => ({ id: v.plate, name: v.plate, category: `${v.brand_name} ${v.model_name}` }))}
            selectedIds={plateQuery}
            onChange={setPlateQuery}
            placeholder="Todas Placas"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-zinc-500 uppercase">Modelo</label>
          <MultiSelect
            options={models.map(m => ({ id: m.name, name: m.name, category: m.brand_name }))}
            selectedIds={modelQuery}
            onChange={setModelQuery}
            placeholder="Todos Modelos"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-zinc-500 uppercase">Responsável</label>
          <MultiSelect
            options={responsibleCompanies.map(rc => ({ id: rc.id.toString(), name: rc.name }))}
            selectedIds={responsibleQuery}
            onChange={setResponsibleQuery}
            placeholder="Todos Responsáveis"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-zinc-500 uppercase">Filial</label>
          <MultiSelect
            options={(stats?.branches || []).map((b: string) => ({ id: b, name: b }))}
            selectedIds={branchQuery}
            onChange={setBranchQuery}
            placeholder="Todas Filiais"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-zinc-500 uppercase">Status de Consumo</label>
          <MultiSelect
            options={[
              { id: 'no-alvo', name: 'No Alvo' },
              { id: 'abaixo', name: 'Abaixo da Meta' },
              { id: 'sem-meta', name: 'Sem Meta' }
            ]}
            selectedIds={consumptionStatusFilter}
            onChange={setConsumptionStatusFilter}
            placeholder="Todos Status"
          />
        </div>

        <div className="flex justify-end pt-2 border-t border-zinc-800 mt-2">
          <button 
            onClick={() => {
              setPlateQuery([]);
              setModelQuery([]);
              setFuelTypeQuery([]);
              setServiceQuery([]);
              setFleetTypeQuery([]);
              setBranchQuery([]);
              setConsumptionStatusFilter([]);
            }}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-zinc-400 hover:text-white transition-colors"
          >
            <XCircle className="w-4 h-4" />
            Limpar Filtros
          </button>
        </div>
      </ExpandableFilters>

      {activeTab === 'financial' ? (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Seção: Indicadores Financeiros */}
          <div className="mb-8">
            <div className="flex items-center space-x-2 mb-4">
              <div className="w-1 h-6 bg-emerald-500 rounded-full"></div>
              <h2 className="text-lg font-bold text-white uppercase tracking-wider">Indicadores Financeiros</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
              <StatCard 
                title="Custo Total" 
                value={formatCurrency(stats?.totalFuelCost || 0)} 
                subValue={period === 9999 ? "Todo o Período" : `Últimos ${period} dias`} 
                icon={Fuel} 
                trendValue={(stats?.totalFuelCost || 0) > 0 || (stats?.prevFuelCost || 0) > 0 ? stats?.fuelCostTrend : undefined}
              />
              <StatCard 
                title="Total de Abastecimentos" 
                value={stats?.totalRecords || 0} 
                subValue="Registros no período" 
                icon={ClipboardList} 
                trendValue={undefined}
              />
              <StatCard 
                title="Volume Total" 
                value={`${(stats?.totalLiters || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} L`} 
                subValue="Litros abastecidos" 
                icon={Droplets} 
                trendValue={undefined}
              />
              <StatCard 
                title="Preço Médio (R$/L)" 
                value={stats?.totalLiters && stats.totalLiters > 0 ? formatCurrency(stats.totalFuelCost / stats.totalLiters) : 'R$ 0,00'} 
                subValue="Média ponderada" 
                icon={DollarSign} 
                trendValue={undefined}
              />
              <StatCard 
                title="Posto Mais Barato" 
                value={stats?.cheapestStation?.avg_price ? formatCurrency(stats.cheapestStation.avg_price) : '-'} 
                subValue={stats?.cheapestStation?.station_name || 'Nenhum dado'} 
                icon={ArrowDownRight}
                trendValue={undefined}
              />
              <StatCard 
                title="Posto Mais Caro" 
                value={stats?.expensiveStation ? formatCurrency(stats.expensiveStation.avg_price) : '-'} 
                subValue={stats?.expensiveStation?.station_name || 'Nenhum dado'} 
                icon={ArrowUpRight}
                trendValue={undefined}
              />
            </div>

            <div className="mb-8">
              <Card title="Preço Médio por Posto (R$/L)">
                <div className="h-[400px] w-full min-w-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stationPriceData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                      <XAxis dataKey="station_name" stroke="#71717a" fontSize={10} tickLine={false} axisLine={false} />
                      <YAxis stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => formatCurrency(value)} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '8px' }}
                        itemStyle={{ color: '#fff' }}
                        formatter={(value: number) => [`R$ ${value.toFixed(3)}`, 'Preço Médio']}
                      />
                      <Bar dataKey="avg_price" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              <Card title="Gasto por Placa (R$)">
                <div className="h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                  <table className="w-full text-left">
                    <thead className="sticky top-0 bg-zinc-900 z-10">
                      <tr className="border-b border-zinc-800">
                        <th className="px-4 py-3 text-xs font-medium text-zinc-400 uppercase">Placa</th>
                        <th className="px-4 py-3 text-xs font-medium text-zinc-400 uppercase">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats?.costByVehicle?.map((item: any, i: number) => (
                        <tr key={i} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                          <td className="px-4 py-3 text-white font-medium text-xs">{item.plate}</td>
                          <td className="px-4 py-3 text-zinc-300 text-xs">{formatCurrency(item.total_cost)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>

              <Card title="Evolução de Custos (R$)">
                <div className="h-[400px] w-full min-w-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                      <XAxis dataKey="name" stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => formatCurrency(value)} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '8px' }}
                        itemStyle={{ color: '#fff' }}
                        formatter={(value: number) => [formatCurrency(value), 'Custo']}
                      />
                      <Bar dataKey="cost" fill="#10b981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card title="Gasto por Motorista (R$)">
                <div className="h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                  <table className="w-full text-left">
                    <thead className="sticky top-0 bg-zinc-900 z-10">
                      <tr className="border-b border-zinc-800">
                        <th className="px-4 py-3 text-xs font-medium text-zinc-400 uppercase">Motorista</th>
                        <th className="px-4 py-3 text-xs font-medium text-zinc-400 uppercase">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats?.costByDriver?.map((item: any, i: number) => (
                        <tr key={i} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                          <td className="px-4 py-3 text-white font-medium text-xs">{item.driver_name}</td>
                          <td className="px-4 py-3 text-zinc-300 text-xs">{formatCurrency(item.total_cost)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          </div>

          {/* Seção: Análise de Preços de Combustível */}
          <div className="mb-8">
            <div className="flex items-center space-x-2 mb-4">
              <div className="w-1 h-6 bg-amber-500 rounded-full"></div>
              <h2 className="text-lg font-bold text-white uppercase tracking-wider">Análise de Preços de Combustível</h2>
            </div>

            <div className="mb-8">
              <Card title="Evolução do Preço Médio (R$/L)">
                <div className="h-[400px] w-full min-w-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={(() => {
                      const trend = stats?.fuelPriceTrend?.reduce((acc: any[], curr: any) => {
                        const existing = acc.find(item => item.month === curr.month);
                        if (existing) {
                          existing[curr.fuel_type] = curr.avg_price;
                        } else {
                          acc.push({ month: curr.month, [curr.fuel_type]: curr.avg_price });
                        }
                        return acc;
                      }, []) || [];
                      return trend;
                    })()}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                      <XAxis dataKey="month" stroke="#71717a" fontSize={10} tickLine={false} axisLine={false} />
                      <YAxis stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} domain={['auto', 'auto']} tickFormatter={(value) => formatCurrency(value)} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '8px' }}
                        itemStyle={{ color: '#fff' }}
                        formatter={(value: number) => [`R$ ${value.toFixed(3)}`, 'Preço Médio']}
                      />
                      <Legend iconType="circle" />
                      {stats?.availableFuelTypes?.map((fuel: string, index: number) => (
                        <Line 
                          key={fuel} 
                          type="monotone" 
                          dataKey={fuel} 
                          stroke={['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'][index % 5]} 
                          strokeWidth={3}
                          dot={{ r: 4, strokeWidth: 2 }}
                          activeDot={{ r: 6, strokeWidth: 0 }}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
              <div className="lg:col-span-2">
                <Card title="Impacto Financeiro Potencial">
                  <div className="h-[400px] overflow-y-auto pr-2 custom-scrollbar space-y-6">
                    {stats?.availableFuelTypes?.map((fuel: string) => {
                      const fuelData = stats?.fuelPriceTrend?.filter((t: any) => t.fuel_type === fuel) || [];
                      if (fuelData.length < 2) return null;
                      
                      const latest = fuelData[fuelData.length - 1].avg_price;
                      const previous = fuelData[fuelData.length - 2].avg_price;
                      const variation = ((latest - previous) / previous) * 100;
                      
                      const fuelLiters = stats?.fuelDistribution?.find((d: any) => d.name === fuel)?.value || 0;
                      const potentialImpact = fuelLiters * (latest - previous);

                      return (
                        <div key={fuel} className="p-4 bg-zinc-900/50 rounded-xl border border-zinc-800">
                          <div className="flex justify-between items-start mb-2">
                            <span className="text-xs font-bold text-zinc-500 uppercase">{fuel}</span>
                            <span className={cn(
                              "text-xs font-bold px-2 py-0.5 rounded-full flex items-center",
                              variation > 0 ? "bg-rose-500/10 text-rose-500" : "bg-emerald-500/10 text-emerald-500"
                            )}>
                              {variation > 0 ? <ArrowUpRight className="w-3 h-3 mr-1" /> : <ArrowDownRight className="w-3 h-3 mr-1" />}
                              {Math.abs(variation).toFixed(2)}%
                            </span>
                          </div>
                          <div className="flex items-baseline space-x-2">
                            <span className="text-xl font-bold text-white">{formatCurrency(latest)}</span>
                            <span className="text-xs text-zinc-500">/ litro</span>
                          </div>
                          {variation > 0 && (
                            <div className="mt-3 pt-3 border-t border-zinc-800/50">
                              <p className="text-[10px] text-zinc-500 uppercase font-medium mb-1">Impacto no Custo Mensal</p>
                              <p className="text-sm font-bold text-rose-400">+{formatCurrency(potentialImpact)}</p>
                              <p className="text-[10px] text-zinc-600 mt-1 italic">Baseado no volume atual de {formatNumber(fuelLiters)}L</p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    
                    {(!stats?.fuelPriceTrend || stats.fuelPriceTrend.length < 2) && (
                      <div className="text-center py-8">
                        <Fuel className="w-12 h-12 text-zinc-800 mx-auto mb-3" />
                        <p className="text-sm text-zinc-500">Dados insuficientes para análise de tendência.</p>
                      </div>
                    )}
                  </div>
                </Card>
              </div>

              <div className="lg:col-span-1">
                <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-2xl p-6 h-full flex flex-col justify-center">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="p-2 bg-emerald-500/20 rounded-lg">
                      <BarChart3 className="w-5 h-5 text-emerald-500" />
                    </div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">Dica</h3>
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    A variação nos preços de combustível impacta diretamente a margem operacional. 
                    Recomendamos focar na otimização de rotas e na manutenção preventiva para compensar o aumento do custo por litro através da melhoria da eficiência (KM/L).
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Seção: Indicadores por Filial */}
          <div className="mb-8">
            <div className="flex items-center space-x-2 mb-4">
              <div className="w-1 h-6 bg-blue-500 rounded-full"></div>
              <h2 className="text-lg font-bold text-white uppercase tracking-wider">Indicadores por Filial</h2>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card title="Gasto Total por Filial (R$)">
                <div className="h-[300px] w-full min-w-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats?.branchStats || []} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} />
                      <XAxis type="number" stroke="#71717a" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(value) => `R$ ${value}`} />
                      <YAxis dataKey="branch" type="category" stroke="#71717a" fontSize={10} tickLine={false} axisLine={false} width={100} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '8px' }}
                        itemStyle={{ color: '#fff' }}
                        formatter={(value: number) => [formatCurrency(value), 'Gasto Total']}
                      />
                      <Bar dataKey="total_cost" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card title="Resumo Operacional por Filial">
                <div className="h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                  <table className="w-full text-left">
                    <thead className="sticky top-0 bg-zinc-900 z-10">
                      <tr className="border-b border-zinc-800">
                        <th className="px-4 py-3 text-xs font-medium text-zinc-400 uppercase">Filial</th>
                        <th className="px-4 py-3 text-xs font-medium text-zinc-400 uppercase">Abastecimentos</th>
                        <th className="px-4 py-3 text-xs font-medium text-zinc-400 uppercase">Litros</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats?.branchStats?.map((item: any, i: number) => (
                        <tr key={i} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                          <td className="px-4 py-3 text-white font-medium text-xs">{item.branch || 'Não Informada'}</td>
                          <td className="px-4 py-3 text-zinc-300 text-xs">{item.total_records}</td>
                          <td className="px-4 py-3 text-zinc-300 text-xs">{formatNumber(item.total_liters)} L</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          </div>
        </div>
      ) : (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-12">
          {/* Seção: Frota e Abastecimento */}
          <div className="space-y-8">
            <div className="flex items-center space-x-2 mb-6">
              <div className="w-1.5 h-6 bg-blue-500 rounded-full"></div>
              <h2 className="text-xl font-bold text-white uppercase tracking-wider">Frota e Abastecimento</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              <StatCard title="Total de Veículos" value={stats?.totalVehicles || 0} icon={Truck} />
              <StatCard 
                title="Litros Consumidos" 
                value={formatNumber(stats?.totalLiters || 0)} 
                subValue="Volume total" 
                icon={FileText} 
                trendValue={(stats?.totalLiters || 0) > 0 || (stats?.prevLiters || 0) > 0 ? stats?.litersTrend : undefined}
              />
              <StatCard title="Alertas do Sistema" value={stats?.alerts?.length || 0} subValue="Inconsistências e Prazos" icon={AlertTriangle} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card title="Alertas Inteligentes">
                <div className="h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                  <div className="space-y-4">
                    {stats?.alerts?.length > 0 ? (
                      stats.alerts.map((alert: any, i: number) => (
                        <div key={i} className={cn(
                          "p-3 rounded-lg border flex items-start space-x-3",
                          alert.severity === 'HIGH' ? "bg-rose-500/10 border-rose-500/20" : "bg-amber-500/10 border-amber-500/20"
                        )}>
                          <AlertTriangle className={cn(
                            "w-5 h-5 mt-0.5",
                            alert.severity === 'HIGH' ? "text-rose-500" : "text-amber-500"
                          )} />
                          <div>
                            <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">{alert.type}</p>
                            <p className="text-sm text-zinc-200 mt-0.5">{alert.message}</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8">
                        <div className="w-12 h-12 bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-3">
                          <FileText className="w-6 h-6 text-zinc-600" />
                        </div>
                        <p className="text-sm text-zinc-500">Nenhum alerta crítico no momento.</p>
                      </div>
                    )}
                  </div>
                </div>
              </Card>

              <Card title="Consumo Médio por Modelo (KM/L)">
                <div className="h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="sticky top-0 bg-zinc-900 z-10">
                        <tr className="border-b border-zinc-800">
                          <th className="px-4 py-3 text-sm font-medium text-zinc-400 uppercase">Modelo</th>
                          <th className="px-4 py-3 text-sm font-medium text-zinc-400 uppercase">KM/L</th>
                          <th className="px-4 py-3 text-sm font-medium text-zinc-400 uppercase">Meta</th>
                          <th className="px-4 py-3 text-sm font-medium text-zinc-400 uppercase">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stats?.modelConsumption?.map((item: any, i: number) => (
                          <tr key={i} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                            <td className="px-4 py-4 text-white font-medium text-xs">{item.model}</td>
                            <td className="px-4 py-4 text-zinc-300 text-xs">{item.kml.toFixed(2)} KM/L</td>
                            <td className="px-4 py-4 text-zinc-500 text-xs">{item.target_consumption > 0 ? `${item.target_consumption} KM/L` : '-'}</td>
                            <td className="px-4 py-4">
                              {item.target_consumption > 0 ? (
                                <div className={cn(
                                  "w-2 h-2 rounded-full",
                                  item.status === 'no-alvo' ? "bg-emerald-500" : "bg-rose-500"
                                )}></div>
                              ) : (
                                <div className="w-2 h-2 rounded-full bg-zinc-700"></div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </Card>

              <Card title="Consumo Médio por Veículo (KM/L)">
                <div className="h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="sticky top-0 bg-zinc-900 z-10">
                        <tr className="border-b border-zinc-800">
                          <th className="px-4 py-3 text-sm font-medium text-zinc-400 uppercase">Placa</th>
                          <th className="px-4 py-3 text-sm font-medium text-zinc-400 uppercase">Consumo Médio</th>
                          <th className="px-4 py-3 text-sm font-medium text-zinc-400 uppercase">Meta</th>
                          <th className="px-4 py-3 text-sm font-medium text-zinc-400 uppercase">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stats?.consumption?.map((item: any, i: number) => (
                          <tr key={i} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                            <td className="px-4 py-4 text-white font-medium">{item.plate}</td>
                            <td className="px-4 py-4 text-zinc-300">{item.kml.toFixed(2)} KM/L</td>
                            <td className="px-4 py-4 text-zinc-500 text-sm">{item.target_consumption > 0 ? `${item.target_consumption} KM/L` : '-'}</td>
                            <td className="px-4 py-4">
                              {item.target_consumption > 0 ? (
                                <span className={cn(
                                  "px-2 py-1 text-xs font-medium rounded-full",
                                  item.status === 'no-alvo' ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"
                                )}>
                                  {item.status === 'no-alvo' ? 'No Alvo' : 'Abaixo'}
                                </span>
                              ) : (
                                <span className={cn(
                                  "px-2 py-1 text-xs font-medium rounded-full bg-zinc-800 text-zinc-500"
                                )}>
                                  Sem Meta
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </Card>

              <Card title="Consumo por Motorista (KM/L)">
                <div className="h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                  <table className="w-full text-left">
                    <thead className="sticky top-0 bg-zinc-900 z-10">
                      <tr className="border-b border-zinc-800">
                        <th className="px-4 py-3 text-sm font-medium text-zinc-400 uppercase">Motorista</th>
                        <th className="px-4 py-3 text-sm font-medium text-zinc-400 uppercase">KM/L</th>
                        <th className="px-4 py-3 text-sm font-medium text-zinc-400 uppercase">Total KM</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats?.driverConsumption?.map((item: any, i: number) => (
                        <tr key={i} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                          <td className="px-4 py-4 text-white font-medium text-xs">{item.driver}</td>
                          <td className="px-4 py-4 text-zinc-300 text-xs">{item.kml.toFixed(2)} KM/L</td>
                          <td className="px-4 py-4 text-zinc-500 text-xs">{formatNumber(item.total_km)} KM</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          </div>

          {/* Seção: Manutenção */}
          <div className="space-y-8">
            <div className="flex items-center space-x-2 mb-6">
              <div className="w-1.5 h-6 bg-amber-500 rounded-full"></div>
              <h2 className="text-xl font-bold text-white uppercase tracking-wider">Manutenção Operacional</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <StatCard 
                title="Total Veículos" 
                value={vehicles.length} 
                icon={Truck} 
              />
              <StatCard 
                title="Em Manutenção" 
                value={maintenanceOrders.filter(o => o.status === 'Aberta').length} 
                subValue={`${vehicles.length > 0 ? ((maintenanceOrders.filter(o => o.status === 'Aberta').length / vehicles.length) * 100).toFixed(1) : 0}% do total`}
                icon={Wrench} 
                variant="warning"
              />
              <StatCard 
                title="Frota Própria" 
                value={(() => {
                  const openOrders = maintenanceOrders.filter(o => o.status === 'Aberta');
                  return openOrders.filter(o => {
                    const v = vehicles.find(v => v.id === o.vehicle_id);
                    return v?.fleet_category_name?.toLowerCase().includes('frota');
                  }).length;
                })()} 
                subValue={(() => {
                  const openOrders = maintenanceOrders.filter(o => o.status === 'Aberta');
                  const fleet = openOrders.filter(o => {
                    const v = vehicles.find(v => v.id === o.vehicle_id);
                    return v?.fleet_category_name?.toLowerCase().includes('frota');
                  }).length;
                  return openOrders.length > 0 ? `${((fleet / openOrders.length) * 100).toFixed(1)}% das O.S.` : '0% das O.S.';
                })()}
                icon={ShieldCheck} 
              />
              <StatCard 
                title="Agregados" 
                value={(() => {
                  const openOrders = maintenanceOrders.filter(o => o.status === 'Aberta');
                  return openOrders.filter(o => {
                    const v = vehicles.find(v => v.id === o.vehicle_id);
                    return v?.fleet_category_name?.toLowerCase().includes('agregado');
                  }).length;
                })()} 
                subValue={(() => {
                  const openOrders = maintenanceOrders.filter(o => o.status === 'Aberta');
                  const aggregates = openOrders.filter(o => {
                    const v = vehicles.find(v => v.id === o.vehicle_id);
                    return v?.fleet_category_name?.toLowerCase().includes('agregado');
                  }).length;
                  return openOrders.length > 0 ? `${((aggregates / openOrders.length) * 100).toFixed(1)}% das O.S.` : '0% das O.S.';
                })()}
                icon={Users} 
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              <StatCard 
                title="Manutenções Preventivas" 
                value={plans.filter(p => p.status !== 'VERDE').length} 
                subValue={`${plans.filter(p => p.status === 'VERMELHO').length} vencidas`} 
                icon={Wrench} 
                variant={plans.filter(p => p.status === 'VERMELHO').length > 0 ? 'danger' : 'warning'}
              />
            </div>

            <div className="grid grid-cols-1 gap-6">
              <Card title="Manutenções Críticas">
                <div className="h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                  <div className="space-y-3">
                    {plans.filter(p => p.status !== 'VERDE').length > 0 ? (
                      plans
                        .filter(p => p.status !== 'VERDE')
                        .sort((a, b) => (a.status === 'VERMELHO' ? -1 : 1))
                        .map((plan, i) => (
                          <div key={i} className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl flex items-center justify-between group hover:border-zinc-700 transition-colors">
                            <div className="flex items-center space-x-4">
                              <div className={cn(
                                "w-10 h-10 rounded-lg flex items-center justify-center",
                                plan.status === 'VERMELHO' ? "bg-rose-500/10 text-rose-500" : "bg-amber-500/10 text-amber-500"
                              )}>
                                <Wrench className="w-5 h-5" />
                              </div>
                              <div>
                                <p className="text-sm font-bold text-white">{plan.plate}</p>
                                <p className="text-xs text-zinc-500">{plan.type_name}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className={cn(
                                "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded",
                                plan.status === 'VERMELHO' ? "bg-rose-500/10 text-rose-500" : "bg-amber-500/10 text-amber-500"
                              )}>
                                {plan.status === 'VERMELHO' ? 'Vencido' : 'Atenção'}
                              </p>
                              <p className="text-[10px] text-zinc-400 mt-1 font-mono">
                                {plan.next_service_km ? (
                                  `${plan.status === 'VERMELHO' ? '-' : ''}${formatNumber(Math.abs(plan.next_service_km - plan.current_km))} KM`
                                ) : plan.next_service_date ? (
                                  formatDate(plan.next_service_date)
                                ) : '-'}
                              </p>
                            </div>
                          </div>
                        ))
                    ) : (
                      <div className="text-center py-12">
                        <CheckCircle2 className="w-12 h-12 text-emerald-500/20 mx-auto mb-3" />
                        <p className="text-sm text-zinc-500">Nenhuma manutenção crítica.</p>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const VehiclesView = ({ 
  vehicles, 
  searchQuery, 
  setSearchQuery, 
  onAdd, 
  onEdit, 
  onDelete, 
  onToggleStatus,
  brands,
  fleetCategories,
  responsibleCompanies,
  branches,
  canCreate,
  canEdit,
  canDelete,
  canExport = true,
  onRefresh
}: { 
  vehicles: Vehicle[], 
  searchQuery: string,
  setSearchQuery: (s: string) => void,
  onAdd: () => void, 
  onEdit: (v: Vehicle) => void,
  onDelete: (id: number) => void,
  onToggleStatus: (v: Vehicle) => void,
  brands: Brand[],
  fleetCategories: FleetCategory[],
  responsibleCompanies: ResponsibleCompany[],
  branches: string[],
  canCreate?: boolean,
  canEdit?: boolean,
  canDelete?: boolean,
  canExport?: boolean,
  onRefresh?: () => void
}) => {
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [brandFilter, setBrandFilter] = useState<string[]>([]);
  const [fleetFilter, setFleetFilter] = useState<string[]>([]);
  const [responsibleFilter, setResponsibleFilter] = useState<string[]>([]);
  const [branchFilter, setBranchFilter] = useState<string[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  const handleExport = async () => {
    try {
      const res = await fetchWithAuth('/api/fleet-vehicles/export');
      if (res.ok) {
        const data = await res.json();
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Veículos");
        XLSX.writeFile(wb, "veiculos_cadastro.xlsx");
      }
    } catch (e) {
      console.error(e);
      alert('Erro ao exportar dados.');
    }
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      setIsImporting(true);
      setImportResult(null);
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);

        const res = await fetchWithAuth('/api/fleet-vehicles/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });

        if (res.ok) {
          setImportResult({ imported: data.length, updated: 0, errors: [] });
          onRefresh?.();
        } else {
          const err = await res.json();
          setImportResult({ error: `Erro ao importar: ${err.error}` });
        }
      } catch (err) {
        console.error(err);
        setImportResult({ error: 'Erro ao processar o arquivo.' });
      } finally {
        setIsImporting(false);
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = ''; // Reset input
  };

  const filteredVehicles = vehicles.filter(v => {
    const cleanSearch = (searchQuery || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanPlate = (v.plate || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const matchesSearch = cleanPlate.includes(cleanSearch) || 
                         ((v.brand_name || '') + ' ' + (v.model_name || '')).toLowerCase().includes((searchQuery || '').toLowerCase());
    const matchesStatus = statusFilter.length === 0 || statusFilter.includes(v.status);
    const matchesBrand = brandFilter.length === 0 || brandFilter.includes(v.brand_id?.toString() || '');
    const matchesFleet = fleetFilter.length === 0 || fleetFilter.includes(v.fleet_category_id?.toString() || '');
    const matchesResponsible = responsibleFilter.length === 0 || responsibleFilter.includes(v.responsible_company_id?.toString() || '');
    const matchesBranch = branchFilter.length === 0 || branchFilter.includes(v.branch);
    
    return matchesSearch && matchesStatus && matchesBrand && matchesFleet && matchesResponsible && matchesBranch;
  });

  const totalPages = Math.ceil(filteredVehicles.length / itemsPerPage);
  const paginatedVehicles = filteredVehicles.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h2 className="text-2xl font-bold text-white">Frota de Veículos</h2>
        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 w-full md:w-64">
            <Search className="w-4 h-4 text-zinc-500 mr-2" />
            <input 
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por placa, modelo..."
              className="bg-transparent border-none text-sm text-white focus:ring-0 outline-none w-full"
            />
          </div>
          <div className="flex items-center gap-2">
            {canExport && (
              <button 
                onClick={handleExport}
                className="flex items-center px-4 py-2 bg-zinc-800 text-white rounded-lg hover:bg-zinc-700 transition-colors whitespace-nowrap"
                title="Exportar para Excel"
              >
                <Download className="w-5 h-5 mr-2" />
                Exportar
              </button>
            )}
            {canCreate && (
              <label className="flex items-center px-4 py-2 bg-zinc-800 text-white rounded-lg hover:bg-zinc-700 transition-colors cursor-pointer whitespace-nowrap" title="Importar de Excel">
                <Upload className="w-5 h-5 mr-2" />
                Importar
                <input type="file" className="hidden" accept=".xlsx, .xls, .csv" onChange={handleImport} />
              </label>
            )}
            {canCreate && (
              <button onClick={onAdd} className="flex items-center px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 transition-colors whitespace-nowrap">
                <Plus className="w-5 h-5 mr-2" />
                Novo Veículo
              </button>
            )}
          </div>
        </div>
      </div>

      <ExpandableFilters isOpen={isFiltersOpen} onToggle={() => setIsFiltersOpen(!isFiltersOpen)}>
        <div className="space-y-1">
          <label className="text-xs font-medium text-zinc-500 uppercase">Status</label>
          <MultiSelect
            options={[
              { id: 'Ativo', name: 'Ativo' },
              { id: 'Inativo', name: 'Inativo' },
              { id: 'Em Manutenção', name: 'Em Manutenção' }
            ]}
            selectedIds={statusFilter}
            onChange={setStatusFilter}
            placeholder="Todos Status"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-zinc-500 uppercase">Marca</label>
          <MultiSelect
            options={brands.map(b => ({ id: b.id.toString(), name: b.name }))}
            selectedIds={brandFilter}
            onChange={setBrandFilter}
            placeholder="Todas Marcas"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-zinc-500 uppercase">Frota</label>
          <MultiSelect
            options={fleetCategories.map(f => ({ id: f.id.toString(), name: f.name }))}
            selectedIds={fleetFilter}
            onChange={setFleetFilter}
            placeholder="Todas Frotas"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-zinc-500 uppercase">Responsável</label>
          <MultiSelect
            options={responsibleCompanies.map(rc => ({ id: rc.id.toString(), name: rc.name }))}
            selectedIds={responsibleFilter}
            onChange={setResponsibleFilter}
            placeholder="Todos Responsáveis"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-zinc-500 uppercase">Filial</label>
          <MultiSelect
            options={branches.map(b => ({ id: b, name: b }))}
            selectedIds={branchFilter}
            onChange={setBranchFilter}
            placeholder="Todas Filiais"
          />
        </div>
      </ExpandableFilters>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="px-4 py-3 text-sm font-medium text-zinc-400 uppercase">Placa</th>
                <th className="px-4 py-3 text-sm font-medium text-zinc-400 uppercase">Marca/Modelo</th>
                <th className="px-4 py-3 text-sm font-medium text-zinc-400 uppercase">Motorista</th>
                <th className="px-4 py-3 text-sm font-medium text-zinc-400 uppercase">Filial</th>
                <th className="px-4 py-3 text-sm font-medium text-zinc-400 uppercase">Frota</th>
                <th className="px-4 py-3 text-sm font-medium text-zinc-400 uppercase">Responsável</th>
                <th className="px-4 py-3 text-sm font-medium text-zinc-400 uppercase">Meta (KM/L)</th>
                <th className="px-4 py-3 text-sm font-medium text-zinc-400 uppercase">KM Atual</th>
                <th className="px-4 py-3 text-sm font-medium text-zinc-400 uppercase">Status</th>
                <th className="px-4 py-3 text-sm font-medium text-zinc-400 uppercase text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {paginatedVehicles.map((v) => (
              <tr key={v.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                <td className="px-4 py-4 text-white font-bold">
                  <div className="flex items-center gap-2">
                    {v.plate}
                    {v.notes && (
                      <div className="group relative">
                        <Info className="w-4 h-4 text-zinc-500 hover:text-emerald-500 transition-colors cursor-help" />
                        <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 w-64 p-2 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl text-xs text-zinc-300 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                          {v.notes}
                        </div>
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-4 py-4 text-zinc-300">{v.brand_name || '-'} {v.model_name || '-'}</td>
                <td className="px-4 py-4 text-zinc-400 text-sm">{v.driver_name || 'Não atribuído'}</td>
                <td className="px-4 py-4 text-zinc-400 text-sm">{v.branch || '-'}</td>
                <td className="px-4 py-4">
                  <span className={cn(
                    "px-2 py-1 text-[10px] font-bold rounded-md uppercase",
                    v.fleet_category_name === 'PROPRIA' || v.fleet_category_name === 'FROTA' ? "bg-blue-500/10 text-blue-500" : "bg-zinc-500/10 text-zinc-400"
                  )}>
                    {v.fleet_category_name || 'AGREGADO'}
                  </span>
                </td>
                <td className="px-4 py-4 text-zinc-400 text-sm">{v.responsible_company_name || '-'}</td>
                <td className="px-4 py-4 text-zinc-400 text-sm">{v.target_consumption ? `${v.target_consumption} KM/L` : '-'}</td>
                <td className="px-4 py-4 text-zinc-300">{formatNumber(v.current_km)} KM</td>
                <td className="px-4 py-4">
                  {canEdit ? (
                    <button 
                      onClick={() => onToggleStatus(v)}
                      className={cn(
                        "px-2 py-1 text-xs font-medium rounded-full transition-colors",
                        v.status === 'Ativo' ? "bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20" : 
                        v.status === 'Em Manutenção' ? "bg-amber-500/10 text-amber-500 hover:bg-amber-500/20" :
                        "bg-rose-500/10 text-rose-500 hover:bg-rose-500/20"
                      )}
                    >
                      {v.status}
                    </button>
                  ) : (
                    <span className={cn(
                      "px-2 py-1 text-xs font-medium rounded-full",
                      v.status === 'Ativo' ? "bg-emerald-500/10 text-emerald-500" : 
                      v.status === 'Em Manutenção' ? "bg-amber-500/10 text-amber-500" :
                      "bg-rose-500/10 text-rose-500"
                    )}>
                      {v.status}
                    </span>
                  )}
                </td>
                <td className="px-4 py-4">
                  <div className="flex items-center justify-end space-x-2">
                    {canEdit && (
                      <button 
                        onClick={() => onEdit(v)}
                        className="p-1.5 text-zinc-400 hover:text-emerald-500 transition-colors"
                      >
                        <Settings className="w-4 h-4" />
                      </button>
                    )}
                    {canDelete && (
                      <button 
                        onClick={() => onDelete(v.id)}
                        className="p-1.5 text-zinc-400 hover:text-rose-500 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
        itemsPerPage={itemsPerPage}
        onItemsPerPageChange={setItemsPerPage}
        totalItems={filteredVehicles.length}
      />
    </Card>

    {/* Import Status Modal */}
    <Modal 
      isOpen={isImporting || !!importResult} 
      onClose={() => !isImporting && setImportResult(null)} 
      title={isImporting ? "Processando Importação" : "Resultado da Importação"}
    >
      <div className="py-4">
        {isImporting ? (
          <div className="flex flex-col items-center justify-center space-y-4 py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500"></div>
            <p className="text-zinc-400 animate-pulse">Processando dados da planilha...</p>
            <p className="text-xs text-zinc-500">Isso pode levar alguns segundos dependendo do volume de dados.</p>
          </div>
        ) : importResult?.error ? (
          <div className="space-y-4">
            <div className="flex items-center space-x-3 text-rose-500 bg-rose-500/10 p-4 rounded-xl border border-rose-500/20">
              <AlertTriangle className="w-6 h-6 flex-shrink-0" />
              <p className="font-medium">{importResult.error}</p>
            </div>
            <button 
              onClick={() => setImportResult(null)}
              className="w-full py-3 bg-zinc-800 text-white font-bold rounded-xl hover:bg-zinc-700 transition-colors"
            >
              Fechar
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-center mb-6">
              <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-500" />
              </div>
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-xl font-bold text-white">Importação Concluída</h3>
              <p className="text-zinc-400">
                {importResult?.imported} registros importados com sucesso.
              </p>
              {importResult?.updated > 0 && (
                <p className="text-zinc-400">
                  {importResult?.updated} registros atualizados.
                </p>
              )}
            </div>
            <button 
              onClick={() => setImportResult(null)}
              className="w-full py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-500 transition-colors shadow-lg shadow-emerald-900/20"
            >
              Fechar
            </button>
          </div>
        )}
      </div>
    </Modal>
  </div>
);
};

const FuelImportView = ({ 
  onImport, 
  onReset,
  canCreate,
  canDelete,
  canExport,
  vehicles,
  branches,
  models
}: { 
  onImport: (data: any[]) => void, 
  onReset: () => void,
  canCreate?: boolean,
  canDelete?: boolean,
  canExport?: boolean,
  vehicles: Vehicle[],
  branches: string[],
  models: Model[]
}) => {
  const [latestRecords, setLatestRecords] = useState<any[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [showFilters, setShowFilters] = useState(true);
  
  // Filters
  const [startDate, setStartDate] = useState(getFirstDayOfMonth());
  const [endDate, setEndDate] = useState(getLocalISODate());
  const [plateFilter, setPlateFilter] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [modelFilter, setModelFilter] = useState('');

  const fetchLatest = async () => {
    try {
      const queryParams = new URLSearchParams();
      if (startDate) queryParams.append('startDate', startDate);
      if (endDate) queryParams.append('endDate', endDate);
      if (plateFilter) queryParams.append('plate', plateFilter);
      if (branchFilter) queryParams.append('branch', branchFilter);
      
      const res = await fetchWithAuth(`/api/fuel-records?${queryParams.toString()}`);
      console.log(`[FETCH LATEST] Status: ${res.status}, URL: ${res.url}`);
      if (res.ok) {
        const text = await res.text();
        try {
          const data = JSON.parse(text);
          if (Array.isArray(data)) {
            setLatestRecords(data);
            setCurrentPage(1); // Reset to first page on new search
          } else {
            console.error('[FETCH LATEST] API returned non-array data:', data);
            setLatestRecords([]);
            alert(`Erro ao buscar registros: ${data.error || 'Formato de dados inválido'}`);
          }
        } catch (parseErr) {
          console.error('[FETCH LATEST] Failed to parse JSON. Raw text:', text.substring(0, 200));
          throw parseErr;
        }
      } else {
        const errorData = await res.json().catch(() => ({ error: 'Resposta não é JSON' }));
        console.error('Erro ao buscar registros recentes:', res.status, errorData);
      }
    } catch (e) {
      console.error('Erro na requisição de registros recentes:', e);
    }
  };

  useEffect(() => {
    fetchLatest();
  }, []); // Only fetch on mount

  // Client-side filtering for model, since it's not directly in the fuel_records table
  const filteredRecords = latestRecords.filter(r => {
    if (modelFilter) {
      const vehicle = vehicles.find(v => v.plate === r.vehicle_plate);
      if (!vehicle || vehicle.model_id?.toString() !== modelFilter) return false;
    }
    return true;
  });

  const handleExport = () => {
    const data = filteredRecords.map(r => ({
      'Data': formatDate(r.date),
      'Placa': r.vehicle_plate,
      'Modelo': r.model_name || vehicles.find(v => v.plate === r.vehicle_plate)?.model_name || '-',
      'KM': r.odometer,
      'Litros': r.liters,
      'Valor Total': r.total_cost,
      'Serviço': r.service || '-',
      'Filial': r.branch || '-',
      'Motorista': r.driver_name || '-',
      'Posto': r.station_name || '-'
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Abastecimentos");
    XLSX.writeFile(wb, `Relatorio_Abastecimentos_${getLocalISODate()}.xlsx`);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const arrayBuffer = evt.target?.result as ArrayBuffer;
        const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
        console.log('[IMPORT] Primeiras 10 linhas brutas do arquivo:', jsonData.slice(0, 10));

        if (jsonData.length === 0) {
          alert('Planilha vazia');
          return;
        }

        // Find the header row (sometimes there's junk at the top)
        let headerIndex = 0;
        for (let i = 0; i < Math.min(jsonData.length, 15); i++) {
          // Join the row to a single string to catch partial matches and unsplit CSVs
          const rowStr = jsonData[i].map(c => String(c || '').toUpperCase().replace(/\s+/g, '')).join('');
          if (rowStr.includes('PLACA') || rowStr.includes('VEICULO') || rowStr.includes('DATATRANSACAO') || rowStr.includes('NOMEESTABELECIMENTO') || rowStr.includes('LITROS') || rowStr.includes('HODOMETRO')) {
            headerIndex = i;
            console.log(`[IMPORT] Cabeçalho detectado na linha ${i + 1}`);
            break;
          }
        }

        let headers: string[] = [];
        let rows: any[][] = [];

        const firstRow = jsonData[headerIndex];
        // Check if it's a semicolon separated CSV that XLSX didn't split correctly
        const hasSemicolons = firstRow.some(h => String(h).includes(';'));
        
        if (hasSemicolons || (firstRow.length === 1 && String(firstRow[0]).includes(';'))) {
          // Re-parse the whole thing as semicolon separated
          const rawLines = XLSX.utils.sheet_to_csv(sheet, { FS: ';' }).split('\n');
          
          // Find header in CSV too
          let csvHeaderIndex = 0;
          for (let i = 0; i < Math.min(rawLines.length, 15); i++) {
            const line = rawLines[i].toUpperCase().replace(/\s+/g, '');
            if (line.includes('PLACA') || line.includes('VEICULO') || line.includes('NOMEESTABELECIMENTO') || line.includes('DATATRANSACAO') || line.includes('LITROS') || line.includes('HODOMETRO')) {
              csvHeaderIndex = i;
              break;
            }
          }
          
          headers = rawLines[csvHeaderIndex].split(';').map(h => h.trim().replace(/^"|"$/g, ''));
          rows = rawLines.slice(csvHeaderIndex + 1).map(line => line.split(';').map(v => v.trim().replace(/^"|"$/g, '')));
          console.log('[IMPORT] CSV detectado com separador ponto-e-vírgula');
        } else {
          headers = firstRow.map(h => String(h).trim());
          rows = jsonData.slice(headerIndex + 1);
          console.log('[IMPORT] Formato XLSX/CSV padrão detectado');
        }

        console.log('[IMPORT] Colunas encontradas:', headers);

        const parseNumber = (val: any) => {
          if (val === null || val === undefined || val === '') return 0;
          if (typeof val === 'number') return val;
          let s = String(val).replace('R$ ', '').trim();
          
          // If it has both dot and comma, it's definitely 1.234,56 format
          if (s.includes('.') && s.includes(',')) {
            s = s.replace(/\./g, '').replace(',', '.');
          } else if (s.includes(',')) {
            // If it only has comma, it's 1234,56 format
            s = s.replace(',', '.');
          }
          // If it only has dot, we assume it's decimal (1234.56) 
          // unless it's like X.YYY which is common for thousands in some exports
          // But for now, let's treat single dot as decimal to be safe with standard CSVs
          
          const n = parseFloat(s);
          return isNaN(n) ? 0 : n;
        };

        const normalizeName = (val: any) => {
          if (val === undefined || val === null || String(val).trim() === '') return 'NÃO INFORMADO';
          let s = String(val).trim().toUpperCase();
          if (s === 'PROPRIA') return 'FROTA';
          return s;
        };

        const mappedData = rows.map((row, rowIndex) => {
          const obj: any = {};
          headers.forEach((header, index) => {
            obj[header] = row[index];
          });

          // Support multiple column name variations (case-insensitive and accent-insensitive)
          const removeAccents = (str: string) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          const getVal = (keys: string[]) => {
            const lowerKeys = keys.map(k => removeAccents(k.toLowerCase().replace(/\s+/g, '')));
            
            // Create a normalized map of headers to their actual values
            const normalizedObj: Record<string, any> = {};
            for (const [header, val] of Object.entries(obj)) {
              const cleanHeader = removeAccents(header.replace(/^"|"$/g, '').toLowerCase().replace(/\s+/g, ''));
              // Only set if not already set, to preserve the first column if there are duplicates
              if (!(cleanHeader in normalizedObj)) {
                normalizedObj[cleanHeader] = val;
              }
            }

            // Check keys in order of priority
            for (const lowerKey of lowerKeys) {
              if (lowerKey in normalizedObj) {
                const val = normalizedObj[lowerKey];
                if (val !== undefined && val !== null && String(val).trim() !== '') {
                  return typeof val === 'string' ? val.replace(/^"|"$/g, '').trim() : val;
                }
              }
            }
            return undefined;
          };

          const rawId = getVal(['CODIGO TRANSACAO', 'ID', 'Transação', 'Código', 'ID TRANSACAO']);
          const transaction_id = (rawId !== undefined && rawId !== null && String(rawId).trim() !== '' && String(rawId).trim().toLowerCase() !== 'null') 
            ? String(rawId).trim() 
            : null;

          const plate = String(getVal(['PLACA', 'Placa', 'VEICULO', 'VEÍCULO', 'FROTA', 'EQUIPAMENTO', 'Equipamento', 'IDENTIFICAÇÃO', 'IDENTIFICACAO', 'PLACA VEICULO', 'PLACA DO VEICULO', 'PREFIXO']) || '').trim();
          const odometer = parseNumber(getVal(['HODOMETRO OU HORIMETRO', 'HODOMETRO', 'ODOMETRO', 'ODÔMETRO', 'HORIMETRO', 'HORÍMETRO', 'KM', 'Km', 'KM ATUAL', 'Km Atual', 'HODOMETRO ATUAL', 'HORIMETRO ATUAL', 'KM_ATUAL', 'HODOMETRO_ATUAL']));
          const date = parseExcelDate(getVal(['DATA TRANSACAO', 'DATA', 'Data', 'DATA EMISSÃO', 'DATA EMISSAO', 'DATA ABASTECIMENTO', 'DATA_ABASTECIMENTO', 'DATA DO ABASTECIMENTO', 'DATA_EMISSAO', 'DATA_TRANSACAO']));
          const liters = parseNumber(getVal(['LITROS', 'Litros', 'QTD', 'Qtd', 'Qtd.', 'VOLUME', 'Volume', 'QUANTIDADE', 'Quantidade', 'LITRAGEM', 'LITROS ABASTECIDOS', 'QTD_LITROS', 'QUANTIDADE_LITROS', 'VOLUME_ABASTECIDO']));
          const unit_price = parseNumber(getVal(['PRECO UNITARIO', 'PREÇO UNITÁRIO', 'VALOR UNITARIO', 'VALOR UNITÁRIO', 'PRECO_UNITARIO', 'VALOR_UNITARIO', 'PREÇO', 'PRECO', 'UNITÁRIO', 'UNITARIO', 'VALOR_UNIT', 'P. UNITARIO', 'P. UNITÁRIO']));
          let total_cost = parseNumber(getVal(['VALOR EMISSAO', 'VALOR', 'Total', 'Valor', 'VALOR TOTAL', 'Valor Total', 'TOTAL', 'CUSTO', 'VALOR ABASTECIDO', 'PRECO TOTAL', 'PREÇO TOTAL', 'VALOR_TOTAL', 'VALOR_ABASTECIDO', 'CUSTO_TOTAL', 'TOTAL_PAGO']));

          // Fallback calculation if total_cost is missing but we have liters and unit_price
          if ((!total_cost || total_cost === 0) && liters > 0 && unit_price > 0) {
            total_cost = liters * unit_price;
          }

          // If no transaction_id, generate a deterministic one to avoid collisions but allow updates if re-imported
          const fallbackId = !transaction_id ? `fallback-${plate}-${date}-${odometer}-${rowIndex}` : transaction_id;

          return {
            transaction_id: transaction_id || fallbackId,
            date,
            plate,
            fleet_type: normalizeName(getVal(['TIPO FROTA', 'FROTA', 'Tipo Frota'])),
            vehicle_brand: normalizeName(getVal(['NUMERO FROTA', 'MARCA VEICULO', 'MARCA', 'Marca'])),
            vehicle_model: normalizeName(getVal(['MODELO VEICULO', 'MODELO', 'Modelo'])),
            target_consumption: parseNumber(getVal(['INFORMACAO ADIDIONAL 1', 'META CONSUMO', 'META'])),
            driver: normalizeName(getVal(['NOME MOTORISTA', 'MOTORISTA', 'Motorista', 'NOME_MOTORISTA', 'CONDUTOR', 'Condutor', 'NOME DO MOTORISTA', 'NOME DO CONDUTOR'])),
            station: normalizeName(getVal(['NOME ESTABELECIMENTO', 'ESTABELECIMENTO', 'NOME_ESTABELECIMENTO', 'NOME DO ESTABELECIMENTO', 'POSTO', 'Estabelecimento', 'FORNECEDOR', 'Fornecedor', 'NOME DO POSTO', 'NOME FORNECEDOR', 'REDE', 'Rede', 'NOME FANTASIA', 'RAZAO SOCIAL', 'LOCAL', 'Local', 'NOME_POSTO', 'NOME_FORNECEDOR', 'POSTO_ABASTECIMENTO', 'NOME REDE', 'ESTABELECIMENTO FANTASIA', 'CREDENCIADO', 'NOME DO CREDENCIADO', 'PARCEIRO', 'EMPRESA', 'NOME DA EMPRESA', 'POSTO DE COMBUSTIVEL', 'NOME DO POSTO DE COMBUSTIVEL', 'REDE DE POSTOS'])),
            odometer,
            liters,
            total_cost,
            fuel_type: normalizeName(getVal(['TIPO COMBUSTIVEL', 'COMBUSTIVEL', 'Combustível', 'TIPO_COMBUSTIVEL', 'PRODUTO', 'Produto', 'DESCRIÇÃO PRODUTO', 'DESCRIÇÃO DO PRODUTO', 'ITEM', 'DESCRIÇÃO'])),
            service: normalizeName(getVal(['SERVICO', 'Servico', 'Serviço', 'SERVIÇO', 'SERVICOS', 'SERVIÇOS', 'TIPO SERVICO', 'TIPO SERVIÇO', 'DESCRIÇÃO', 'DESCRIÇÃO SERVIÇO', 'PRODUTO', 'ITEM', 'DESCRIÇÃO DO PRODUTO', 'TIPO_SERVICO', 'NOME_SERVICO'])),
            branch: normalizeName(getVal(['INFORMACAO ADIDIONAL 2', 'FILIAL', 'Filial'])),
            helper: normalizeName(getVal(['NOME AJUDANTE', 'AJUDANTE', 'Ajudante', 'AUXILIAR', 'Auxiliar']))
          };
        }).filter(row => row.plate && row.plate !== 'Total' && row.plate !== 'undefined' && row.plate !== '');

        console.log('[IMPORT] Dados mapeados para importação (primeiros 5):', JSON.stringify(mappedData.slice(0, 5), null, 2));
        console.log('[IMPORT] Total de registros mapeados:', mappedData.length);
        const servicesFound = Array.from(new Set(mappedData.map(d => d.service)));
        console.log('Serviços encontrados no arquivo:', servicesFound);

        // Check for duplicate transaction IDs in the file
        const ids = mappedData.map(d => d.transaction_id).filter(id => id && id !== '');
        const uniqueIds = new Set(ids);
        if (ids.length !== uniqueIds.size) {
          const idCounts: {[key: string]: number} = {};
          ids.forEach(id => { idCounts[id] = (idCounts[id] || 0) + 1; });
          const duplicates = Object.keys(idCounts).filter(id => idCounts[id] > 1);
          
          alert(`Atenção: Foram encontrados ${ids.length - uniqueIds.size} IDs de transação duplicados no arquivo. Isso fará com que registros com o mesmo ID sejam mesclados, resultando em menos registros no sistema do que na planilha.\n\nIDs duplicados: ${duplicates.slice(0, 5).join(', ')}${duplicates.length > 5 ? '...' : ''}`);
        }

        if (mappedData.length === 0) {
          alert('Nenhum dado válido encontrado na planilha. Verifique os nomes das colunas.');
          return;
        }

        await onImport(mappedData);
        fetchLatest();
      } catch (err) {
        console.error('Erro ao processar arquivo:', err);
        alert('Erro ao processar o arquivo. Certifique-se de que é um CSV ou XLSX válido.');
      }
    };
    
    reader.readAsArrayBuffer(file);
  };

  const totalPages = Math.ceil(filteredRecords.length / itemsPerPage);
  const paginatedRecords = filteredRecords.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-white">Importar Abastecimentos</h2>
        {canDelete && (
          <button 
            onClick={async () => {
              await onReset();
              fetchLatest();
            }}
            className="flex items-center px-4 py-2 bg-rose-600/10 text-rose-500 border border-rose-500/20 rounded-lg hover:bg-rose-600/20 transition-colors"
          >
            <Trash2 className="w-5 h-5 mr-2" />
            Resetar Registros
          </button>
        )}
      </div>
      <Card className="flex flex-col items-center justify-center py-12 border-dashed border-2 border-zinc-700">
        <Upload className="w-12 h-12 text-zinc-500 mb-4" />
        <p className="text-zinc-400 mb-4">Arraste sua planilha (.xlsx ou .csv) ou clique para selecionar</p>
        {canCreate ? (
          <>
            <input 
              type="file" 
              accept=".xlsx, .csv" 
              onChange={handleFileUpload}
              className="hidden" 
              id="file-upload" 
            />
            <label 
              htmlFor="file-upload"
              className="px-6 py-2 bg-zinc-800 text-white rounded-lg hover:bg-zinc-700 cursor-pointer transition-colors"
            >
              Selecionar Arquivo
            </label>
          </>
        ) : (
          <p className="text-zinc-500 text-sm italic">Você não tem permissão para importar dados.</p>
        )}
        <div className="mt-8 text-sm text-zinc-500 text-center max-w-md">
          <p className="font-bold mb-2">Formato Detectado:</p>
          <p>O sistema agora suporta o formato padrão de exportação com separador ponto-e-vírgula (;) e colunas como PLACA, HODOMETRO, LITROS, etc.</p>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="p-4 border-b border-zinc-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-zinc-900/50">
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-zinc-400" />
            <h3 className="font-bold text-white">Filtros do Relatório</h3>
          </div>
          <div className="flex items-center gap-2">
            {canExport && (
              <button 
                onClick={handleExport}
                className="flex items-center px-4 py-2 bg-zinc-800 text-zinc-300 rounded-lg hover:bg-zinc-700 transition-colors"
                title="Exportar dados filtrados"
              >
                <Download className="w-4 h-4 mr-2" />
                Exportar
              </button>
            )}
            <button 
              onClick={() => setShowFilters(!showFilters)} 
              className="p-2 text-zinc-400 hover:text-white transition-colors"
            >
              {showFilters ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {showFilters && (
          <div className="p-4 border-b border-zinc-800 bg-zinc-900/50">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <Input 
                type="date" 
                label="Data Inicial" 
                value={startDate} 
                onChange={e => setStartDate(e.target.value)} 
              />
              <Input 
                type="date" 
                label="Data Final" 
                value={endDate} 
                onChange={e => setEndDate(e.target.value)} 
              />
              <Input 
                label="Placa" 
                placeholder="Ex: ABC1234" 
                value={plateFilter} 
                onChange={e => setPlateFilter(e.target.value)} 
              />
              <Select 
                label="Filial" 
                value={branchFilter} 
                onChange={e => setBranchFilter(e.target.value)}
                options={[{ value: '', label: 'Todas as Filiais' }, ...branches.map(b => ({ value: b, label: b }))]}
              />
              <Select 
                label="Modelo" 
                value={modelFilter} 
                onChange={e => setModelFilter(e.target.value)}
                options={[{ value: '', label: 'Todos os Modelos' }, ...models.map(m => ({ value: m.id.toString(), label: m.name }))]}
              />
            </div>
            <div className="flex justify-end mt-4">
              <button 
                onClick={fetchLatest}
                className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors flex items-center"
              >
                <Search className="w-4 h-4 mr-2" />
                Pesquisar
              </button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="px-4 py-3 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Data</th>
                <th className="px-4 py-3 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Placa</th>
                <th className="px-4 py-3 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Modelo</th>
                <th className="px-4 py-3 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">KM</th>
                <th className="px-4 py-3 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Litros</th>
                <th className="px-4 py-3 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Valor</th>
                <th className="px-4 py-3 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Serviço</th>
                <th className="px-4 py-3 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Filial</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-zinc-500 text-sm">
                    Nenhum registro encontrado.
                  </td>
                </tr>
              ) : (
                paginatedRecords.map((r, i) => (
                  <tr key={i} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                    <td className="px-4 py-3 text-sm text-zinc-300">{formatDate(r.date)}</td>
                    <td className="px-4 py-3 text-sm font-mono text-emerald-500">{r.vehicle_plate}</td>
                    <td className="px-4 py-3 text-sm text-zinc-300">{r.model_name || vehicles.find(v => v.plate === r.vehicle_plate)?.model_name || '-'}</td>
                    <td className="px-4 py-3 text-sm text-zinc-300">{formatNumber(r.odometer)}</td>
                    <td className="px-4 py-3 text-sm text-zinc-300">{formatNumber(r.liters)}</td>
                    <td className="px-4 py-3 text-sm text-zinc-300">{formatCurrency(r.total_cost)}</td>
                    <td className="px-4 py-3 text-sm text-zinc-300">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        r.service === 'ABASTECIMENTO' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-zinc-800 text-zinc-400'
                      }`}>
                        {r.service || '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-300">{r.branch || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        <Pagination
          currentPage={currentPage}
          totalPages={Math.ceil(filteredRecords.length / itemsPerPage)}
          onPageChange={setCurrentPage}
          itemsPerPage={itemsPerPage}
          onItemsPerPageChange={setItemsPerPage}
          totalItems={filteredRecords.length}
        />
      </Card>
    </div>
  );
};

const MaintenancePlansView = ({ 
  plans, 
  searchQuery, 
  setSearchQuery, 
  onAdd, 
  onDelete, 
  suppliers, 
  responsibleCompanies,
  onOpenOrder,
  canCreate,
  canDelete,
  canExport,
  canViewActive = true,
  canViewHistory = true,
  canSearch = true
}: { 
  plans: MaintenancePlan[], 
  searchQuery: string,
  setSearchQuery: (s: string) => void,
  onAdd: () => void,
  onDelete: (id: number) => void,
  suppliers: Supplier[],
  responsibleCompanies: ResponsibleCompany[],
  onOpenOrder: (p: MaintenancePlan) => void,
  canCreate?: boolean,
  canDelete?: boolean,
  canExport?: boolean,
  canViewActive?: boolean,
  canViewHistory?: boolean,
  canSearch?: boolean
}) => {
  const [activeTab, setActiveTab] = useState<'plans' | 'history'>(canViewActive ? 'plans' : 'history');
  const [history, setHistory] = useState<any[]>([]);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const [responsibleFilter, setResponsibleFilter] = useState<string[]>([]);
  const [branchFilter, setBranchFilter] = useState<string[]>([]);
  const [supplierFilter, setSupplierFilter] = useState<string[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab]);

  const handleExportHistory = () => {
    const data = filteredHistory.map(h => {
      let description = h.notes || '-';
      
      if (h.comments && h.comments.length > 0) {
        const formattedComments = h.comments.map((c: any) => {
          const date = new Date(c.created_at).toLocaleString('pt-BR');
          return `${date} - ${c.user_name}: ${c.comment}`;
        }).join('\n\n');
        
        description = description !== '-' 
          ? `${description}\n\n--- ATUALIZAÇÕES ---\n\n${formattedComments}`
          : `--- ATUALIZAÇÕES ---\n\n${formattedComments}`;
      }

      return {
        'Registro': h.registration_number,
        'Filial': h.branch || '-',
        'Responsável': h.responsible_company_name || '-',
        'Data': formatDate(h.service_date),
        'Placa': h.plate,
        'Natureza': h.maintenance_nature || '-',
        'Serviço': h.type_name,
        'KM Execução': h.completed_km,
        'Custo': formatCurrency(h.cost),
        'Fornecedor': h.supplier_name || h.supplier || '-',
        'Observações': description
      };
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Histórico de Manutenções");
    XLSX.writeFile(wb, `Historico_Manutencao_${getLocalISODate()}.xlsx`);
  };

  useEffect(() => {
    if (activeTab === 'history' && canViewHistory) {
      fetchWithAuth('/api/maintenance/history')
        .then(res => res.json())
        .then(setHistory)
        .catch(console.error);
    }
  }, [activeTab, canViewHistory]);

  const filteredPlans = plans.filter(p => {
    const cleanSearch = (searchQuery || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanPlate = (p.plate || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const matchesSearch = cleanPlate.includes(cleanSearch) || 
                         (p.type_name || '').toLowerCase().includes((searchQuery || '').toLowerCase());
    const matchesStatus = statusFilter.length === 0 || statusFilter.includes(p.status);
    const matchesType = typeFilter.length === 0 || typeFilter.includes(p.type_name);
    const matchesResponsible = responsibleFilter.length === 0 || responsibleFilter.includes(p.responsible_company_id?.toString() || '');
    const matchesBranch = branchFilter.length === 0 || branchFilter.includes(p.branch);
    return matchesSearch && matchesStatus && matchesType && matchesResponsible && matchesBranch;
  }).sort((a, b) => {
    const priority: Record<string, number> = { 'VERMELHO': 0, 'AMARELO': 1, 'VERDE': 2 };
    const aPrio = priority[a.status] ?? 3;
    const bPrio = priority[b.status] ?? 3;
    return aPrio - bPrio;
  });

  const totalPagesPlans = Math.ceil(filteredPlans.length / itemsPerPage);
  const paginatedPlans = filteredPlans.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const filteredHistory = history.filter(h => {
    const matchesStatus = h.status === 'Fechada';
    const matchesSearch = (h.plate || '').toLowerCase().includes((searchQuery || '').toLowerCase()) || 
                         (h.type_name || '').toLowerCase().includes((searchQuery || '').toLowerCase()) ||
                         (h.supplier_name || h.supplier || '').toLowerCase().includes((searchQuery || '').toLowerCase()) ||
                         (h.registration_number || '').toLowerCase().includes((searchQuery || '').toLowerCase());
    const matchesType = typeFilter.length === 0 || typeFilter.includes(h.type_name);
    const matchesResponsible = responsibleFilter.length === 0 || responsibleFilter.includes(h.responsible_company_id?.toString() || '');
    const matchesBranch = branchFilter.length === 0 || branchFilter.includes(h.branch);
    const matchesSupplier = supplierFilter.length === 0 || supplierFilter.includes(String(h.supplier_id)) || supplierFilter.includes(h.supplier);
    
    let matchesDate = true;
    if (startDate || endDate) {
      const serviceDate = new Date(h.service_date).getTime();
      if (startDate) {
        const start = new Date(startDate).getTime();
        if (serviceDate < start) matchesDate = false;
      }
      if (endDate) {
        const end = new Date(endDate).getTime();
        const endDay = new Date(endDate);
        endDay.setHours(23, 59, 59, 999);
        if (serviceDate > endDay.getTime()) matchesDate = false;
      }
    }
    
    return matchesStatus && matchesSearch && matchesType && matchesResponsible && matchesBranch && matchesSupplier && matchesDate;
  });

  const totalPagesHistory = Math.ceil(filteredHistory.length / itemsPerPage);
  const paginatedHistory = filteredHistory.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const maintenanceTypes = Array.from(new Set([
    ...plans.map(p => p.type_name),
    ...history.map(h => h.type_name)
  ])).sort();

  const branches = Array.from(new Set([
    ...plans.map(p => p.branch),
    ...history.map(h => h.branch)
  ])).filter(Boolean).sort();

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex flex-col space-y-1">
          <h2 className="text-2xl font-bold text-white">Plano de Manutenção</h2>
          <div className="flex bg-zinc-900 p-1 rounded-lg border border-zinc-800">
            {canViewActive && (
              <button 
                onClick={() => setActiveTab('plans')}
                className={cn(
                  "px-4 py-1.5 text-xs font-bold uppercase tracking-wider rounded-md transition-all",
                  activeTab === 'plans' 
                    ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20" 
                    : "text-zinc-500 hover:text-zinc-300"
                )}
              >
                Planos Ativos
              </button>
            )}
            {canViewHistory && (
              <button 
                onClick={() => setActiveTab('history')}
                className={cn(
                  "px-4 py-1.5 text-xs font-bold uppercase tracking-wider rounded-md transition-all",
                  activeTab === 'history' 
                    ? "bg-blue-500 text-white shadow-lg shadow-blue-500/20" 
                    : "text-zinc-500 hover:text-zinc-300"
                )}
              >
                Histórico
              </button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-4 w-full md:w-auto">
          {canSearch && (
            <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 w-full md:w-64">
              <Search className="w-4 h-4 text-zinc-500 mr-2" />
              <input 
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por placa, tipo..."
                className="bg-transparent border-none text-sm text-white focus:ring-0 outline-none w-full"
              />
            </div>
          )}
          <div className="flex items-center gap-2">
            {activeTab === 'history' && canExport && (
              <button 
                onClick={handleExportHistory}
                className="flex items-center px-4 py-2 bg-zinc-800 text-zinc-300 rounded-lg hover:bg-zinc-700 transition-colors whitespace-nowrap"
              >
                <Download className="w-5 h-5 mr-2" />
                Exportar
              </button>
            )}
            {canCreate && (
              <button onClick={onAdd} className="flex items-center px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 transition-colors whitespace-nowrap">
                <Plus className="w-5 h-5 mr-2" />
                Novo Plano
              </button>
            )}
          </div>
        </div>
      </div>

      <ExpandableFilters isOpen={isFiltersOpen} onToggle={() => setIsFiltersOpen(!isFiltersOpen)}>
        {activeTab === 'plans' && (
          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-500 uppercase">Status</label>
            <MultiSelect
              options={[
                { id: 'VERDE', name: 'No Prazo' },
                { id: 'AMARELO', name: 'Próximo' },
                { id: 'VERMELHO', name: 'Vencido' }
              ]}
              selectedIds={statusFilter}
              onChange={setStatusFilter}
              placeholder="Todos Status"
            />
          </div>
        )}
        <div className="space-y-1">
          <label className="text-xs font-medium text-zinc-500 uppercase">Tipo de Manutenção</label>
          <MultiSelect
            options={maintenanceTypes.map(t => ({ id: t, name: t }))}
            selectedIds={typeFilter}
            onChange={setTypeFilter}
            placeholder="Todos Tipos"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-zinc-500 uppercase">Responsável</label>
          <MultiSelect
            options={responsibleCompanies.map(rc => ({ id: rc.id.toString(), name: rc.name }))}
            selectedIds={responsibleFilter}
            onChange={setResponsibleFilter}
            placeholder="Todos Responsáveis"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-zinc-500 uppercase">Filial</label>
          <MultiSelect
            options={branches.map(b => ({ id: b, name: b }))}
            selectedIds={branchFilter}
            onChange={setBranchFilter}
            placeholder="Todas Filiais"
          />
        </div>
        {activeTab === 'history' && (
          <>
            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-500 uppercase">Fornecedor</label>
              <MultiSelect
                options={suppliers.map(s => ({ id: s.id.toString(), name: s.trade_name || s.name }))}
                selectedIds={supplierFilter}
                onChange={setSupplierFilter}
                placeholder="Todos Fornecedores"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-500 uppercase">Data Inicial</label>
              <input 
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-emerald-500/20 outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-500 uppercase">Data Final</label>
              <input 
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-emerald-500/20 outline-none"
              />
            </div>
          </>
        )}
      </ExpandableFilters>

      {activeTab === 'plans' ? (
        <>
          <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="px-4 py-3 text-sm font-medium text-zinc-400 uppercase">Registro</th>
                  <th className="px-4 py-3 text-sm font-medium text-zinc-400 uppercase">Filial</th>
                  <th className="px-4 py-3 text-sm font-medium text-zinc-400 uppercase">Responsável</th>
                  <th className="px-4 py-3 text-sm font-medium text-zinc-400 uppercase">Veículo</th>
                  <th className="px-4 py-3 text-sm font-medium text-zinc-400 uppercase">Serviço</th>
                  <th className="px-4 py-3 text-sm font-medium text-zinc-400 uppercase">KM Atual</th>
                  <th className="px-4 py-3 text-sm font-medium text-zinc-400 uppercase">Próxima (KM)</th>
                  <th className="px-4 py-3 text-sm font-medium text-zinc-400 uppercase">Status</th>
                  <th className="px-4 py-3 text-sm font-medium text-zinc-400 uppercase text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {paginatedPlans.map((p) => (
                  <tr key={p.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                    <td className="px-4 py-4 text-zinc-500 font-mono text-xs">{p.registration_number}</td>
                    <td className="px-4 py-4 text-zinc-400 text-xs uppercase font-medium">{p.branch || '-'}</td>
                    <td className="px-4 py-4 text-zinc-400 text-xs uppercase font-medium">{p.responsible_company_name || '-'}</td>
                    <td className="px-4 py-4 text-white font-bold">{p.plate}</td>
                    <td className="px-4 py-4">
                      <div 
                        className="max-h-20 overflow-y-auto custom-scrollbar pr-2 flex flex-col gap-1"
                        title={p.type_name}
                      >
                        {p.type_name?.split(',').map((service: string, idx: number) => (
                          <span key={idx} className="text-xs text-zinc-300 bg-zinc-800/50 px-2 py-1 rounded border border-zinc-700/50 whitespace-normal break-words">
                            {service.trim()}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-zinc-400 text-sm">{formatNumber(p.current_km)} KM</td>
                    <td className="px-4 py-4 text-zinc-300">
                      <div className="flex flex-col">
                        <span>{formatNumber(p.next_service_km)} KM</span>
                        <span className={cn(
                          "text-xs",
                          (p.next_service_km - p.current_km) < 500 ? "text-rose-500 font-bold" : "text-zinc-500"
                        )}>
                          Faltam {formatNumber(p.next_service_km - p.current_km)} KM
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className={cn(
                        "px-2 py-1 text-xs font-medium rounded-full",
                        p.status === 'VERDE' ? "bg-emerald-500/10 text-emerald-500" : 
                        p.status === 'AMARELO' ? "bg-amber-500/10 text-amber-500" : "bg-rose-500/10 text-rose-500"
                      )}>
                        {p.status}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-end space-x-2">
                        {canCreate && (
                          <button 
                            onClick={() => !p.has_open_os && onOpenOrder(p)}
                            disabled={p.has_open_os > 0}
                            className={cn(
                              "px-3 py-1 text-xs font-bold rounded transition-colors border",
                              p.has_open_os > 0 
                                ? "bg-amber-500/10 border-amber-500/20 text-amber-500 cursor-default"
                                : "bg-emerald-600/10 hover:bg-emerald-600 text-emerald-500 hover:text-white border-emerald-500/20"
                            )}
                          >
                            {p.has_open_os > 0 ? 'OS ABERTA' : 'ABRIR OS'}
                          </button>
                        )}
                        {canDelete && (
                          <button 
                            onClick={() => onDelete(p.id)}
                            disabled={p.has_open_os > 0}
                            className={cn(
                              "p-1 transition-colors",
                              p.has_open_os > 0 
                                ? "text-zinc-600 cursor-not-allowed" 
                                : "text-zinc-400 hover:text-rose-500"
                            )}
                            title={p.has_open_os > 0 ? "Não é possível excluir com OS aberta. Exclua o card no Quadro primeiro." : "Excluir Plano"}
                          >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                  </tr>
                ))}
                {plans.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-zinc-500">Nenhum plano de manutenção cadastrado.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
        
        {canViewActive && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPagesPlans}
            onPageChange={setCurrentPage}
            itemsPerPage={itemsPerPage}
            onItemsPerPageChange={setItemsPerPage}
            totalItems={filteredPlans.length}
          />
        )}
      </>
    ) : (
      <>
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="px-4 py-3 text-sm font-medium text-zinc-400 uppercase">Registro</th>
                  <th className="px-4 py-3 text-sm font-medium text-zinc-400 uppercase">Filial</th>
                  <th className="px-4 py-3 text-sm font-medium text-zinc-400 uppercase">Responsável</th>
                  <th className="px-4 py-3 text-sm font-medium text-zinc-400 uppercase">Data</th>
                  <th className="px-4 py-3 text-sm font-medium text-zinc-400 uppercase">Veículo</th>
                  <th className="px-4 py-3 text-sm font-medium text-zinc-400 uppercase">Natureza</th>
                  <th className="px-4 py-3 text-sm font-medium text-zinc-400 uppercase">Serviço</th>
                  <th className="px-4 py-3 text-sm font-medium text-zinc-400 uppercase">KM Execução</th>
                  <th className="px-4 py-3 text-sm font-medium text-zinc-400 uppercase">Custo</th>
                  <th className="px-4 py-3 text-sm font-medium text-zinc-400 uppercase">Fornecedor</th>
                  <th className="px-4 py-3 text-sm font-medium text-zinc-400 uppercase">Observações</th>
                </tr>
              </thead>
              <tbody>
                {paginatedHistory.map((h) => (
                  <tr key={h.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                    <td className="px-4 py-4 text-zinc-500 font-mono text-xs">{h.registration_number}</td>
                    <td className="px-4 py-4 text-zinc-400 text-xs uppercase font-medium">{h.branch || '-'}</td>
                    <td className="px-4 py-4 text-zinc-400 text-xs uppercase font-medium">{h.responsible_company_name || '-'}</td>
                    <td className="px-4 py-4 text-zinc-400 text-sm">{formatDate(h.service_date)}</td>
                    <td className="px-4 py-4 text-white font-bold">{h.plate}</td>
                    <td className="px-4 py-4">
                      {h.maintenance_nature && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase ${
                          h.maintenance_nature === 'Preventiva' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' :
                          h.maintenance_nature === 'Corretiva' ? 'bg-red-500/10 text-red-500 border border-red-500/20' :
                          'bg-blue-500/10 text-blue-500 border border-blue-500/20'
                        }`}>
                          {h.maintenance_nature}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <div 
                        className="max-h-20 overflow-y-auto custom-scrollbar pr-2 flex flex-col gap-1"
                        title={h.type_name}
                      >
                        {h.type_name?.split(',').map((service: string, idx: number) => (
                          <span key={idx} className="text-xs text-zinc-300 bg-zinc-800/50 px-2 py-1 rounded border border-zinc-700/50 whitespace-normal break-words">
                            {service.trim()}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-zinc-400 text-sm">{formatNumber(h.completed_km)} KM</td>
                    <td className="px-4 py-4 text-emerald-500 font-medium">{formatCurrency(h.cost)}</td>
                    <td className="px-4 py-4 text-zinc-400 text-sm">{h.supplier_name || h.supplier || '-'}</td>
                    <td className="px-4 py-4 text-zinc-500 text-xs max-w-xs truncate" title={h.notes}>{h.notes || '-'}</td>
                  </tr>
                ))}
                {history.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-zinc-500">Nenhum histórico de manutenção encontrado.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {activeTab === 'history' && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPagesHistory}
            onPageChange={setCurrentPage}
            itemsPerPage={itemsPerPage}
            onItemsPerPageChange={setItemsPerPage}
            totalItems={filteredHistory.length}
          />
        )}
      </>
    )}
    </div>
  );
};

const FleetDocumentsView = ({ 
  vehicles, 
  drivers,
  documentTypes,
  fleetCategories,
  branches,
  onRefresh,
  canCreate,
  canEdit,
  canDelete
}: { 
  vehicles: Vehicle[], 
  drivers: Driver[],
  documentTypes: DocumentType[],
  fleetCategories: FleetCategory[],
  branches: string[],
  onRefresh?: () => void,
  canCreate?: boolean,
  canEdit?: boolean,
  canDelete?: boolean
}) => {
  const [activeTab, setActiveTab] = useState<'expiring' | 'vehicles' | 'drivers'>('expiring');

  useEffect(() => {
    setSelectedDocs([]);
  }, [activeTab]);

  const [expiringDocs, setExpiringDocs] = useState<FleetDocument[]>([]);
  const [vehicleDocs, setVehicleDocs] = useState<FleetDocument[]>([]);
  const [driverDocs, setDriverDocs] = useState<FleetDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState<Partial<FleetDocument> | null>(null);
  const [docEntityType, setDocEntityType] = useState<'vehicle' | 'driver'>('vehicle');
  const [deletingId, setDeletingId] = useState<number | string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDocType, setFilterDocType] = useState<string[]>([]);
  const [filterStatus, setFilterStatus] = useState<string[]>([]);
  const [filterFleetType, setFilterFleetType] = useState<string[]>([]);
  const [filterBranch, setFilterBranch] = useState<string[]>([]);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [selectedDocs, setSelectedDocs] = useState<FleetDocument[]>([]);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkExpirationDate, setBulkExpirationDate] = useState('');
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);

  const fetchDocs = async () => {
    setLoading(true);
    try {
      const [expRes, vehRes, driRes] = await Promise.all([
        fetchWithAuth('/api/fleet-documents/expiring'),
        fetchWithAuth('/api/fleet-documents/vehicles'),
        fetchWithAuth('/api/fleet-documents/drivers')
      ]);
      
      const expData = await expRes.json();
      const vehData = await vehRes.json();
      const driData = await driRes.json();

      setExpiringDocs(Array.isArray(expData) ? expData : []);
      setVehicleDocs(Array.isArray(vehData) ? vehData : []);
      setDriverDocs(Array.isArray(driData) ? driData : []);
    } catch (e) {
      console.error(e);
      setExpiringDocs([]);
      setVehicleDocs([]);
      setDriverDocs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocs();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const isCnh = editingDoc?.is_cnh === 1;
    const url = isCnh
      ? `/api/drivers/${editingDoc?.driver_id || editingDoc?.id}/cnh`
      : (docEntityType === 'vehicle' 
          ? `/api/fleet-documents/vehicles${editingDoc?.id ? `/${editingDoc.id}` : ''}`
          : `/api/fleet-documents/drivers${editingDoc?.id ? `/${editingDoc.id}` : ''}`);
    
    const method = (editingDoc?.id || isCnh) ? 'PUT' : 'POST';
    
    try {
      const res = await fetchWithAuth(url, {
        method,
        body: JSON.stringify(editingDoc)
      });
      if (res.ok) {
        setIsModalOpen(false);
        fetchDocs();
        onRefresh?.();
      } else {
        const err = await res.json();
        setError(`Erro: ${err.error}`);
        setTimeout(() => setError(null), 5000);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (doc: FleetDocument) => {
    const isCnh = doc.is_cnh === 1 || (typeof doc.id === 'string' && doc.id.startsWith('cnh-'));
    const driverId = typeof doc.id === 'string' && doc.id.startsWith('cnh-') ? doc.id.replace('cnh-', '') : (doc.driver_id || doc.id);
    const url = isCnh 
      ? `/api/drivers/${driverId}/cnh`
      : (doc.entity_type === 'vehicle' 
          ? `/api/fleet-documents/vehicles/${doc.id}`
          : `/api/fleet-documents/drivers/${doc.id}`);
    
    try {
      const res = await fetchWithAuth(url, { method: 'DELETE' });
      if (res.ok) {
        fetchDocs();
        onRefresh?.();
        setDeletingId(null);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleBulkUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedDocs.length === 0 || !bulkExpirationDate) return;

    setIsBulkUpdating(true);
    try {
      const res = await fetchWithAuth('/api/fleet-documents/bulk-update', {
        method: 'POST',
        body: JSON.stringify({
          updates: selectedDocs.map(doc => ({ id: doc.id, entity_type: doc.entity_type })),
          expiration_date: bulkExpirationDate
        })
      });

      if (res.ok) {
        setIsBulkModalOpen(false);
        setBulkExpirationDate('');
        setSelectedDocs([]);
        fetchDocs();
        onRefresh?.();
      } else {
        const err = await res.json();
        setError(`Erro na atualização em massa: ${err.error}`);
        setTimeout(() => setError(null), 5000);
      }
    } catch (e) {
      console.error(e);
      setError('Erro ao processar atualização em massa');
      setTimeout(() => setError(null), 5000);
    } finally {
      setIsBulkUpdating(false);
    }
  };

  const toggleSelectAll = (docs: FleetDocument[]) => {
    if (selectedDocs.length === docs.length && docs.length > 0) {
      setSelectedDocs([]);
    } else {
      setSelectedDocs(docs);
    }
  };

  const toggleSelectDoc = (doc: FleetDocument) => {
    const isSelected = !!selectedDocs.find(d => d.id === doc.id && d.entity_type === doc.entity_type);
    if (isSelected) {
      setSelectedDocs(selectedDocs.filter(d => !(d.id === doc.id && d.entity_type === doc.entity_type)));
    } else {
      setSelectedDocs([...selectedDocs, doc]);
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'VERMELHO': return 'bg-rose-500/10 text-rose-500 border-rose-500/20';
      case 'AMARELO': return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
      default: return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
    }
  };

  const handleExport = () => {
    const docsToExport = activeTab === 'expiring' ? expiringDocs : activeTab === 'vehicles' ? vehicleDocs : driverDocs;
    const filtered = filterDocs(docsToExport);
    
    const data = filtered.map(doc => ({
      'Status': Math.ceil(doc.days_until_expiration ?? 0) <= 0 ? 'VENCIDO' : Math.ceil(doc.days_until_expiration ?? 0) <= 15 ? 'VENCENDO' : 'OK',
      'Entidade': doc.entity_plate || doc.entity_name,
      'Tipo Entidade': doc.entity_type === 'vehicle' ? 'Veículo' : 'Motorista',
      'Documento': doc.type_name || doc.type,
      'Vencimento': formatDate(doc.expiration_date),
      'Dias Restantes': Math.ceil(doc.days_until_expiration ?? 0),
      'Observações': doc.notes || ''
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Documentos");
    XLSX.writeFile(wb, `Relatorio_Documentos_${getLocalISODate()}.xlsx`);
  };

  const filterDocs = (docs: FleetDocument[]) => {
    if (!Array.isArray(docs)) return [];
    return docs.filter(doc => {
      const days = Math.ceil(doc.days_until_expiration ?? 0);
      let status: 'VERDE' | 'AMARELO' | 'VERMELHO' = 'VERDE';
      if (days <= 0) status = 'VERMELHO';
      else if (days <= 15) status = 'AMARELO';

      const matchesSearch = (doc.entity_plate || doc.entity_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (doc.type_name || doc.type || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = filterDocType.length === 0 || filterDocType.includes(doc.document_type_id?.toString() || '');
      const matchesStatus = filterStatus.length === 0 || filterStatus.includes(status);
      const matchesFleetType = filterFleetType.length === 0 || filterFleetType.includes(doc.fleet_category_id?.toString() || '');
      const matchesBranch = filterBranch.length === 0 || filterBranch.includes(doc.branch || '');

      return matchesSearch && matchesType && matchesStatus && matchesFleetType && matchesBranch;
    });
  };

  const renderTable = (docs: FleetDocument[], type: 'vehicle' | 'driver' | 'expiring') => {
    const filteredDocs = filterDocs(docs);
    const totalPages = Math.ceil(filteredDocs.length / itemsPerPage);
    const paginatedDocs = filteredDocs.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    const allSelected = paginatedDocs.length > 0 && paginatedDocs.every(d => selectedDocs.find(sd => sd.id === d.id && sd.entity_type === d.entity_type));

    return (
      <div className="space-y-4">
        {selectedDocs.length > 0 && (
          <div className="flex items-center justify-between bg-emerald-600/10 border border-emerald-600/20 p-3 rounded-xl animate-in fade-in slide-in-from-top-2">
            <span className="text-sm text-emerald-500 font-medium">
              {selectedDocs.length} documento(s) selecionado(s)
            </span>
            <button
              onClick={() => setIsBulkModalOpen(true)}
              className="px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-500 transition-colors shadow-lg shadow-emerald-600/20"
            >
              Atualizar Vencimento em Massa
            </button>
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="px-4 py-3 w-10">
                  <input 
                    type="checkbox" 
                    checked={allSelected}
                    onChange={() => toggleSelectAll(paginatedDocs)}
                    className="w-4 h-4 rounded border-zinc-700 bg-zinc-800 text-emerald-600 focus:ring-emerald-600 focus:ring-offset-zinc-900"
                  />
                </th>
                <th className="px-4 py-3 text-sm font-medium text-zinc-400 uppercase">Status</th>
                <th className="px-4 py-3 text-sm font-medium text-zinc-400 uppercase">{type === 'driver' ? 'Motorista' : 'Veículo'}</th>
                <th className="px-4 py-3 text-sm font-medium text-zinc-400 uppercase">Documento</th>
                <th className="px-4 py-3 text-sm font-medium text-zinc-400 uppercase">Vencimento</th>
                <th className="px-4 py-3 text-sm font-medium text-zinc-400 uppercase">Dias Restantes</th>
                <th className="px-4 py-3 text-sm font-medium text-zinc-400 uppercase text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {paginatedDocs.map((doc) => {
              const days = Math.ceil(doc.days_until_expiration ?? 0);
              let status: 'VERDE' | 'AMARELO' | 'VERMELHO' = 'VERDE';
              if (days <= 0) status = 'VERMELHO';
              else if (days <= 15) status = 'AMARELO';

              const isSelected = !!selectedDocs.find(sd => sd.id === doc.id && sd.entity_type === doc.entity_type);

              return (
                <tr key={`${doc.id}-${doc.type}`} className={cn(
                  "border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors",
                  isSelected && "bg-emerald-600/5"
                )}>
                  <td className="px-4 py-4">
                    <input 
                      type="checkbox" 
                      checked={isSelected}
                      onChange={() => toggleSelectDoc(doc)}
                      className="w-4 h-4 rounded border-zinc-700 bg-zinc-800 text-emerald-600 focus:ring-emerald-600 focus:ring-offset-zinc-900"
                    />
                  </td>
                  <td className="px-4 py-4">
                    <span className={cn(
                      "px-2 py-1 text-[10px] font-bold rounded-full border uppercase",
                      getStatusColor(status)
                    )}>
                      {status}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex flex-col">
                      <span className="text-white font-bold">{doc.entity_plate || doc.entity_name}</span>
                      {type === 'expiring' && (
                        <span className="text-[10px] text-zinc-500 uppercase">{doc.entity_type === 'vehicle' ? 'Veículo' : 'Motorista'}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center space-x-2">
                      <span className="text-zinc-300 font-medium">{doc.type_name || doc.type}</span>
                      {doc.notes && (
                        <div className="group relative">
                          <Info className="w-3.5 h-3.5 text-zinc-500 hover:text-emerald-500 transition-colors cursor-help" />
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-zinc-900 border border-zinc-800 rounded-lg text-[10px] text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl">
                            {doc.notes}
                            <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-zinc-800" />
                          </div>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-zinc-400 text-sm">{formatDate(doc.expiration_date)}</td>
                  <td className="px-4 py-4">
                    <span className={cn(
                      "text-sm font-medium",
                      days <= 0 ? "text-rose-500" : days <= 15 ? "text-amber-500" : "text-zinc-400"
                    )}>
                      {days <= 0 ? 'Vencido' : `${days} dias`}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center justify-end space-x-2">
                      {deletingId === doc.id ? (
                        <div className="flex items-center justify-end space-x-2 animate-in fade-in slide-in-from-right-2">
                          <span className="text-[10px] text-zinc-500 uppercase">Excluir?</span>
                          <button 
                            onClick={() => handleDelete(doc)}
                            className="px-2 py-1 text-[10px] bg-rose-600 text-white rounded hover:bg-rose-500"
                          >
                            Sim
                          </button>
                          <button 
                            onClick={() => setDeletingId(null)}
                            className="px-2 py-1 text-[10px] text-zinc-400 hover:text-white"
                          >
                            Não
                          </button>
                        </div>
                      ) : (
                        <>
                          {canEdit && (
                            <button 
                              onClick={() => {
                                setDocEntityType(doc.entity_type as any || (type === 'driver' ? 'driver' : 'vehicle'));
                                setEditingDoc(doc);
                                setIsModalOpen(true);
                              }}
                              className="p-1.5 text-zinc-400 hover:text-white transition-colors"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                          )}
                          {canDelete && (
                            <button 
                              onClick={() => setDeletingId(doc.id)}
                              className="p-1.5 text-zinc-400 hover:text-rose-500 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {filteredDocs.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-zinc-500">Nenhum documento encontrado.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
        itemsPerPage={itemsPerPage}
        onItemsPerPageChange={setItemsPerPage}
        totalItems={filteredDocs.length}
      />
    </div>
  );
};

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Controle Documental</h2>
          <p className="text-zinc-500 text-sm">Gerencie vencimentos de IPVA, Licenciamento, CNH e outros documentos.</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full md:w-auto">
          <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 w-full md:w-64">
            <Search className="w-4 h-4 text-zinc-500 mr-2" />
            <input 
              type="text"
              placeholder="Buscar por placa ou nome..."
              className="bg-transparent border-none text-sm text-white focus:ring-0 outline-none w-full"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={handleExport}
              className="flex-1 sm:flex-none flex items-center justify-center px-4 py-2 bg-zinc-800 text-zinc-300 rounded-lg hover:bg-zinc-700 transition-colors whitespace-nowrap"
              title="Exportar Planilha"
            >
              <Download className="w-5 h-5 mr-2" />
              Exportar
            </button>

            {canCreate && (
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => {
                    setDocEntityType('vehicle');
                    setEditingDoc({ document_type_id: undefined, type: '', expiration_date: '', notes: '' });
                    setIsModalOpen(true);
                  }}
                  className="flex items-center px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 transition-colors whitespace-nowrap"
                >
                  <Plus className="w-5 h-5 mr-2" />
                  Doc. Veículo
                </button>
                <button 
                  onClick={() => {
                    setDocEntityType('driver');
                    setEditingDoc({ document_type_id: undefined, type: '', expiration_date: '', notes: '' });
                    setIsModalOpen(true);
                  }}
                  className="flex items-center px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 transition-colors whitespace-nowrap"
                >
                  <Plus className="w-5 h-5 mr-2" />
                  Doc. Motorista
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-500 px-4 py-3 rounded-xl text-sm animate-in fade-in slide-in-from-top-2">
          {error}
        </div>
      )}

      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div className="flex space-x-1 bg-zinc-900/50 p-1 rounded-xl border border-zinc-800 w-fit">
          <button
            onClick={() => setActiveTab('expiring')}
            className={cn(
              "px-4 py-2 text-sm font-medium rounded-lg transition-all",
              activeTab === 'expiring' ? "bg-emerald-600 text-white shadow-lg" : "text-zinc-400 hover:text-white hover:bg-zinc-800"
            )}
          >
            Próximos Vencimentos
            {expiringDocs.length > 0 && (
              <span className="ml-2 bg-rose-600 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                {expiringDocs.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('vehicles')}
            className={cn(
              "px-4 py-2 text-sm font-medium rounded-lg transition-all",
              activeTab === 'vehicles' ? "bg-emerald-600 text-white shadow-lg" : "text-zinc-400 hover:text-white hover:bg-zinc-800"
            )}
          >
            Documentos Veículos
          </button>
          <button
            onClick={() => setActiveTab('drivers')}
            className={cn(
              "px-4 py-2 text-sm font-medium rounded-lg transition-all",
              activeTab === 'drivers' ? "bg-emerald-600 text-white shadow-lg" : "text-zinc-400 hover:text-white hover:bg-zinc-800"
            )}
          >
            Documentos Motoristas
          </button>
        </div>
      </div>

      <ExpandableFilters isOpen={isFiltersOpen} onToggle={() => setIsFiltersOpen(!isFiltersOpen)}>
        <div className="space-y-1">
          <label className="text-xs font-medium text-zinc-500 uppercase">Tipo de Documento</label>
          <MultiSelect
            options={documentTypes
              .filter(dt => activeTab === 'expiring' ? true : activeTab === 'vehicles' ? dt.category === 'VEICULO' : dt.category === 'MOTORISTA')
              .map(dt => ({ id: dt.id.toString(), name: dt.name }))}
            selectedIds={filterDocType}
            onChange={setFilterDocType}
            placeholder="Todos os Tipos"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-zinc-500 uppercase">Status de Vencimento</label>
          <MultiSelect
            options={[
              { id: 'VERMELHO', name: 'Vencidos' },
              { id: 'AMARELO', name: 'Próximos (15 dias)' },
              { id: 'VERDE', name: 'OK' }
            ]}
            selectedIds={filterStatus}
            onChange={setFilterStatus}
            placeholder="Todos os Status"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-zinc-500 uppercase">Tipo de Frota</label>
          <MultiSelect
            options={fleetCategories.map(c => ({ id: c.id.toString(), name: c.name }))}
            selectedIds={filterFleetType}
            onChange={setFilterFleetType}
            placeholder="Todas as Frotas"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-zinc-500 uppercase">Filial</label>
          <MultiSelect
            options={branches.map(b => ({ id: b, name: b }))}
            selectedIds={filterBranch}
            onChange={setFilterBranch}
            placeholder="Todas as Filiais"
          />
        </div>
        <div className="flex items-end">
          <button 
            onClick={() => {
              setSearchTerm('');
              setFilterDocType([]);
              setFilterStatus([]);
              setFilterFleetType([]);
              setFilterBranch([]);
            }}
            className="text-xs text-zinc-500 hover:text-white transition-colors py-2"
          >
            Limpar Filtros
          </button>
        </div>
      </ExpandableFilters>

      <Card>
        {loading ? (
          <div className="p-8 text-center text-zinc-500">Carregando documentos...</div>
        ) : (
          <>
            {activeTab === 'expiring' && renderTable(expiringDocs, 'expiring')}
            {activeTab === 'vehicles' && renderTable(vehicleDocs, 'vehicle')}
            {activeTab === 'drivers' && renderTable(driverDocs, 'driver')}
          </>
        )}
      </Card>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={`${editingDoc?.id ? 'Editar' : 'Novo'} Documento de ${docEntityType === 'vehicle' ? 'Veículo' : 'Motorista'}`}
      >
        <form onSubmit={handleSave} className="space-y-4">
          {docEntityType === 'vehicle' ? (
            <Select 
              label="Veículo"
              required
              value={editingDoc?.vehicle_id || ''}
              onChange={(e) => setEditingDoc({ ...editingDoc, vehicle_id: Number(e.target.value) })}
              options={vehicles.map(v => ({ value: v.id, label: v.plate }))}
            />
          ) : (
            <Select 
              label="Motorista"
              required
              value={editingDoc?.driver_id || ''}
              onChange={(e) => setEditingDoc({ ...editingDoc, driver_id: Number(e.target.value) })}
              options={drivers.map(d => ({ value: d.id, label: d.name }))}
            />
          )}

          {!editingDoc?.is_cnh && (
            <Select 
              label="Tipo de Documento"
              required
              value={editingDoc?.document_type_id || ''}
              onChange={(e) => {
                const typeId = parseInt(e.target.value);
                const typeName = documentTypes.find(dt => dt.id === typeId)?.name || '';
                setEditingDoc({ ...editingDoc, document_type_id: typeId, type: typeName });
              }}
              options={documentTypes
                .filter(dt => dt.category === (docEntityType === 'vehicle' ? 'VEICULO' : 'MOTORISTA') && dt.status === 'Ativo')
                .map(dt => ({ value: dt.id, label: dt.name }))
              }
            />
          )}

          <Input 
            label="Data de Vencimento"
            type="date"
            required
            value={editingDoc?.expiration_date || ''}
            onChange={(e) => setEditingDoc({ ...editingDoc, expiration_date: e.target.value })}
          />

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Observações</label>
            <textarea 
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all outline-none min-h-[100px]"
              value={editingDoc?.notes || ''}
              onChange={(e) => setEditingDoc({ ...editingDoc, notes: e.target.value })}
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button 
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 text-zinc-400 hover:text-white transition-colors"
            >
              Cancelar
            </button>
            <button 
              type="submit"
              className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 transition-colors font-bold"
            >
              Salvar Documento
            </button>
          </div>
        </form>
      </Modal>

      {isBulkModalOpen && (
        <Modal 
          isOpen={isBulkModalOpen} 
          onClose={() => setIsBulkModalOpen(false)} 
          title="Atualização em Massa"
        >
          <form onSubmit={handleBulkUpdate} className="space-y-6">
            <div className="bg-emerald-600/10 border border-emerald-600/20 p-4 rounded-xl">
              <p className="text-sm text-emerald-500 font-medium">
                Você está atualizando a data de vencimento de {selectedDocs.length} documento(s) simultaneamente.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Nova Data de Vencimento</label>
              <input 
                type="date" 
                required
                value={bulkExpirationDate}
                onChange={(e) => setBulkExpirationDate(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              />
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <button 
                type="button"
                onClick={() => setIsBulkModalOpen(false)}
                className="px-4 py-2 text-zinc-400 hover:text-white transition-colors font-medium"
              >
                Cancelar
              </button>
              <button 
                type="submit"
                disabled={isBulkUpdating}
                className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 transition-colors font-bold disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                {isBulkUpdating ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Atualizando...
                  </>
                ) : 'Confirmar Atualização'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

const EntityDocumentsSection = ({ 
  entityId, 
  entityType,
  documentTypes,
  onRefresh,
  canCreate,
  canEdit,
  canDelete
}: { 
  entityId: number, 
  entityType: 'vehicle' | 'driver',
  documentTypes: DocumentType[],
  onRefresh?: () => void,
  canCreate?: boolean,
  canEdit?: boolean,
  canDelete?: boolean
}) => {
  const [docs, setDocs] = useState<FleetDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newDoc, setNewDoc] = useState<Partial<FleetDocument>>({ document_type_id: undefined, type: '', expiration_date: '', notes: '' });
  const [deletingId, setDeletingId] = useState<number | string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchDocs = async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth(`/api/fleet-documents/${entityType}s/${entityId}`);
      if (res.ok) {
        const data = await res.json();
        setDocs(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (entityId) fetchDocs();
  }, [entityId]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = `/api/fleet-documents/${entityType}s`;
    const payload = { ...newDoc, [`${entityType}_id`]: entityId };
    
    try {
      const res = await fetchWithAuth(url, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setIsAdding(false);
        setNewDoc({ document_type_id: undefined, type: '', expiration_date: '', notes: '' });
        fetchDocs();
        onRefresh?.();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (id: number | string) => {
    try {
      const isCnh = typeof id === 'string' && id.startsWith('cnh-');
      const url = isCnh 
        ? `/api/drivers/${id.replace('cnh-', '')}/cnh`
        : `/api/fleet-documents/${entityType}s/${id}`;
        
      const res = await fetchWithAuth(url, { method: 'DELETE' });
      if (res.ok) {
        fetchDocs();
        onRefresh?.();
        setDeletingId(null);
      } else {
        const err = await res.json();
        setError(`Erro: ${err.error}`);
        setTimeout(() => setError(null), 5000);
      }
    } catch (e) {
      console.error(e);
      setError('Erro ao excluir documento');
      setTimeout(() => setError(null), 5000);
    }
  };

  if (loading) return <div className="py-4 text-center text-zinc-500 text-sm">Carregando documentos...</div>;

  return (
    <div className="mt-8 pt-8 border-t border-zinc-800 space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center">
          <FileCheck className="w-4 h-4 mr-2 text-emerald-500" />
          Documentos e Vencimentos
        </h3>
        {!isAdding && canCreate && (
          <button 
            type="button"
            onClick={() => setIsAdding(true)}
            className="text-xs font-bold text-emerald-500 hover:text-emerald-400 transition-colors flex items-center"
          >
            <Plus className="w-3 h-3 mr-1" />
            Adicionar Documento
          </button>
        )}
      </div>

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-500 px-3 py-2 rounded-lg text-[10px] animate-in fade-in slide-in-from-top-2">
          {error}
        </div>
      )}

      {isAdding && (
        <div className="bg-zinc-900/50 p-4 rounded-xl border border-zinc-800 space-y-3 animate-in fade-in slide-in-from-top-2">
          <div className="grid grid-cols-2 gap-3">
            <Select 
              label="Tipo" 
              required 
              value={newDoc.document_type_id} 
              onChange={e => {
                const typeId = parseInt(e.target.value);
                const typeName = documentTypes.find(dt => dt.id === typeId)?.name || '';
                setNewDoc({...newDoc, document_type_id: typeId, type: typeName});
              }}
              options={documentTypes
                .filter(dt => dt.category === (entityType === 'vehicle' ? 'VEICULO' : 'MOTORISTA') && dt.status === 'Ativo')
                .map(dt => ({ value: dt.id, label: dt.name }))
              }
            />
            <Input 
              label="Vencimento" 
              type="date" 
              required 
              value={newDoc.expiration_date} 
              onChange={e => setNewDoc({...newDoc, expiration_date: e.target.value})}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-zinc-500 uppercase">Observações</label>
            <textarea 
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-emerald-500/50"
              value={newDoc.notes}
              onChange={e => setNewDoc({...newDoc, notes: e.target.value})}
            />
          </div>
          <div className="flex justify-end space-x-2">
            <button 
              type="button" 
              onClick={() => setIsAdding(false)}
              className="px-3 py-1.5 text-xs text-zinc-400 hover:text-white"
            >
              Cancelar
            </button>
            <button 
              type="button" 
              onClick={handleAdd}
              className="px-3 py-1.5 text-xs bg-emerald-600 text-white rounded-lg hover:bg-emerald-500"
            >
              Salvar
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {docs.map(doc => (
          <div key={doc.id} className="flex items-center justify-between p-3 bg-zinc-900/30 rounded-lg border border-zinc-800/50 group">
            <div className="flex items-center space-x-3">
              <div className={cn(
                "w-2 h-2 rounded-full",
                Math.ceil(doc.days_until_expiration ?? 0) <= 0 ? "bg-rose-500" : Math.ceil(doc.days_until_expiration ?? 0) <= 15 ? "bg-amber-500" : "bg-emerald-500"
              )} />
              <div>
                <p className="text-sm font-medium text-white">{doc.type_name || doc.type}</p>
                <p className="text-[10px] text-zinc-500 uppercase">Vence em {formatDate(doc.expiration_date)}</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <span className={cn(
                "text-[10px] font-bold px-1.5 py-0.5 rounded uppercase",
                Math.ceil(doc.days_until_expiration ?? 0) <= 0 ? "bg-rose-500/10 text-rose-500" : Math.ceil(doc.days_until_expiration ?? 0) <= 15 ? "bg-amber-500/10 text-amber-500" : "bg-emerald-500/10 text-emerald-500"
              )}>
                {Math.ceil(doc.days_until_expiration ?? 0) <= 0 ? 'Vencido' : `${Math.ceil(doc.days_until_expiration ?? 0)} dias`}
              </span>
              {canDelete && (
                <div className="flex items-center space-x-1">
                  {deletingId === doc.id ? (
                    <div className="flex items-center space-x-1 animate-in fade-in slide-in-from-right-1">
                      <button 
                        onClick={() => handleDelete(doc.id)}
                        className="text-[10px] bg-rose-600 text-white px-2 py-0.5 rounded hover:bg-rose-500"
                      >
                        Confirmar
                      </button>
                      <button 
                        onClick={() => setDeletingId(null)}
                        className="text-[10px] text-zinc-400 hover:text-white"
                      >
                        X
                      </button>
                    </div>
                  ) : (
                    <button 
                      type="button"
                      onClick={() => setDeletingId(doc.id)}
                      className="p-1 text-zinc-600 hover:text-rose-500 transition-colors opacity-40 group-hover:opacity-100"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
        {docs.length === 0 && !isAdding && (
          <p className="text-center py-4 text-xs text-zinc-600 italic">Nenhum documento cadastrado.</p>
        )}
      </div>
    </div>
  );
};

const MaintenanceBoardView = ({ 
  orders, 
  vehicles,
  onAdd, 
  onEdit, 
  onDelete,
  onCloseOrder,
  onImport,
  setSelectedOrderForAudit,
  responsibleCompanies,
  fleetCategories = [],
  suppliers = [],
  branches = [],
  canCreate,
  canEdit,
  canDelete,
  canImport = true,
  canExport = true,
  canDownloadTemplate = true,
  canSearch = true,
  handleDeleteComment,
  currentUser
}: { 
  orders: any[], 
  vehicles: Vehicle[],
  onAdd: () => void, 
  onEdit: (order: any) => void, 
  onDelete: (id: number) => void,
  onCloseOrder: (order: any) => void,
  onImport: (data: any[]) => void,
  setSelectedOrderForAudit: (order: any) => void,
  responsibleCompanies: ResponsibleCompany[],
  fleetCategories?: FleetCategory[],
  suppliers?: Supplier[],
  branches?: string[],
  canCreate?: boolean,
  canEdit?: boolean,
  canDelete?: boolean,
  canImport?: boolean,
  canExport?: boolean,
  canDownloadTemplate?: boolean,
  canSearch?: boolean,
  handleDeleteComment?: (id: number, onSuccess?: () => void) => void,
  currentUser?: any
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [responsibleFilter, setResponsibleFilter] = useState<string[]>([]);
  const [branchFilter, setBranchFilter] = useState<string[]>([]);
  const [fleetTypeFilter, setFleetTypeFilter] = useState<string[]>([]);
  const [natureFilter, setNatureFilter] = useState<string[]>([]);
  const [supplierFilter, setSupplierFilter] = useState<string[]>([]);

  const openOrders = orders
    .filter(o => o.status === 'Aberta')
    .filter(o => 
      (o.plate || '').toLowerCase().includes((searchQuery || '').toLowerCase()) ||
      (o.type_name || '').toLowerCase().includes((searchQuery || '').toLowerCase()) ||
      (o.driver_name || '').toLowerCase().includes((searchQuery || '').toLowerCase())
    )
    .filter(o => {
      const vehicle = vehicles.find(v => v.id === o.vehicle_id);
      const fleetCategory = o.fleet_category_name || vehicle?.fleet_category_name || 'Frota';
      const branch = o.branch || vehicle?.branch || 'S/ Filial';
      const nature = o.maintenance_nature || '';
      const responsibleId = o.responsible_company_id || vehicle?.responsible_company_id;

      const matchesResponsible = responsibleFilter.length === 0 || responsibleFilter.includes(responsibleId?.toString() || '');
      const matchesBranch = branchFilter.length === 0 || branchFilter.includes(branch);
      const matchesFleetType = fleetTypeFilter.length === 0 || fleetTypeFilter.includes(fleetCategory);
      const matchesNature = natureFilter.length === 0 || natureFilter.includes(nature);
      
      // Fornecedor filter: check ID, supplier_name, and supplier field
      const matchesSupplier = supplierFilter.length === 0 || 
        supplierFilter.includes(o.supplier_id?.toString() || '') ||
        supplierFilter.some(filterId => {
          const s = suppliers.find(sup => sup.id.toString() === filterId);
          if (!s) return false;
          return (o.supplier_name === s.name || o.supplier_name === s.trade_name || 
                  o.supplier === s.name || o.supplier === s.trade_name);
        });

      return matchesResponsible && matchesBranch && matchesFleetType && matchesNature && matchesSupplier;
    })
    .sort((a, b) => new Date(a.open_date).getTime() - new Date(b.open_date).getTime());

  // Calculate indicators
  const filteredVehicles = vehicles.filter(v => {
    const matchesBranch = branchFilter.length === 0 || branchFilter.includes(v.branch || 'S/ Filial');
    const matchesFleetType = fleetTypeFilter.length === 0 || fleetTypeFilter.includes(v.fleet_category_name || 'Frota');
    return matchesBranch && matchesFleetType;
  });
  const totalVehicles = filteredVehicles.length;
  const vehiclesInMaintenance = openOrders.length;
  
  const fleetInMaintenance = openOrders.filter(o => {
    const vehicle = vehicles.find(v => v.id === o.vehicle_id);
    const category = o.fleet_category_name || vehicle?.fleet_category_name || 'Frota';
    return category.toLowerCase().includes('frota');
  }).length;

  const aggregatesInMaintenance = openOrders.filter(o => {
    const vehicle = vehicles.find(v => v.id === o.vehicle_id);
    const category = o.fleet_category_name || vehicle?.fleet_category_name || 'Frota';
    return category.toLowerCase().includes('agregado');
  }).length;

  const maintenancePercentage = totalVehicles > 0 ? (vehiclesInMaintenance / totalVehicles) * 100 : 0;
  const fleetPercentage = vehiclesInMaintenance > 0 ? (fleetInMaintenance / vehiclesInMaintenance) * 100 : 0;
  const aggregatesPercentage = vehiclesInMaintenance > 0 ? (aggregatesInMaintenance / vehiclesInMaintenance) * 100 : 0;

  const calculateDuration = (openDate: string) => {
    try {
      const start = startOfDay(new Date(openDate));
      const now = startOfDay(new Date());
      const diffDays = Math.abs(differenceInDays(now, start));
      // We add 1 because if it entered today, it's already 1 day in maintenance (or 0 if they prefer, but usually it's 1)
      // Actually, let's stick to the difference. If it entered today, diff is 0.
      // The user's screenshot shows "14 dias" for March 26 to April 9.
      // April 9 - March 26 = 14. So diff is 14.
      return `${diffDays} ${diffDays === 1 ? 'dia' : 'dias'}`;
    } catch (e) {
      return '-';
    }
  };

  const handleExport = () => {
    const data = openOrders.map(o => {
      let description = o.notes || '-';
      
      if (o.comments && o.comments.length > 0) {
        const formattedComments = o.comments.map((c: any) => {
          const date = new Date(c.created_at).toLocaleString('pt-BR');
          return `${date} - ${c.user_name}: ${c.comment}`;
        }).join('\n\n');
        
        description = description !== '-' 
          ? `${description}\n\n--- ATUALIZAÇÕES ---\n\n${formattedComments}`
          : `--- ATUALIZAÇÕES ---\n\n${formattedComments}`;
      }

      return {
        'Placa': o.plate,
        'Filial': o.branch || '-',
        'Frota': (o.fleet_category_name || 'Frota').toUpperCase(),
        'Responsável': o.responsible_company_name || '-',
        'Motorista': o.driver_name || '-',
        'Serviço': o.type_name || 'Geral',
        'Fornecedor': o.supplier_name || o.supplier || '-',
        'Data de Entrada': formatDate(o.open_date),
        'Previsão de Saída': o.estimated_completion_date ? formatDate(o.estimated_completion_date) : 'Não definida',
        'Tempo Parado': calculateDuration(o.open_date),
        'Descrição': description
      };
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Manutenções Ativas");
    XLSX.writeFile(wb, `Quadro_Manutencao_${getLocalISODate()}.xlsx`);
  };

  const handleDownloadTemplate = () => {
    const template = [
      {
        'Placa': 'ABC1234',
        'Responsável': 'Empresa Responsável',
        'Motorista': 'Nome do Motorista',
        'Serviço': 'Troca de Óleo',
        'Fornecedor': 'Oficina Central',
        'Data de Entrada': '2026-03-12',
        'Previsão de Saída': '2026-03-15',
        'Descrição': 'Observações do caso'
      }
    ];
    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Modelo Importação");
    XLSX.writeFile(wb, "Modelo_Importacao_Manutencao.xlsx");
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const arrayBuffer = evt.target?.result as ArrayBuffer;
        const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(sheet);
        onImport(data);
      } catch (error) {
        console.error('Erro ao ler arquivo:', error);
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = ''; // Reset input
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex flex-col space-y-1">
          <h2 className="text-2xl font-bold text-white">Quadro de Manutenção</h2>
          <p className="text-sm text-zinc-500">Gestão de veículos em oficina</p>
        </div>
        <div className="flex items-center gap-4 w-full md:w-auto">
          {canSearch && (
            <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 w-full md:w-64">
              <Search className="w-4 h-4 text-zinc-500 mr-2" />
              <input 
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar placa, motorista..."
                className="bg-transparent border-none text-sm text-white focus:ring-0 outline-none w-full"
              />
            </div>
          )}
          <button 
            onClick={() => setIsFiltersOpen(!isFiltersOpen)}
            className={cn(
              "p-2 rounded-lg border transition-all",
              isFiltersOpen ? "bg-emerald-600 border-emerald-500 text-white" : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white"
            )}
          >
            <Filter className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            {canDownloadTemplate && (
              <button 
                onClick={handleDownloadTemplate}
                className="p-2 bg-zinc-900 text-zinc-400 hover:text-white rounded-lg border border-zinc-800 transition-colors"
                title="Baixar Modelo de Planilha"
              >
                <FileText className="w-5 h-5" />
              </button>
            )}
            {canImport && (
              <label className="p-2 bg-zinc-900 text-zinc-400 hover:text-white rounded-lg border border-zinc-800 transition-colors cursor-pointer" title="Importar Planilha">
                <Upload className="w-5 h-5" />
                <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleFileUpload} />
              </label>
            )}
            {canExport && (
              <button 
                onClick={handleExport}
                className="p-2 bg-zinc-900 text-zinc-400 hover:text-white rounded-lg border border-zinc-800 transition-colors"
                title="Exportar para Excel"
              >
                <FileSpreadsheet className="w-5 h-5" />
              </button>
            )}
            {canCreate && (
              <button 
                onClick={onAdd}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors font-medium shadow-lg shadow-emerald-900/20"
              >
                <Plus className="w-4 h-4" />
                Nova O.S.
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Indicators Section */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-zinc-900/50 border border-zinc-800 p-4 rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Total Veículos</span>
            <Truck className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white">{totalVehicles}</span>
            <span className="text-xs text-zinc-500">unidades</span>
          </div>
        </div>

        <div className="bg-zinc-900/50 border border-zinc-800 p-4 rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Em Manutenção</span>
            <div className="flex items-center gap-1">
              <span className="text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                {maintenancePercentage.toFixed(1)}%
              </span>
              <Wrench className="w-4 h-4 text-emerald-500" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white">{vehiclesInMaintenance}</span>
            <span className="text-xs text-zinc-500">veículos</span>
          </div>
        </div>

        <div className="bg-zinc-900/50 border border-zinc-800 p-4 rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Frota Própria</span>
            <div className="flex items-center gap-1">
              <span className="text-[10px] font-bold text-blue-500 bg-blue-500/10 px-1.5 py-0.5 rounded">
                {fleetPercentage.toFixed(1)}%
              </span>
              <ShieldCheck className="w-4 h-4 text-blue-500" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white">{fleetInMaintenance}</span>
            <span className="text-xs text-zinc-500">em oficina</span>
          </div>
        </div>

        <div className="bg-zinc-900/50 border border-zinc-800 p-4 rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Agregados</span>
            <div className="flex items-center gap-1">
              <span className="text-[10px] font-bold text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded">
                {aggregatesPercentage.toFixed(1)}%
              </span>
              <Users className="w-4 h-4 text-amber-500" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white">{aggregatesInMaintenance}</span>
            <span className="text-xs text-zinc-500">em oficina</span>
          </div>
        </div>
      </div>

      <ExpandableFilters isOpen={isFiltersOpen} onToggle={() => setIsFiltersOpen(!isFiltersOpen)}>
        <div className="space-y-1">
          <label className="text-xs font-medium text-zinc-500 uppercase">Filial</label>
          <MultiSelect
            options={branches.map(b => ({ id: b, name: b }))}
            selectedIds={branchFilter}
            onChange={setBranchFilter}
            placeholder="Todas Filiais"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-zinc-500 uppercase">Tipo de Frota</label>
          <MultiSelect
            options={fleetCategories.map(fc => ({ id: fc.name, name: fc.name }))}
            selectedIds={fleetTypeFilter}
            onChange={setFleetTypeFilter}
            placeholder="Todos Tipos"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-zinc-500 uppercase">Tipo Manutenção</label>
          <MultiSelect
            options={[
              { id: 'Preventiva', name: 'Preventiva' },
              { id: 'Corretiva', name: 'Corretiva' },
              { id: 'Preditiva', name: 'Preditiva' }
            ]}
            selectedIds={natureFilter}
            onChange={setNatureFilter}
            placeholder="Todas Naturezas"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-zinc-500 uppercase">Fornecedor</label>
          <MultiSelect
            options={suppliers.filter(s => {
              const hasOpenOrder = orders.some(o => 
                o.status === 'Aberta' && 
                (o.supplier_id?.toString() === s.id.toString() || o.supplier === s.trade_name || o.supplier === s.name || o.supplier_name === s.trade_name || o.supplier_name === s.name)
              );
              return hasOpenOrder;
            }).map(s => {
              const displayName = s.trade_name || s.name;
              return { 
                id: s.id.toString(), 
                name: displayName,
                category: s.trade_name && s.trade_name !== s.name ? s.name : undefined 
              };
            })}
            selectedIds={supplierFilter}
            onChange={setSupplierFilter}
            placeholder="Todos Fornecedores"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-zinc-500 uppercase">Responsável</label>
          <MultiSelect
            options={responsibleCompanies.map(rc => ({ id: rc.id.toString(), name: rc.name }))}
            selectedIds={responsibleFilter}
            onChange={setResponsibleFilter}
            placeholder="Todos Responsáveis"
          />
        </div>
      </ExpandableFilters>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {openOrders.map((order) => (
          <div key={order.id} className="flex flex-col h-full">
            <Card className="h-full relative group border-zinc-700 hover:border-emerald-500/50 transition-all flex flex-col overflow-hidden">
            <div className="flex justify-between items-start mb-4 gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-500 text-[10px] font-bold uppercase rounded inline-block">
                    Em Manutenção
                  </span>
                  <span className="text-[10px] font-mono text-zinc-500">{order.registration_number}</span>
                </div>
                <h3 className="text-xl font-bold text-white truncate">{order.plate}</h3>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <p className="text-xs text-zinc-500 uppercase font-medium whitespace-nowrap">{order.branch || (vehicles.find(v => v.id === order.vehicle_id)?.branch) || 'S/ Filial'}</p>
                  <span className="text-zinc-700">•</span>
                  <p className="text-xs text-zinc-500 uppercase font-medium whitespace-nowrap">{order.fleet_category_name || (vehicles.find(v => v.id === order.vehicle_id)?.fleet_category_name) || 'Frota'}</p>
                  <span className="text-zinc-700">•</span>
                  <p className="text-xs text-zinc-500 uppercase font-medium">{order.responsible_company_name || (vehicles.find(v => v.id === order.vehicle_id)?.responsible_company_name) || '-'}</p>
                  {order.maintenance_nature && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase whitespace-nowrap ${
                      order.maintenance_nature === 'Preventiva' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' :
                      order.maintenance_nature === 'Corretiva' ? 'bg-red-500/10 text-red-500 border border-red-500/20' :
                      'bg-blue-500/10 text-blue-500 border border-blue-500/20'
                    }`}>
                      {order.maintenance_nature}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex flex-col items-end shrink-0">
                {canDelete && (
                  <button 
                    onClick={() => onDelete(order.id)}
                    className="p-1 text-zinc-600 hover:text-red-500 transition-colors mb-2"
                    title="Excluir Registro"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                <div className="text-right">
                  <p className="text-xs font-bold text-zinc-400 uppercase">Tempo</p>
                  <p className="text-sm font-bold text-emerald-500">{calculateDuration(order.open_date)}</p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between mb-4 px-1">
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => {
                    // We'll implement showAuditLogs(order)
                    setSelectedOrderForAudit(order);
                  }}
                  className="p-1.5 bg-zinc-900 text-zinc-500 hover:text-emerald-500 rounded-lg border border-zinc-800 transition-colors"
                  title="Rastreabilidade / Histórico de Ações"
                >
                  <Info className="w-4 h-4" />
                </button>
                <div className="flex flex-col">
                  <span className="text-[10px] text-zinc-500 uppercase font-bold">Última Atualização</span>
                  <span className="text-[10px] text-zinc-400">{order.updated_at ? formatDistanceToNow(new Date(order.updated_at), { addSuffix: true, locale: ptBR }) : 'Sem atualizações'}</span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <MessageSquare className="w-3 h-3 text-zinc-500" />
                <span className="text-[10px] text-zinc-500 font-bold">{order.comments?.length || 0}</span>
              </div>
            </div>

            <div className="space-y-3 mb-6 flex-grow min-w-0">
              <div className="flex items-start text-sm min-w-0">
                <Users className="w-4 h-4 text-zinc-500 mr-2 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <span className="text-zinc-400 mr-2">Motorista:</span>
                  <span className="text-zinc-200 break-words">{order.driver_name || '-'}</span>
                </div>
              </div>
              <div className="flex items-start text-sm min-w-0">
                <Wrench className="w-4 h-4 text-zinc-500 mr-2 mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <span className="text-zinc-400 mr-2">Serviço:</span>
                  <div className="text-zinc-200 break-words line-clamp-2 text-xs mt-1" title={order.maintenance_types_names || order.type_name || 'Geral'}>
                    {order.maintenance_types_names || order.type_name || 'Geral'}
                  </div>
                </div>
              </div>
              <div className="flex items-start text-sm min-w-0">
                <Settings className="w-4 h-4 text-zinc-500 mr-2 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <span className="text-zinc-400 mr-2">Fornecedor:</span>
                  <span className="text-zinc-200 break-words">{order.supplier_name || order.supplier || '-'}</span>
                </div>
              </div>
              <div className="pt-2 border-t border-zinc-800">
                <p className="text-xs font-bold text-zinc-500 uppercase mb-2">Histórico de Atualizações</p>
                <div className="h-32 overflow-y-auto pr-1 space-y-2 custom-scrollbar">
                  {order.notes && (
                    <div className="bg-zinc-950/50 border border-zinc-900 rounded-lg p-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-bold text-emerald-500 uppercase">Abertura</span>
                        <span className="text-[8px] text-zinc-600">
                          {format(new Date(order.open_date), 'dd/MM HH:mm')}
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-400 break-words leading-relaxed">
                        {order.notes}
                      </p>
                    </div>
                  )}
                  {order.comments && order.comments.length > 0 ? (
                    order.comments.map((c: any) => (
                      <div key={c.id} className="bg-zinc-950/50 border border-zinc-900 rounded-lg p-2">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-bold text-emerald-500 uppercase">{c.user_name}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-[8px] text-zinc-600">
                              {format(new Date(c.created_at), 'dd/MM HH:mm')}
                            </span>
                            {currentUser?.is_admin === 1 && handleDeleteComment && (
                              <button 
                                onClick={() => handleDeleteComment(c.id)}
                                className="text-[8px] text-zinc-600 hover:text-rose-500 font-bold uppercase transition-colors"
                              >
                                Excluir
                              </button>
                            )}
                          </div>
                        </div>
                        <p className="text-[11px] text-zinc-400 break-words leading-relaxed">
                          {c.comment}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-zinc-600 italic py-2">Nenhuma atualização registrada.</p>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-auto">
              <div className="grid grid-cols-2 gap-3 pt-4 border-t border-zinc-800">
                <div className="bg-zinc-950 p-2 rounded-lg border border-zinc-800">
                  <p className="text-[10px] font-bold text-zinc-500 uppercase">Entrada</p>
                  <p className="text-xs text-zinc-300">{formatDate(order.open_date)}</p>
                </div>
                <div className="bg-zinc-950 p-2 rounded-lg border border-zinc-800">
                  <p className="text-[10px] font-bold text-zinc-500 uppercase">Previsão</p>
                  <p className="text-xs text-amber-500 font-bold">{order.estimated_completion_date ? formatDate(order.estimated_completion_date) : 'Não definida'}</p>
                </div>
              </div>

              <div className="flex space-x-2 mt-4">
                {canEdit && (
                  <button 
                    onClick={() => onEdit(order)}
                    className="flex-1 py-2 bg-zinc-800 text-zinc-300 rounded-lg hover:bg-zinc-700 transition-colors text-xs font-bold uppercase tracking-wider"
                  >
                    Atualizar
                  </button>
                )}
                {canEdit && (
                  <button 
                    onClick={() => onCloseOrder(order)}
                    className="flex-1 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 transition-colors text-xs font-bold uppercase tracking-wider"
                  >
                    Dar Baixa
                  </button>
                )}
              </div>
            </div>
          </Card>
          </div>
        ))}
        {openOrders.length === 0 && (
          <div className="col-span-full py-20 text-center bg-zinc-900/30 border border-dashed border-zinc-800 rounded-2xl">
            <Wrench className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-zinc-400">Nenhum caminhão em manutenção</h3>
            <p className="text-sm text-zinc-600 mt-1">Clique em "Entrada em Manutenção" para registrar.</p>
          </div>
        )}
      </div>
    </div>
  );
};

const MaintenancePlanModal = ({ 
  isOpen, 
  onClose, 
  onSave, 
  vehicles, 
  maintenanceTypes 
}: { 
  isOpen: boolean, 
  onClose: () => void, 
  onSave: (data: any) => void,
  vehicles: Vehicle[],
  maintenanceTypes: any[]
}) => {
  const [formData, setFormData] = useState({
    vehicleId: '',
    maintenanceTypeIds: [] as string[],
    lastServiceKm: '',
    nextServiceKm: '',
    maintenanceNature: 'Preventiva'
  });
  const [errors, setErrors] = useState<{[key: string]: string}>({});

  useEffect(() => {
    if (isOpen) {
      setFormData({
        vehicleId: '',
        maintenanceTypeIds: [],
        lastServiceKm: '',
        nextServiceKm: '',
        maintenanceNature: 'Preventiva'
      });
      setErrors({});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleServiceChange = (ids: string[]) => {
    const firstService = maintenanceTypes.find(t => t.id.toString() === ids[0]);
    setFormData(prev => ({ 
      ...prev, 
      maintenanceTypeIds: ids,
      maintenanceNature: firstService?.category || prev.maintenanceNature
    }));
    if (ids.length > 0) setErrors(prev => ({ ...prev, services: '' }));
  };

  const validate = () => {
    const newErrors: {[key: string]: string} = {};
    if (!formData.vehicleId) newErrors.vehicleId = 'Obrigatório';
    if (formData.maintenanceTypeIds.length === 0) newErrors.services = 'Selecione ao menos um serviço';
    if (!formData.lastServiceKm) newErrors.lastServiceKm = 'Obrigatório';
    if (!formData.nextServiceKm) newErrors.nextServiceKm = 'Obrigatório';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      onSave(formData);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Novo Plano de Manutenção">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1">
          <div className="flex justify-between items-center">
            <label className="text-xs font-bold text-zinc-500 uppercase">Veículo</label>
            <div className="flex items-center gap-2">
              {formData.vehicleId && (
                <span className="text-[10px] bg-emerald-500/10 text-emerald-500 px-1.5 py-0.5 rounded font-bold">
                  KM Atual: {formatNumber(vehicles.find(v => v.id.toString() === formData.vehicleId)?.current_km || 0)}
                </span>
              )}
              {errors.vehicleId && <span className="text-[10px] text-rose-500 font-bold uppercase">{errors.vehicleId}</span>}
            </div>
          </div>
          <select 
            value={formData.vehicleId}
            onChange={(e) => {
              setFormData({ ...formData, vehicleId: e.target.value });
              if (e.target.value) setErrors(prev => ({ ...prev, vehicleId: '' }));
            }}
            className={cn(
              "w-full bg-zinc-900 border rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-emerald-500/20 outline-none transition-colors",
              errors.vehicleId ? "border-rose-500/50" : "border-zinc-800"
            )}
          >
            <option value="">Selecione o veículo</option>
            {vehicles.map(v => (
              <option key={v.id} value={v.id}>{v.plate} - {v.model_name} ({v.branch || 'S/ Filial'})</option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold text-zinc-500 uppercase">Natureza da Manutenção</label>
          <div className="flex gap-2">
            {['Preventiva', 'Corretiva', 'Preditiva'].map(nature => (
              <button
                key={nature}
                type="button"
                onClick={() => setFormData({ ...formData, maintenanceNature: nature })}
                className={cn(
                  "flex-1 py-2 text-xs font-bold uppercase rounded-lg border transition-all",
                  formData.maintenanceNature === nature 
                    ? "bg-emerald-500/10 border-emerald-500 text-emerald-500" 
                    : "bg-zinc-900 border-zinc-800 text-zinc-500 hover:border-zinc-700"
                )}
              >
                {nature}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex justify-between items-center">
            <label className="text-xs font-bold text-zinc-500 uppercase">Serviços ({formData.maintenanceTypeIds.length} selecionados)</label>
            {errors.services && <span className="text-[10px] text-rose-500 font-bold uppercase">{errors.services}</span>}
          </div>
          <div className={cn(
            "rounded-lg border transition-colors",
            errors.services ? "border-rose-500/50" : "border-transparent"
          )}>
            <MultiSelect
              options={maintenanceTypes
                .filter(t => t.category === formData.maintenanceNature || formData.maintenanceTypeIds.includes(t.id.toString()))
                .map(t => ({ id: t.id.toString(), name: t.name, category: t.category, nature: t.category }))}
              selectedIds={formData.maintenanceTypeIds}
              onChange={handleServiceChange}
              placeholder="Buscar serviço..."
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <label className="text-xs font-bold text-zinc-500 uppercase">KM Última</label>
              {errors.lastServiceKm && <span className="text-[10px] text-rose-500 font-bold uppercase">{errors.lastServiceKm}</span>}
            </div>
            <input 
              type="number"
              value={formData.lastServiceKm}
              onChange={(e) => {
                setFormData({ ...formData, lastServiceKm: e.target.value });
                if (e.target.value) setErrors(prev => ({ ...prev, lastServiceKm: '' }));
              }}
              className={cn(
                "w-full bg-zinc-900 border rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-emerald-500/20 outline-none transition-colors",
                errors.lastServiceKm ? "border-rose-500/50" : "border-zinc-800"
              )}
            />
          </div>
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <label className="text-xs font-bold text-zinc-500 uppercase">KM Próxima</label>
              {errors.nextServiceKm && <span className="text-[10px] text-rose-500 font-bold uppercase">{errors.nextServiceKm}</span>}
            </div>
            <input 
              type="number"
              value={formData.nextServiceKm}
              onChange={(e) => {
                setFormData({ ...formData, nextServiceKm: e.target.value });
                if (e.target.value) setErrors(prev => ({ ...prev, nextServiceKm: '' }));
              }}
              className={cn(
                "w-full bg-zinc-900 border rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-emerald-500/20 outline-none transition-colors",
                errors.nextServiceKm ? "border-rose-500/50" : "border-zinc-800"
              )}
            />
          </div>
        </div>

        <button type="submit" className="w-full py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-500 transition-colors mt-4">
          Criar Plano(s)
        </button>
      </form>
    </Modal>
  );
};

// --- Audit Log Modal ---
function AuditLogModal({ isOpen, onClose, tableName, recordId, title }: { isOpen: boolean, onClose: () => void, tableName: string, recordId: number, title: string }) {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && recordId) {
      setLoading(true);
      fetchWithAuth(`/api/audit-logs/${tableName}/${recordId}`)
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) setLogs(data);
          setLoading(false);
        })
        .catch(err => {
          console.error(err);
          setLoading(false);
        });
    }
  }, [isOpen, tableName, recordId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl overflow-hidden"
      >
        <div className="p-6 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 rounded-xl">
              <Info className="w-5 h-5 text-emerald-500" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Rastreabilidade</h2>
              <p className="text-sm text-zinc-400">{title}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-xl transition-colors">
            <X className="w-6 h-6 text-zinc-400" />
          </button>
        </div>

        <div className="flex-grow overflow-y-auto p-6 space-y-4 custom-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin" />
              <p className="text-zinc-400 animate-pulse">Carregando histórico...</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-zinc-900 rounded-full flex items-center justify-center mx-auto mb-4 border border-zinc-800">
                <History className="w-8 h-8 text-zinc-600" />
              </div>
              <p className="text-zinc-500">Nenhum registro de auditoria encontrado.</p>
            </div>
          ) : (
            <div className="relative border-l-2 border-zinc-800 ml-3 pl-6 space-y-8 py-2">
              {logs.map((log, idx) => (
                <div key={log.id} className="relative">
                  <div className="absolute -left-[33px] top-1 w-4 h-4 rounded-full bg-zinc-950 border-2 border-emerald-500 z-10" />
                  <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 hover:border-zinc-700 transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                        log.action === 'CREATE' ? 'bg-emerald-500/10 text-emerald-500' :
                        log.action === 'UPDATE' ? 'bg-blue-500/10 text-blue-500' :
                        log.action === 'DELETE' ? 'bg-red-500/10 text-red-500' :
                        'bg-zinc-500/10 text-zinc-500'
                      }`}>
                        {log.action}
                      </span>
                      <span className="text-xs text-zinc-500 font-mono">
                        {format(new Date(log.created_at), 'dd/MM/yyyy HH:mm:ss')}
                      </span>
                    </div>
                    <p className="text-sm text-zinc-200 mb-1">
                      Ação realizada por <span className="font-bold text-white">{log.user_name}</span>
                    </p>
                    <p className="text-xs text-zinc-500">ID do Usuário: {log.user_id}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-6 border-t border-zinc-800 bg-zinc-900/50 flex justify-end">
          <button 
            onClick={onClose}
            className="px-6 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white font-bold rounded-xl transition-all"
          >
            Fechar
          </button>
        </div>
      </motion.div>
    </div>
  );
}

const MaintenanceEntryModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  vehicles, 
  drivers, 
  maintenanceTypes, 
  suppliers,
  editingOrder,
  orders = [],
  preSelectedVehicleId,
  preSelectedMaintenanceTypeIds,
  preSelectedPlanId,
  currentUser,
  fetchData,
  handleDeleteComment
}: { 
  isOpen: boolean, 
  onClose: () => void, 
  onConfirm: (data: any) => void,
  vehicles: Vehicle[],
  drivers: Driver[],
  maintenanceTypes: any[],
  suppliers: Supplier[],
  editingOrder?: any,
  orders?: any[],
  preSelectedVehicleId?: string,
  preSelectedMaintenanceTypeIds?: string | string[],
  preSelectedPlanId?: number,
  currentUser?: any,
  fetchData?: () => void,
  handleDeleteComment?: (id: number, onSuccess?: () => void) => void
}) => {
  const [formData, setFormData] = useState({
    vehicleId: '',
    maintenanceTypeIds: [] as string[],
    supplierId: '',
    supplier: '',
    openDate: getLocalISODate(),
    estimatedCompletionDate: '',
    notes: '',
    driverId: '',
    maintenanceNature: 'Preventiva',
    planIds: [] as number[]
  });
  const [errors, setErrors] = useState<{[key: string]: string}>({});
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [editingCommentId, setEditingCommentId] = useState<number | null>(null);
  const [editingCommentText, setEditingCommentText] = useState('');

  const fetchComments = async () => {
    if (!editingOrder) return;
    try {
      const res = await fetchWithAuth(`/api/maintenance/orders/${editingOrder.id}/comments`);
      const data = await res.json();
      if (res.ok) {
        if (Array.isArray(data)) setComments(data);
      } else {
        console.error('Erro detalhado ao buscar comentários:', data);
      }
    } catch (err) {
      console.error('Erro de rede ao buscar comentários:', err);
    }
  };

  useEffect(() => {
    if (isOpen && editingOrder) {
      fetchComments();
    } else {
      setComments([]);
      setNewComment('');
      setEditingCommentId(null);
    }
  }, [isOpen, editingOrder]);

  const handleAddComment = async () => {
    if (!newComment.trim() || !editingOrder) return;
    try {
      const res = await fetchWithAuth(`/api/maintenance/orders/${editingOrder.id}/comments`, {
        method: 'POST',
        body: JSON.stringify({ comment: newComment })
      });
      const data = await res.json();
      if (res.ok) {
        setNewComment('');
        fetchComments();
        if (fetchData) fetchData();
      } else {
        console.error('Erro detalhado ao adicionar comentário:', data);
        alert(`Erro ao adicionar comentário: ${data.error || 'Erro desconhecido'}`);
      }
    } catch (err) {
      console.error('Erro de rede ao adicionar comentário:', err);
    }
  };

  const handleUpdateComment = async (commentId: number) => {
    if (!editingCommentText.trim()) return;
    try {
      const res = await fetchWithAuth(`/api/maintenance/comments/${commentId}`, {
        method: 'PUT',
        body: JSON.stringify({ comment: editingCommentText })
      });
      if (res.ok) {
        setEditingCommentId(null);
        setEditingCommentText('');
        fetchComments();
        if (fetchData) fetchData();
      } else {
        const err = await res.json();
        alert(err.error || "Erro ao editar comentário");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const canEditComment = (comment: any) => {
    const createdAt = new Date(comment.created_at);
    const now = new Date();
    const diffMin = (now.getTime() - createdAt.getTime()) / (1000 * 60);
    return diffMin <= 15;
  };

  useEffect(() => {
    if (isOpen) setErrors({});
  }, [isOpen]);

  useEffect(() => {
    if (editingOrder) {
      setFormData({
        vehicleId: editingOrder.vehicle_id?.toString() || '',
        maintenanceTypeIds: editingOrder.maintenance_type_ids ? editingOrder.maintenance_type_ids.split(',').map((id: string) => id.trim()) : [],
        supplierId: editingOrder.supplier_id?.toString() || '',
        supplier: editingOrder.supplier || '',
        openDate: parseExcelDate(editingOrder.open_date).split(' ')[0] || '',
        estimatedCompletionDate: parseExcelDate(editingOrder.estimated_completion_date).split(' ')[0] || '',
        notes: editingOrder.notes || '',
        driverId: editingOrder.driver_id?.toString() || '',
        maintenanceNature: editingOrder.maintenance_nature || 'Preventiva',
        planIds: []
      });
    } else {
      let initialTypeIds: string[] = [];
      if (preSelectedMaintenanceTypeIds) {
        if (Array.isArray(preSelectedMaintenanceTypeIds)) {
          initialTypeIds = preSelectedMaintenanceTypeIds.map(id => id.toString());
        } else {
          initialTypeIds = preSelectedMaintenanceTypeIds.split(',').map(id => id.trim());
        }
      }

      const initialNature = initialTypeIds.length > 0
        ? maintenanceTypes.find(t => t.id.toString() === initialTypeIds[0])?.nature || 'Preventiva'
        : 'Preventiva';

      setFormData({
        vehicleId: preSelectedVehicleId?.toString() || '',
        maintenanceTypeIds: initialTypeIds,
        supplierId: '',
        supplier: '',
        openDate: getLocalISODate(),
        estimatedCompletionDate: '',
        notes: '',
        driverId: '',
        maintenanceNature: initialNature,
        planIds: preSelectedPlanId ? [preSelectedPlanId] : []
      });
      
      if (preSelectedVehicleId) {
        const vehicle = vehicles.find(v => v.id.toString() === preSelectedVehicleId);
        if (vehicle) {
          setFormData(prev => ({ ...prev, driverId: vehicle.driver_id?.toString() || '' }));
        }
      }
    }
  }, [editingOrder, isOpen, preSelectedVehicleId, preSelectedMaintenanceTypeIds, preSelectedPlanId, maintenanceTypes, vehicles]);

  if (!isOpen) return null;

  const handleServiceChange = (ids: string[]) => {
    const firstService = maintenanceTypes.find(t => t.id.toString() === ids[0]);
    setFormData(prev => ({ 
      ...prev, 
      maintenanceTypeIds: ids,
      maintenanceNature: firstService?.category || prev.maintenanceNature
    }));
    if (ids.length > 0) setErrors(prev => ({ ...prev, services: '' }));
  };

  const validate = () => {
    const newErrors: {[key: string]: string} = {};
    if (!formData.vehicleId) newErrors.vehicleId = 'Obrigatório';
    if (!formData.supplierId) newErrors.supplierId = 'Obrigatório';
    if (formData.maintenanceTypeIds.length === 0) newErrors.services = 'Selecione ao menos um serviço';
    
    // Check for duplicate plate in active orders
    if (!editingOrder && formData.vehicleId) {
      const existingOrder = orders.find(o => o.vehicle_id.toString() === formData.vehicleId && o.status === 'Aberta');
      if (existingOrder) {
        newErrors.vehicleId = `Este veículo já está em manutenção (${existingOrder.registration_number})`;
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={editingOrder ? "Atualizar Manutenção" : "Entrada em Manutenção"}>
      <div className="space-y-4">
        {!editingOrder && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-zinc-500 uppercase">Veículo</label>
                <div className="flex items-center gap-2">
                  {formData.vehicleId && (
                    <span className="text-[10px] bg-emerald-500/10 text-emerald-500 px-1.5 py-0.5 rounded font-bold">
                      KM Atual: {formatNumber(vehicles.find(v => v.id.toString() === formData.vehicleId)?.current_km || 0)}
                    </span>
                  )}
                  {errors.vehicleId && <span className="text-[10px] text-rose-500 font-bold uppercase">{errors.vehicleId}</span>}
                </div>
              </div>
              <select 
                value={formData.vehicleId}
                onChange={(e) => {
                  const vId = e.target.value;
                  const vehicle = vehicles.find(v => v.id.toString() === vId);
                  setFormData({ ...formData, vehicleId: vId, driverId: vehicle?.driver_id?.toString() || '' });
                  if (vId) setErrors(prev => ({ ...prev, vehicleId: '' }));
                }}
                className={cn(
                  "w-full bg-zinc-900 border rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-emerald-500/20 outline-none transition-colors",
                  errors.vehicleId ? "border-rose-500/50" : "border-zinc-800"
                )}
              >
                <option value="">Selecione o veículo</option>
                {vehicles.map(v => (
                  <option key={v.id} value={v.id}>{v.plate} - {v.model_name} ({v.branch || 'S/ Filial'})</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-zinc-500 uppercase">Motorista</label>
              <select 
                value={formData.driverId}
                onChange={(e) => setFormData({ ...formData, driverId: e.target.value })}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-emerald-500/20 outline-none"
              >
                <option value="">Selecione o motorista</option>
                {drivers.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        <div className="space-y-1">
          <label className="text-xs font-bold text-zinc-500 uppercase">Natureza da Manutenção</label>
          <div className="flex gap-2">
            {['Preventiva', 'Corretiva', 'Preditiva'].map(nature => (
              <button
                key={nature}
                type="button"
                onClick={() => setFormData({ ...formData, maintenanceNature: nature })}
                className={cn(
                  "flex-1 py-2 text-xs font-bold uppercase rounded-lg border transition-all",
                  formData.maintenanceNature === nature 
                    ? "bg-emerald-500/10 border-emerald-500 text-emerald-500" 
                    : "bg-zinc-900 border-zinc-800 text-zinc-500 hover:border-zinc-700"
                )}
              >
                {nature}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex justify-between items-center">
            <label className="text-xs font-bold text-zinc-500 uppercase">Serviços ({formData.maintenanceTypeIds.length} selecionados)</label>
            {errors.services && <span className="text-[10px] text-rose-500 font-bold uppercase">{errors.services}</span>}
          </div>
          <div className={cn(
            "rounded-lg border transition-colors",
            errors.services ? "border-rose-500/50" : "border-transparent"
          )}>
            <MultiSelect
              options={maintenanceTypes
                .filter(t => t.category === formData.maintenanceNature || formData.maintenanceTypeIds.includes(t.id.toString()))
                .map(t => ({ id: t.id.toString(), name: t.name, category: t.category, nature: t.category }))}
              selectedIds={formData.maintenanceTypeIds}
              onChange={handleServiceChange}
              placeholder="Buscar serviço..."
            />
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex justify-between items-center">
            <label className="text-xs font-bold text-zinc-500 uppercase">Fornecedor</label>
            {errors.supplierId && <span className="text-[10px] text-rose-500 font-bold uppercase">{errors.supplierId}</span>}
          </div>
          <select 
            value={formData.supplierId}
            onChange={(e) => {
              const sId = e.target.value;
              const supplier = suppliers.find(s => s.id.toString() === sId);
              setFormData({ ...formData, supplierId: sId, supplier: supplier?.trade_name || supplier?.name || '' });
              if (sId) setErrors(prev => ({ ...prev, supplierId: '' }));
            }}
            className={cn(
              "w-full bg-zinc-900 border rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-emerald-500/20 outline-none transition-colors",
              errors.supplierId ? "border-rose-500/50" : "border-zinc-800"
            )}
          >
            <option value="">Selecione o fornecedor</option>
            {suppliers.map(s => (
              <option key={s.id} value={s.id}>{s.trade_name || s.name}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-zinc-500 uppercase">Data de Entrada</label>
            <input 
              type="date"
              value={formData.openDate}
              onChange={(e) => setFormData({ ...formData, openDate: e.target.value })}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-emerald-500/20 outline-none"
              disabled={!!editingOrder}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-zinc-500 uppercase">Previsão de Saída</label>
            <input 
              type="date"
              value={formData.estimatedCompletionDate}
              onChange={(e) => setFormData({ ...formData, estimatedCompletionDate: e.target.value })}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-emerald-500/20 outline-none"
            />
          </div>
        </div>

        {!editingOrder && (
          <div className="space-y-1">
            <label className="text-xs font-bold text-zinc-500 uppercase">Descrição do Caso / Observações (Inicial)</label>
            <textarea 
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Descreva o motivo da manutenção..."
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-emerald-500/20 outline-none h-20 resize-none"
            />
          </div>
        )}

        {editingOrder && (
          <div className="space-y-3 pt-2 border-t border-zinc-800">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-zinc-500 uppercase flex items-center gap-2">
                <MessageSquare className="w-3 h-3" />
                Histórico de Atualizações
              </label>
              <span className="text-[10px] text-zinc-500 font-bold uppercase">{comments.length} mensagens</span>
            </div>
            
            <div className="bg-zinc-900/30 border border-zinc-800 rounded-xl p-4 max-h-64 overflow-y-auto space-y-4 custom-scrollbar">
              {editingOrder.notes && (
                <div className="flex flex-col gap-1 pb-3 border-b border-zinc-800/50">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-emerald-500 uppercase">Abertura</span>
                    <span className="text-[10px] text-zinc-500">
                      {format(new Date(editingOrder.open_date), 'dd/MM HH:mm')}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap">
                    {editingOrder.notes}
                  </p>
                </div>
              )}
              {comments.length === 0 && !editingOrder.notes ? (
                <p className="text-center text-xs text-zinc-600 py-4 italic">Nenhuma atualização registrada ainda.</p>
              ) : (
                comments.map((c) => (
                  <div key={c.id} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-emerald-500 uppercase">{c.user_name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-zinc-500">
                          {format(new Date(c.created_at), 'dd/MM HH:mm')}
                        </span>
                        {canEditComment(c) && (
                          <button 
                            onClick={() => {
                              setEditingCommentId(c.id);
                              setEditingCommentText(c.comment);
                            }}
                            className="text-[10px] text-zinc-500 hover:text-emerald-500 font-bold uppercase transition-colors"
                          >
                            Editar
                          </button>
                        )}
                        {currentUser?.is_admin === 1 && handleDeleteComment && (
                          <button 
                            onClick={() => handleDeleteComment(c.id, fetchComments)}
                            className="text-[10px] text-zinc-500 hover:text-rose-500 font-bold uppercase transition-colors"
                          >
                            Excluir
                          </button>
                        )}
                      </div>
                    </div>
                    
                    {editingCommentId === c.id ? (
                      <div className="flex flex-col gap-2 mt-1">
                        <textarea 
                          value={editingCommentText}
                          onChange={(e) => setEditingCommentText(e.target.value)}
                          className="w-full bg-zinc-950 border border-emerald-500/50 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-emerald-500/20 outline-none h-20 resize-none"
                        />
                        <div className="flex justify-end gap-2">
                          <button 
                            onClick={() => setEditingCommentId(null)}
                            className="px-3 py-1 text-[10px] font-bold text-zinc-500 hover:text-white uppercase transition-colors"
                          >
                            Cancelar
                          </button>
                          <button 
                            onClick={() => handleUpdateComment(c.id)}
                            className="px-3 py-1 bg-emerald-600 text-white text-[10px] font-bold rounded uppercase hover:bg-emerald-500 transition-colors"
                          >
                            Salvar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-zinc-900 border border-zinc-800/50 rounded-lg p-3 text-sm text-zinc-300 relative group">
                        {c.comment}
                        {c.updated_at && (
                          <span className="absolute bottom-1 right-2 text-[8px] text-zinc-600 italic">editado</span>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="flex gap-2">
              <input 
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
                placeholder="Adicionar nova observação..."
                className="flex-grow bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-emerald-500/20 outline-none"
              />
              <button 
                onClick={handleAddComment}
                disabled={!newComment.trim()}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-emerald-900/20"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        <div className="flex justify-end space-x-3 pt-4">
          <button onClick={onClose} className="px-4 py-2 text-sm font-bold text-zinc-400 hover:text-white transition-colors">Cancelar</button>
          <button 
            onClick={() => {
              if (validate()) {
                onConfirm(formData);
              }
            }}
            className="px-6 py-2 bg-emerald-600 text-white text-sm font-bold rounded-lg hover:bg-emerald-500 transition-colors shadow-lg shadow-emerald-900/20"
          >
            {editingOrder ? "Salvar Alterações" : "Confirmar Entrada"}
          </button>
        </div>
      </div>
    </Modal>
  );
};

const MaintenanceCloseModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  order 
}: { 
  isOpen: boolean, 
  onClose: () => void, 
  onConfirm: (data: any) => void,
  order: any
}) => {
  const [formData, setFormData] = useState({
    closeDate: getLocalISODate(),
    km: '',
    cost: '',
    notes: ''
  });

  useEffect(() => {
    if (order) {
      setFormData({
        closeDate: getLocalISODate(),
        km: '',
        cost: '',
        notes: ''
      });
    }
  }, [order, isOpen]);

  if (!isOpen || !order) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Baixa de Manutenção - ${order.plate}`}>
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-zinc-500 uppercase">Data de Saída</label>
            <input 
              type="date"
              value={formData.closeDate}
              onChange={(e) => setFormData({ ...formData, closeDate: e.target.value })}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-emerald-500/20 outline-none"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-zinc-500 uppercase">Quilometragem (KM)</label>
            <input 
              type="number"
              value={formData.km}
              onChange={(e) => setFormData({ ...formData, km: e.target.value })}
              placeholder="KM na saída"
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-emerald-500/20 outline-none"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold text-zinc-500 uppercase">Custo Total (R$)</label>
          <input 
            type="number"
            value={formData.cost}
            onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
            placeholder="0,00"
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-emerald-500/20 outline-none"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold text-zinc-500 uppercase">Observações Finais</label>
          <textarea 
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            placeholder="Relatório final da manutenção..."
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-emerald-500/20 outline-none h-24 resize-none"
          />
        </div>

        <div className="flex justify-end space-x-3 pt-4">
          <button onClick={onClose} className="px-4 py-2 text-sm font-bold text-zinc-400 hover:text-white transition-colors">Cancelar</button>
          <button 
            onClick={() => onConfirm(formData)}
            className="px-6 py-2 bg-emerald-600 text-white text-sm font-bold rounded-lg hover:bg-emerald-500 transition-colors shadow-lg shadow-emerald-900/20"
          >
            Finalizar Manutenção
          </button>
        </div>
      </div>
    </Modal>
  );
};

const DEFAULT_PERMISSIONS: AppPermissions = {
  dashboard: { access: false },
  reports: { access: false },
  fueling: { 
    access: false,
    create: false,
    delete: false,
  },
  maintenance_board: {
    access: false,
    import: false,
    export: false,
    create: false,
    edit: false,
    delete: false,
    download_template: false,
    search: false,
  },
  maintenance_plan: {
    access: false,
    view_active: false,
    view_history: false,
    search: false,
    export: false,
    create: false,
    edit: false,
    delete: false,
  },
  fleet_documents: {
    access: false,
    create: false,
    edit: false,
    delete: false,
  },
  registrations: {
    access: false,
    vehicles: { view: false, create: false, edit: false, delete: false, export: false },
    drivers: { view: false, create: false, edit: false, delete: false, export: false },
    helpers: { view: false, create: false, edit: false, delete: false, export: false },
    suppliers: { view: false, create: false, edit: false, delete: false, export: false },
    auxiliary_tables: { view: false, create: false, edit: false, delete: false, export: false },
  },
};

const ProfilesView = ({ profiles, onAdd, onEdit, onDelete }: { 
  profiles: Profile[], 
  onAdd: () => void, 
  onEdit: (p: Profile) => void,
  onDelete: (id: number) => void
}) => {
  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h2 className="text-2xl font-bold text-white">Níveis de Acesso</h2>
        <button onClick={onAdd} className="flex items-center px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 transition-colors whitespace-nowrap">
          <Plus className="w-5 h-5 mr-2" />
          Novo Nível
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {profiles.map((p) => (
          <Card key={p.id} className="relative group overflow-hidden">
            <div className="absolute top-4 right-4 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
              <button onClick={() => onEdit(p)} className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors">
                <Edit2 className="w-4 h-4" />
              </button>
              <button onClick={() => onDelete(p.id)} className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2.5 bg-emerald-500/10 rounded-xl">
                <ShieldCheck className="w-6 h-6 text-emerald-500" />
              </div>
              <h3 className="text-xl font-bold text-white">{p.name}</h3>
            </div>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2 bg-zinc-900/50 rounded-lg border border-zinc-800/50">
                  <p className="text-[10px] font-bold text-zinc-500 uppercase mb-1">Dashboard</p>
                  <span className={cn("text-xs font-medium", p.permissions?.dashboard?.access ? "text-emerald-500" : "text-zinc-600")}>
                    {p.permissions?.dashboard?.access ? "Acesso" : "Bloqueado"}
                  </span>
                </div>
                <div className="p-2 bg-zinc-900/50 rounded-lg border border-zinc-800/50">
                  <p className="text-[10px] font-bold text-zinc-500 uppercase mb-1">Relatórios</p>
                  <span className={cn("text-xs font-medium", p.permissions?.reports?.access ? "text-emerald-500" : "text-zinc-600")}>
                    {p.permissions?.reports?.access ? "Acesso" : "Bloqueado"}
                  </span>
                </div>
                <div className="p-2 bg-zinc-900/50 rounded-lg border border-zinc-800/50">
                  <p className="text-[10px] font-bold text-zinc-500 uppercase mb-1">Abastecimentos</p>
                  <span className={cn("text-xs font-medium", p.permissions?.fueling?.access ? "text-emerald-500" : "text-zinc-600")}>
                    {p.permissions?.fueling?.access ? "Acesso" : "Bloqueado"}
                  </span>
                </div>
                <div className="p-2 bg-zinc-900/50 rounded-lg border border-zinc-800/50">
                  <p className="text-[10px] font-bold text-zinc-500 uppercase mb-1">Cadastros</p>
                  <span className={cn("text-xs font-medium", p.permissions?.registrations?.access ? "text-emerald-500" : "text-zinc-600")}>
                    {p.permissions?.registrations?.access ? "Acesso" : "Bloqueado"}
                  </span>
                </div>
              </div>

              <div className="pt-2 border-t border-zinc-800">
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Manutenção</p>
                <div className="flex flex-wrap gap-2">
                  {p.permissions?.maintenance_board?.access && <span className="px-2 py-1 bg-emerald-500/10 text-emerald-500 text-[10px] font-bold rounded uppercase">Quadro</span>}
                  {p.permissions?.maintenance_plan?.access && <span className="px-2 py-1 bg-emerald-500/10 text-emerald-500 text-[10px] font-bold rounded uppercase">Plano</span>}
                  {(p.permissions?.maintenance_board?.create || p.permissions?.maintenance_board?.edit || p.permissions?.maintenance_board?.delete) && <span className="px-2 py-1 bg-zinc-800 text-zinc-400 text-[10px] font-bold rounded uppercase">Gerenciar OS</span>}
                  {(p.permissions?.maintenance_plan?.create || p.permissions?.maintenance_plan?.edit || p.permissions?.maintenance_plan?.delete) && <span className="px-2 py-1 bg-zinc-800 text-zinc-400 text-[10px] font-bold rounded uppercase">Gerenciar Planos</span>}
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

const UsersView = ({ users, onAdd, onEdit, onDelete }: { 
  users: UserType[], 
  onAdd: () => void, 
  onEdit: (u: UserType) => void,
  onDelete: (id: number) => void
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  const totalPages = Math.ceil(users.length / itemsPerPage);
  const paginatedUsers = users.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h2 className="text-2xl font-bold text-white">Gestão de Usuários</h2>
        <button onClick={onAdd} className="flex items-center px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 transition-colors whitespace-nowrap">
          <Plus className="w-5 h-5 mr-2" />
          Novo Usuário
        </button>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="px-4 py-3 text-sm font-medium text-zinc-400 uppercase">Nome</th>
                <th className="px-4 py-3 text-sm font-medium text-zinc-400 uppercase">E-mail</th>
                <th className="px-4 py-3 text-sm font-medium text-zinc-400 uppercase">Perfil</th>
                <th className="px-4 py-3 text-sm font-medium text-zinc-400 uppercase">Status</th>
                <th className="px-4 py-3 text-sm font-medium text-zinc-400 uppercase text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {paginatedUsers.map((u) => (
                <tr key={u.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-zinc-800 rounded-full flex items-center justify-center text-zinc-400 font-bold">
                        {u.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-white font-bold">{u.name}</p>
                        {u.is_admin === 1 && <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">Administrador</span>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-zinc-400 text-sm">{u.email}</td>
                  <td className="px-4 py-4 text-zinc-300">{u.profile_name || '-'}</td>
                  <td className="px-4 py-4">
                    <span className={cn(
                      "px-2 py-1 text-[10px] font-bold rounded-full uppercase",
                      u.status === 'Ativo' ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"
                    )}>
                      {u.status}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => onEdit(u)} className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => onDelete(u.id)} className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          itemsPerPage={itemsPerPage}
          onItemsPerPageChange={setItemsPerPage}
          totalItems={users.length}
        />
      </Card>
    </div>
  );
};

const DriversView = ({ 
  drivers, 
  searchQuery, 
  setSearchQuery, 
  onAdd, 
  onEdit, 
  onDelete, 
  onToggleStatus,
  branches,
  fleetCategories,
  canCreate,
  canEdit,
  canDelete,
  canExport = true,
  onRefresh
}: { 
  drivers: Driver[], 
  searchQuery: string,
  setSearchQuery: (s: string) => void,
  onAdd: () => void, 
  onEdit: (d: Driver) => void,
  onDelete: (id: number) => void,
  onToggleStatus: (d: Driver) => void,
  branches: string[],
  fleetCategories: FleetCategory[],
  canCreate?: boolean,
  canEdit?: boolean,
  canDelete?: boolean,
  canExport?: boolean,
  onRefresh?: () => void
}) => {
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string[]>([]);
  const [branchFilter, setBranchFilter] = useState<string[]>([]);
  const [fleetTypeFilter, setFleetTypeFilter] = useState<string[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  const handleExport = async () => {
    try {
      const res = await fetchWithAuth('/api/drivers/export');
      if (res.ok) {
        const data = await res.json();
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Motoristas");
        XLSX.writeFile(wb, "motoristas_cadastro.xlsx");
      }
    } catch (e) {
      console.error(e);
      alert('Erro ao exportar dados.');
    }
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setImportResult(null);

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const rawData = XLSX.utils.sheet_to_json(ws);
        const data = rawData.map((row: any) => {
          if (row.license_expiry) {
            row.license_expiry = parseExcelDate(row.license_expiry);
          }
          return row;
        });

        const res = await fetchWithAuth('/api/drivers/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });

        if (res.ok) {
          const result = await res.json();
          setImportResult({ success: true, message: result.message });
          onRefresh?.();
        } else {
          const err = await res.json();
          setImportResult({ success: false, message: err.error });
        }
      } catch (err: any) {
        console.error(err);
        setImportResult({ success: false, message: err.message || 'Erro ao processar o arquivo.' });
      } finally {
        setIsImporting(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const res = await fetchWithAuth('/api/drivers/sync-from-fuel', { method: 'POST' });
      if (res.ok) {
        const result = await res.json();
        alert(`Sincronização concluída! ${result.updatedCount} motoristas atualizados.`);
        onRefresh?.();
      } else {
        const err = await res.json();
        alert(`Erro ao sincronizar: ${err.error}`);
      }
    } catch (e: any) {
      alert(`Erro: ${e.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const filteredDrivers = drivers.filter(d => {
    const matchesSearch = (d.name || '').toLowerCase().includes((searchQuery || '').toLowerCase()) || 
                         (d.cpf || '').toLowerCase().includes((searchQuery || '').toLowerCase());
    const matchesStatus = statusFilter.length === 0 || statusFilter.includes(d.status || '');
    const matchesCategory = categoryFilter.length === 0 || categoryFilter.includes(d.license_category || '');
    const matchesBranch = branchFilter.length === 0 || branchFilter.includes(d.branch || '');
    const matchesFleetType = fleetTypeFilter.length === 0 || fleetTypeFilter.includes(String(d.fleet_category_id));
    
    return matchesSearch && matchesStatus && matchesCategory && matchesBranch && matchesFleetType;
  });

  const totalPages = Math.ceil(filteredDrivers.length / itemsPerPage);
  const paginatedDrivers = filteredDrivers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h2 className="text-2xl font-bold text-white">Gestão de Motoristas</h2>
        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 w-full md:w-64">
            <Search className="w-4 h-4 text-zinc-500 mr-2" />
            <input 
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por nome, CPF..."
              className="bg-transparent border-none text-sm text-white focus:ring-0 outline-none w-full"
            />
          </div>
          <div className="flex items-center gap-2">
            {canEdit && (
              <button 
                onClick={handleSync}
                disabled={isSyncing}
                className="flex items-center px-4 py-2 bg-emerald-600/10 text-emerald-500 border border-emerald-500/20 rounded-lg hover:bg-emerald-600/20 transition-colors whitespace-nowrap disabled:opacity-50"
                title="Sincronizar classificação e filial com base nos abastecimentos"
              >
                <RefreshCw className={`w-5 h-5 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
                {isSyncing ? 'Sincronizando...' : 'Sincronizar'}
              </button>
            )}
            {canExport && (
              <button 
                onClick={handleExport}
                className="flex items-center px-4 py-2 bg-zinc-800 text-white rounded-lg hover:bg-zinc-700 transition-colors whitespace-nowrap"
                title="Exportar para Excel"
              >
                <Download className="w-5 h-5 mr-2" />
                Exportar
              </button>
            )}
            {canCreate && (
              <label className="flex items-center px-4 py-2 bg-zinc-800 text-white rounded-lg hover:bg-zinc-700 transition-colors cursor-pointer whitespace-nowrap" title="Importar de Excel">
                <Upload className="w-5 h-5 mr-2" />
                Importar
                <input type="file" className="hidden" accept=".xlsx, .xls, .csv" onChange={handleImport} />
              </label>
            )}
            {canCreate && (
              <button onClick={onAdd} className="flex items-center px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 transition-colors whitespace-nowrap">
                <Plus className="w-5 h-5 mr-2" />
                Novo Motorista
              </button>
            )}
          </div>
        </div>
      </div>

      <ExpandableFilters isOpen={isFiltersOpen} onToggle={() => setIsFiltersOpen(!isFiltersOpen)}>
        <div className="space-y-1">
          <label className="text-xs font-medium text-zinc-500 uppercase">Status</label>
          <MultiSelect
            options={[
              { id: 'Ativo', name: 'Ativo' },
              { id: 'Inativo', name: 'Inativo' }
            ]}
            selectedIds={statusFilter}
            onChange={setStatusFilter}
            placeholder="Todos Status"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-zinc-500 uppercase">Categoria CNH</label>
          <MultiSelect
            options={[
              { id: 'A', name: 'A' },
              { id: 'B', name: 'B' },
              { id: 'C', name: 'C' },
              { id: 'D', name: 'D' },
              { id: 'E', name: 'E' },
              { id: 'AB', name: 'AB' },
              { id: 'AC', name: 'AC' },
              { id: 'AD', name: 'AD' },
              { id: 'AE', name: 'AE' }
            ]}
            selectedIds={categoryFilter}
            onChange={setCategoryFilter}
            placeholder="Todas Categorias"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-zinc-500 uppercase">Filial</label>
          <MultiSelect
            options={branches.map(b => ({ id: b, name: b }))}
            selectedIds={branchFilter}
            onChange={setBranchFilter}
            placeholder="Todas Filiais"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-zinc-500 uppercase">Tipo de Frota</label>
          <MultiSelect
            options={fleetCategories.map(c => ({ id: c.id.toString(), name: c.name }))}
            selectedIds={fleetTypeFilter}
            onChange={setFleetTypeFilter}
            placeholder="Todas as Frotas"
          />
        </div>
        <div className="flex items-end pb-1">
          <button 
            onClick={() => {
              setStatusFilter([]);
              setCategoryFilter([]);
              setBranchFilter([]);
              setFleetTypeFilter([]);
            }}
            className="text-xs text-zinc-500 hover:text-white transition-colors py-2"
          >
            Limpar Filtros
          </button>
        </div>
      </ExpandableFilters>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="px-4 py-3 text-sm font-medium text-zinc-400 uppercase">Nome</th>
                <th className="px-4 py-3 text-sm font-medium text-zinc-400 uppercase">CPF</th>
                <th className="px-4 py-3 text-sm font-medium text-zinc-400 uppercase">Filial</th>
                <th className="px-4 py-3 text-sm font-medium text-zinc-400 uppercase">Classificação</th>
                <th className="px-4 py-3 text-sm font-medium text-zinc-400 uppercase">Categoria</th>
                <th className="px-4 py-3 text-sm font-medium text-zinc-400 uppercase">Venc. CNH</th>
                <th className="px-4 py-3 text-sm font-medium text-zinc-400 uppercase">Status</th>
                <th className="px-4 py-3 text-sm font-medium text-zinc-400 uppercase text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {paginatedDrivers.map((d) => (
              <tr key={d.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                <td className="px-4 py-4 text-white font-bold">
                  <div className="flex items-center gap-2">
                    {d.name}
                    {d.notes && (
                      <div className="group relative">
                        <Info className="w-4 h-4 text-zinc-500 hover:text-emerald-500 transition-colors cursor-help" />
                        <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 w-64 p-2 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl text-xs text-zinc-300 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                          {d.notes}
                        </div>
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-4 py-4 text-zinc-300">{d.cpf}</td>
                <td className="px-4 py-4 text-zinc-400 text-sm">{d.branch || '-'}</td>
                <td className="px-4 py-4 text-zinc-400 text-sm">{d.fleet_category_name || '-'}</td>
                <td className="px-4 py-4 text-zinc-400 text-sm">{d.license_category}</td>
                <td className="px-4 py-4 text-zinc-400 text-sm">{d.license_expiry || '-'}</td>
                <td className="px-4 py-4">
                  {canEdit ? (
                    <button 
                      onClick={() => onToggleStatus(d)}
                      className={cn(
                        "px-2 py-1 text-xs font-medium rounded-full transition-colors",
                        d.status === 'Ativo' ? "bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20" : "bg-rose-500/10 text-rose-500 hover:bg-rose-500/20"
                      )}
                    >
                      {d.status}
                    </button>
                  ) : (
                    <span className={cn(
                      "px-2 py-1 text-xs font-medium rounded-full",
                      d.status === 'Ativo' ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"
                    )}>
                      {d.status}
                    </span>
                  )}
                </td>
                <td className="px-4 py-4">
                  <div className="flex items-center justify-end space-x-2">
                    {canEdit && (
                      <button 
                        onClick={() => onEdit(d)}
                        className="p-1.5 text-zinc-400 hover:text-emerald-500 transition-colors"
                      >
                        <Settings className="w-4 h-4" />
                      </button>
                    )}
                    {canDelete && (
                      <button 
                        onClick={() => onDelete(d.id)}
                        className="p-1.5 text-zinc-400 hover:text-rose-500 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
        itemsPerPage={itemsPerPage}
        onItemsPerPageChange={setItemsPerPage}
        totalItems={filteredDrivers.length}
      />
    </Card>

    <Modal
      isOpen={isImporting || importResult !== null}
      onClose={() => !isImporting && setImportResult(null)}
      title="Importação de Motoristas"
    >
      <div className="space-y-4">
        {isImporting ? (
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-zinc-400">Processando arquivo...</p>
          </div>
        ) : importResult ? (
          <div className="space-y-4">
            <div className={clsx(
              "p-4 rounded-lg border",
              importResult.success 
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                : "bg-rose-500/10 border-rose-500/20 text-rose-400"
            )}>
              <div className="flex items-center space-x-2 mb-2">
                {importResult.success ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  <AlertCircle className="w-5 h-5" />
                )}
                <span className="font-medium">
                  {importResult.success ? 'Importação Concluída' : 'Erro na Importação'}
                </span>
              </div>
              <p className="text-sm opacity-90">{importResult.message}</p>
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => setImportResult(null)}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </Modal>
    </div>
  );
};

const ReportsView = () => {
  const [startDate, setStartDate] = useState(getFirstDayOfMonth());
  const [endDate, setEndDate] = useState(getLocalISODate());
  const [downloadingReportId, setDownloadingReportId] = useState<string | null>(null);

  const reports = [
    { 
      id: 'fuel_consumption', 
      title: 'Consumo por Veículo', 
      description: 'Histórico de KM/L, litros e custos por placa.',
      icon: Fuel,
      endpoint: '/api/reports/fuel-consumption',
      needsDates: true
    },
    { 
      id: 'maintenance_costs', 
      title: 'Custos de Manutenção', 
      description: 'Relatório detalhado de gastos por tipo de serviço.',
      icon: Wrench,
      endpoint: '/api/reports/maintenance-costs',
      needsDates: true
    },
    { 
      id: 'fleet_summary', 
      title: 'Resumo da Frota', 
      description: 'Status atual, KM e últimas atividades dos veículos.',
      icon: Truck,
      endpoint: '/api/reports/fleet-summary',
      needsDates: false
    },
    { 
      id: 'drivers_report', 
      title: 'Cadastro de Motoristas', 
      description: 'Listagem completa de motoristas e CNHs.',
      icon: Users,
      endpoint: '/api/reports/drivers',
      needsDates: false
    },
    { 
      id: 'vehicles_report', 
      title: 'Cadastro de Veículos', 
      description: 'Listagem detalhada de todos os veículos da frota.',
      icon: Truck,
      endpoint: '/api/reports/vehicles',
      needsDates: false
    },
    { 
      id: 'fuel_records', 
      title: 'Listagem de Abastecimentos', 
      description: 'Todos os registros de abastecimento importados.',
      icon: Fuel,
      endpoint: '/api/reports/fuel-records',
      needsDates: true
    }
  ];

  const handleDownloadReport = async (report: typeof reports[0]) => {
    if (downloadingReportId) return; // Prevent multiple simultaneous downloads
    
    setDownloadingReportId(report.id);

    try {
      const url = new URL(report.endpoint, window.location.origin);
      if (report.needsDates) {
        url.searchParams.append('startDate', startDate);
        url.searchParams.append('endDate', endDate);
      }
      
      const res = await fetchWithAuth(url.toString());
      const data = await res.json();
      
      if (res.ok && Array.isArray(data)) {
        if (data.length === 0) {
          alert('Nenhum dado encontrado para o período selecionado.');
          return;
        }

        const filename = `${report.title.replace(/\s+/g, '_')}_${startDate}_${endDate}.xlsx`;
        
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Relatorio");
        XLSX.writeFile(wb, filename);
      } else {
        console.error('API returned an error or non-array data:', data);
        alert(`Erro ao gerar relatório: ${data.error || 'Formato de dados inválido'}`);
      }
    } catch (error) {
      console.error('Erro ao baixar relatório:', error);
      alert('Erro de conexão ao tentar baixar o relatório.');
    } finally {
      setDownloadingReportId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h2 className="text-2xl font-bold text-white">Relatórios Gerenciais</h2>
        
        <div className="flex items-center gap-4 bg-zinc-900/50 p-2 rounded-xl border border-zinc-800">
          <div className="flex items-center gap-2">
            <input 
              type="date" 
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-transparent border-none text-sm text-white focus:outline-none focus:ring-0 cursor-pointer"
              title="Data Inicial"
            />
          </div>
          <span className="text-zinc-600">até</span>
          <div className="flex items-center gap-2">
            <input 
              type="date" 
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-transparent border-none text-sm text-white focus:outline-none focus:ring-0 cursor-pointer"
              title="Data Final"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {reports.map((report) => {
          const isDownloading = downloadingReportId === report.id;
          
          return (
            <Card 
              key={report.id}
              onClick={() => handleDownloadReport(report)}
              className={`transition-all cursor-pointer group relative overflow-hidden ${
                isDownloading 
                  ? 'border-emerald-500 bg-emerald-900/10' 
                  : 'hover:border-emerald-500/50'
              }`}
            >
              <div className="flex items-center space-x-4 p-6">
                <div className={`p-3 rounded-xl transition-colors ${
                  isDownloading ? 'bg-emerald-600/20' : 'bg-zinc-800 group-hover:bg-emerald-600/20'
                }`}>
                  {isDownloading ? (
                    <div className="w-6 h-6 border-2 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
                  ) : (
                    <report.icon className="w-6 h-6 text-emerald-500" />
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-white flex items-center gap-2">
                    {report.title}
                  </h3>
                  <p className="text-sm text-zinc-500 mt-1">{report.description}</p>
                  {report.needsDates && (
                    <span className="inline-block mt-2 text-[10px] uppercase tracking-wider font-bold text-zinc-600 bg-zinc-800/50 px-2 py-1 rounded-md">
                      Usa Filtro de Data
                    </span>
                  )}
                </div>
                
                <div className={`absolute right-6 opacity-0 transition-opacity ${
                  isDownloading ? 'opacity-100' : 'group-hover:opacity-100'
                }`}>
                  <Download className={`w-5 h-5 ${isDownloading ? 'text-emerald-500 animate-bounce' : 'text-zinc-400'}`} />
                </div>
              </div>
              
              {isDownloading && (
                <div className="absolute bottom-0 left-0 h-1 bg-emerald-500 animate-pulse w-full" />
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
};

const ProfileModal = ({ isOpen, onClose, onSave, editingProfile }: { 
  isOpen: boolean, 
  onClose: () => void, 
  onSave: (p: Partial<Profile>) => void,
  editingProfile: Profile | null
}) => {
  const [name, setName] = useState('');
  const [permissions, setPermissions] = useState<AppPermissions>(DEFAULT_PERMISSIONS);

  useEffect(() => {
    if (editingProfile) {
      setName(editingProfile.name);
      // Merge with default to ensure all keys exist
      setPermissions({
        ...DEFAULT_PERMISSIONS,
        ...editingProfile.permissions,
        maintenance_board: { ...DEFAULT_PERMISSIONS.maintenance_board, ...editingProfile.permissions.maintenance_board },
        maintenance_plan: { ...DEFAULT_PERMISSIONS.maintenance_plan, ...editingProfile.permissions.maintenance_plan },
        registrations: { 
          ...DEFAULT_PERMISSIONS.registrations, 
          ...editingProfile.permissions.registrations,
          vehicles: { ...DEFAULT_PERMISSIONS.registrations.vehicles, ...editingProfile.permissions.registrations?.vehicles },
          drivers: { ...DEFAULT_PERMISSIONS.registrations.drivers, ...editingProfile.permissions.registrations?.drivers },
          helpers: { ...DEFAULT_PERMISSIONS.registrations.helpers, ...editingProfile.permissions.registrations?.helpers },
          suppliers: { ...DEFAULT_PERMISSIONS.registrations.suppliers, ...editingProfile.permissions.registrations?.suppliers },
          auxiliary_tables: { ...DEFAULT_PERMISSIONS.registrations.auxiliary_tables, ...editingProfile.permissions.registrations?.auxiliary_tables },
        },
      });
    } else {
      setName('');
      setPermissions(DEFAULT_PERMISSIONS);
    }
  }, [editingProfile, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ name, permissions });
  };

  const togglePermission = (path: string) => {
    const keys = path.split('.');
    setPermissions(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      let current = next;
      for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) current[keys[i]] = {};
        current = current[keys[i]];
      }
      current[keys[keys.length - 1]] = !current[keys[keys.length - 1]];
      return next;
    });
  };

  const PermissionToggle = ({ label, path, checked }: { label: string, path: string, checked: boolean }) => (
    <label className="flex items-center justify-between p-2.5 bg-zinc-900/50 border border-zinc-800 rounded-xl cursor-pointer hover:bg-zinc-800 transition-colors">
      <span className="text-xs font-medium text-zinc-300">{label}</span>
      <div className="relative inline-flex items-center cursor-pointer">
        <input 
          type="checkbox" 
          className="sr-only peer" 
          checked={checked}
          onChange={() => togglePermission(path)}
        />
        <div className="w-9 h-5 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
      </div>
    </label>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={editingProfile ? 'Editar Nível de Acesso' : 'Novo Nível de Acesso'} size="xl">
      <form onSubmit={handleSubmit} className="space-y-8 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
        <div className="bg-zinc-900/50 p-4 rounded-2xl border border-zinc-800">
          <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">Nome do Nível</label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            placeholder="Ex: Operador, Gerente, etc"
          />
        </div>

        <div className="space-y-6">
          <div className="flex items-center gap-2 pb-2 border-b border-zinc-800">
            <ShieldCheck className="w-5 h-5 text-emerald-500" />
            <h3 className="text-lg font-bold text-white">Configuração de Permissões</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* General Access */}
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Módulos Gerais</h4>
              <div className="space-y-2">
                <PermissionToggle label="Dashboard" path="dashboard.access" checked={permissions.dashboard.access} />
                <PermissionToggle label="Relatórios" path="reports.access" checked={permissions.reports.access} />
                <div className="space-y-1">
                  <PermissionToggle label="Abastecimentos (Acesso)" path="fueling.access" checked={permissions.fueling.access} />
                  <div className="grid grid-cols-2 gap-2 pl-4">
                    <PermissionToggle label="Criar/Importar" path="fueling.create" checked={permissions.fueling.create} />
                    <PermissionToggle label="Excluir/Resetar" path="fueling.delete" checked={permissions.fueling.delete} />
                    <PermissionToggle label="Exportar" path="fueling.export" checked={permissions.fueling.export} />
                  </div>
                </div>
              </div>
            </div>

            {/* Maintenance Board */}
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Quadro de Manutenção</h4>
              <div className="grid grid-cols-1 gap-2">
                <PermissionToggle label="Acesso ao Módulo" path="maintenance_board.access" checked={permissions.maintenance_board.access} />
                <PermissionToggle label="Importar Dados" path="maintenance_board.import" checked={permissions.maintenance_board.import} />
                <PermissionToggle label="Exportar Dados" path="maintenance_board.export" checked={permissions.maintenance_board.export} />
                <div className="grid grid-cols-3 gap-2">
                  <PermissionToggle label="Criar" path="maintenance_board.create" checked={permissions.maintenance_board.create} />
                  <PermissionToggle label="Editar" path="maintenance_board.edit" checked={permissions.maintenance_board.edit} />
                  <PermissionToggle label="Excluir" path="maintenance_board.delete" checked={permissions.maintenance_board.delete} />
                </div>
                <PermissionToggle label="Baixar Modelo Planilha" path="maintenance_board.download_template" checked={permissions.maintenance_board.download_template} />
                <PermissionToggle label="Pesquisa e Filtros" path="maintenance_board.search" checked={permissions.maintenance_board.search} />
              </div>
            </div>

            {/* Maintenance Plan */}
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Plano de Manutenção</h4>
              <div className="grid grid-cols-1 gap-2">
                <PermissionToggle label="Acesso ao Módulo" path="maintenance_plan.access" checked={permissions.maintenance_plan.access} />
                <PermissionToggle label="Ver Planos Ativos" path="maintenance_plan.view_active" checked={permissions.maintenance_plan.view_active} />
                <PermissionToggle label="Ver Histórico" path="maintenance_plan.view_history" checked={permissions.maintenance_plan.view_history} />
                <PermissionToggle label="Pesquisa e Filtros" path="maintenance_plan.search" checked={permissions.maintenance_plan.search} />
                <PermissionToggle label="Exportar Dados" path="maintenance_plan.export" checked={permissions.maintenance_plan.export} />
                <div className="grid grid-cols-3 gap-2">
                  <PermissionToggle label="Criar" path="maintenance_plan.create" checked={permissions.maintenance_plan.create} />
                  <PermissionToggle label="Editar" path="maintenance_plan.edit" checked={permissions.maintenance_plan.edit} />
                  <PermissionToggle label="Excluir" path="maintenance_plan.delete" checked={permissions.maintenance_plan.delete} />
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Controle Documental</h4>
                <div className="grid grid-cols-1 gap-2">
                  <PermissionToggle label="Acesso ao Módulo" path="fleet_documents.access" checked={permissions.fleet_documents.access} />
                  <div className="grid grid-cols-3 gap-2">
                    <PermissionToggle label="Criar" path="fleet_documents.create" checked={permissions.fleet_documents.create} />
                    <PermissionToggle label="Editar" path="fleet_documents.edit" checked={permissions.fleet_documents.edit} />
                    <PermissionToggle label="Excluir" path="fleet_documents.delete" checked={permissions.fleet_documents.delete} />
                  </div>
                </div>
              </div>
            </div>

            {/* Registrations */}
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Cadastros</h4>
              <div className="space-y-4">
                <PermissionToggle label="Acesso Geral aos Cadastros" path="registrations.access" checked={permissions.registrations.access} />
                
                <div className="pl-4 space-y-4 border-l border-zinc-800">
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold text-zinc-600 uppercase">Veículos</p>
                    <div className="grid grid-cols-2 gap-2">
                      <PermissionToggle label="Ver" path="registrations.vehicles.view" checked={permissions.registrations.vehicles.view} />
                      <PermissionToggle label="Criar" path="registrations.vehicles.create" checked={permissions.registrations.vehicles.create} />
                      <PermissionToggle label="Editar" path="registrations.vehicles.edit" checked={permissions.registrations.vehicles.edit} />
                      <PermissionToggle label="Excluir" path="registrations.vehicles.delete" checked={permissions.registrations.vehicles.delete} />
                      <PermissionToggle label="Exportar" path="registrations.vehicles.export" checked={permissions.registrations.vehicles.export} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold text-zinc-600 uppercase">Motoristas</p>
                    <div className="grid grid-cols-2 gap-2">
                      <PermissionToggle label="Ver" path="registrations.drivers.view" checked={permissions.registrations.drivers.view} />
                      <PermissionToggle label="Criar" path="registrations.drivers.create" checked={permissions.registrations.drivers.create} />
                      <PermissionToggle label="Editar" path="registrations.drivers.edit" checked={permissions.registrations.drivers.edit} />
                      <PermissionToggle label="Excluir" path="registrations.drivers.delete" checked={permissions.registrations.drivers.delete} />
                      <PermissionToggle label="Exportar" path="registrations.drivers.export" checked={permissions.registrations.drivers.export} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold text-zinc-600 uppercase">Ajudantes</p>
                    <div className="grid grid-cols-2 gap-2">
                      <PermissionToggle label="Ver" path="registrations.helpers.view" checked={permissions.registrations.helpers.view} />
                      <PermissionToggle label="Criar" path="registrations.helpers.create" checked={permissions.registrations.helpers.create} />
                      <PermissionToggle label="Editar" path="registrations.helpers.edit" checked={permissions.registrations.helpers.edit} />
                      <PermissionToggle label="Excluir" path="registrations.helpers.delete" checked={permissions.registrations.helpers.delete} />
                      <PermissionToggle label="Exportar" path="registrations.helpers.export" checked={permissions.registrations.helpers.export} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold text-zinc-600 uppercase">Fornecedores</p>
                    <div className="grid grid-cols-2 gap-2">
                      <PermissionToggle label="Ver" path="registrations.suppliers.view" checked={permissions.registrations.suppliers.view} />
                      <PermissionToggle label="Criar" path="registrations.suppliers.create" checked={permissions.registrations.suppliers.create} />
                      <PermissionToggle label="Editar" path="registrations.suppliers.edit" checked={permissions.registrations.suppliers.edit} />
                      <PermissionToggle label="Excluir" path="registrations.suppliers.delete" checked={permissions.registrations.suppliers.delete} />
                      <PermissionToggle label="Exportar" path="registrations.suppliers.export" checked={permissions.registrations.suppliers.export} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold text-zinc-600 uppercase">Tabelas Auxiliares</p>
                    <div className="grid grid-cols-2 gap-2">
                      <PermissionToggle label="Ver" path="registrations.auxiliary_tables.view" checked={permissions.registrations.auxiliary_tables.view} />
                      <PermissionToggle label="Criar" path="registrations.auxiliary_tables.create" checked={permissions.registrations.auxiliary_tables.create} />
                      <PermissionToggle label="Editar" path="registrations.auxiliary_tables.edit" checked={permissions.registrations.auxiliary_tables.edit} />
                      <PermissionToggle label="Excluir" path="registrations.auxiliary_tables.delete" checked={permissions.registrations.auxiliary_tables.delete} />
                      <PermissionToggle label="Exportar" path="registrations.auxiliary_tables.export" checked={permissions.registrations.auxiliary_tables.export} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-6 border-t border-zinc-800">
          <button type="button" onClick={onClose} className="px-6 py-3 text-sm font-bold text-zinc-400 hover:text-white transition-colors">
            Cancelar
          </button>
          <button type="submit" className="px-8 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-500 transition-all font-bold shadow-lg shadow-emerald-900/20">
            Salvar Nível de Acesso
          </button>
        </div>
      </form>
    </Modal>
  );
};

const UserModal = ({ isOpen, onClose, onSave, editingUser, profiles }: { 
  isOpen: boolean, 
  onClose: () => void, 
  onSave: (u: Partial<UserType>) => void,
  editingUser: UserType | null,
  profiles: Profile[]
}) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [profileId, setProfileId] = useState<number | ''>('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [status, setStatus] = useState('Ativo');

  useEffect(() => {
    if (editingUser) {
      setName(editingUser.name);
      setEmail(editingUser.email);
      setPassword('');
      setProfileId(editingUser.profile_id || '');
      setIsAdmin(editingUser.is_admin === 1);
      setStatus(editingUser.status);
    } else {
      setName('');
      setEmail('');
      setPassword('');
      setProfileId('');
      setIsAdmin(false);
      setStatus('Ativo');
    }
  }, [editingUser, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ 
      name, 
      email, 
      password: password || undefined, 
      profile_id: profileId === '' ? undefined : profileId, 
      is_admin: isAdmin ? 1 : 0, 
      status 
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={editingUser ? 'Editar Usuário' : 'Novo Usuário'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1">Nome Completo</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1">E-mail</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1">
              Senha {editingUser && <span className="text-[10px] text-zinc-500">(Deixe em branco para manter)</span>}
            </label>
            <input
              type="password"
              required={!editingUser}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1">Nível de Acesso</label>
            <select
              required={!isAdmin}
              value={profileId}
              onChange={(e) => setProfileId(e.target.value ? Number(e.target.value) : '')}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Selecione um nível</option>
              {profiles.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-6 p-4 bg-zinc-900/50 border border-zinc-800 rounded-lg">
          <label className="flex items-center gap-3 cursor-pointer group">
            <div className="relative flex items-center">
              <input
                type="checkbox"
                checked={isAdmin}
                onChange={(e) => setIsAdmin(e.target.checked)}
                className="sr-only"
              />
              <div className={cn(
                "w-10 h-5 rounded-full transition-colors",
                isAdmin ? "bg-emerald-600" : "bg-zinc-700"
              )}></div>
              <div className={cn(
                "absolute left-1 w-3 h-3 bg-white rounded-full transition-transform",
                isAdmin ? "translate-x-5" : "translate-x-0"
              )}></div>
            </div>
            <span className="text-sm font-medium text-zinc-300">Administrador</span>
          </label>

          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-zinc-400">Status:</span>
            <div className="flex gap-2">
              {['Ativo', 'Inativo'].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatus(s)}
                  className={cn(
                    "px-3 py-1 text-[10px] font-bold rounded-full uppercase transition-all",
                    status === s 
                      ? (s === 'Ativo' ? "bg-emerald-500 text-white" : "bg-red-500 text-white")
                      : "bg-zinc-800 text-zinc-500 hover:bg-zinc-700"
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <button type="button" onClick={onClose} className="px-4 py-2 text-zinc-400 hover:text-white transition-colors">
            Cancelar
          </button>
          <button type="submit" className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 transition-colors font-bold">
            Salvar Usuário
          </button>
        </div>
      </form>
    </Modal>
  );
};

const AuxiliaryTablesView = ({ 
  fleetCategories, responsibleCompanies, vehicleTypes, brands, models, maintenanceTypes, documentTypes, onAdd, onEdit, onDelete, onToggleStatus,
  canCreate, canEdit, canDelete, canExport = true
}: { 
  fleetCategories: FleetCategory[], 
  responsibleCompanies: ResponsibleCompany[],
  vehicleTypes: VehicleType[], 
  brands: Brand[], 
  models: Model[],
  maintenanceTypes: MaintenanceType[],
  documentTypes: DocumentType[],
  onAdd: (type: string) => void,
  onEdit: (type: string, item: any) => void,
  onDelete: (type: string, id: number) => void,
  onToggleStatus: (type: string, item: any) => void,
  canCreate?: boolean,
  canEdit?: boolean,
  canDelete?: boolean,
  canExport?: boolean
}) => {
  const [activeTab, setActiveTab] = useState('brands');

  const handleExport = async (type: string, title: string) => {
    try {
      let endpoint = `/api/${type}s/export`;
      if (type === 'fleet-category') endpoint = '/api/fleet-categories/export';
      if (type === 'responsible-company') endpoint = '/api/responsible-companies/export';
      if (type === 'vehicle-type') endpoint = '/api/vehicle-types/export';
      if (type === 'maintenance-type') endpoint = '/api/maintenance-types/export';
      if (type === 'document-type') endpoint = '/api/document-types/export';

      const res = await fetchWithAuth(endpoint);
      if (res.ok) {
        const data = await res.json();
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, title);
        XLSX.writeFile(wb, `${type}_cadastro.xlsx`);
      }
    } catch (e) {
      console.error(e);
      alert('Erro ao exportar dados.');
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white">Tabelas Auxiliares</h2>
      
      <div className="flex space-x-1 bg-zinc-900 p-1 rounded-xl border border-zinc-800 w-fit">
        {[
          { id: 'brands', label: 'Marcas', icon: Disc },
          { id: 'models', label: 'Modelos', icon: Settings },
          { id: 'types', label: 'Tipos de Veículo', icon: Truck },
          { id: 'categories', label: 'Categorias de Frota', icon: Users },
          { id: 'responsible-companies', label: 'Empresas Responsáveis', icon: Briefcase },
          { id: 'maintenance-types', label: 'Manutenções', icon: Wrench },
          { id: 'document-types', label: 'Documentos', icon: FileCheck },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-all",
              activeTab === tab.id ? "bg-emerald-600 text-white shadow-lg" : "text-zinc-400 hover:text-white hover:bg-zinc-800"
            )}
          >
            <tab.icon className="w-4 h-4 mr-2" />
            {tab.label}
          </button>
        ))}
      </div>

      <Table 
        key={activeTab}
        data={
          activeTab === 'brands' ? brands :
          activeTab === 'models' ? models :
          activeTab === 'types' ? vehicleTypes :
          activeTab === 'categories' ? fleetCategories :
          activeTab === 'responsible-companies' ? responsibleCompanies :
          activeTab === 'maintenance-types' ? maintenanceTypes :
          documentTypes
        }
        title={
          activeTab === 'brands' ? 'Marcas' :
          activeTab === 'models' ? 'Modelos' :
          activeTab === 'types' ? 'Tipos de Veículo' :
          activeTab === 'categories' ? 'Categorias de Frota' :
          activeTab === 'responsible-companies' ? 'Empresas Responsáveis' :
          activeTab === 'maintenance-types' ? 'Tipos de Manutenção' :
          'Tipos de Documento'
        }
        type={
          activeTab === 'brands' ? 'brand' :
          activeTab === 'models' ? 'model' :
          activeTab === 'types' ? 'vehicle-type' :
          activeTab === 'categories' ? 'fleet-category' :
          activeTab === 'responsible-companies' ? 'responsible-company' :
          activeTab === 'maintenance-types' ? 'maintenance-type' :
          'document-type'
        }
        onAddClick={() => onAdd(
          activeTab === 'brands' ? 'brand' :
          activeTab === 'models' ? 'model' :
          activeTab === 'types' ? 'vehicle-type' :
          activeTab === 'categories' ? 'fleet-category' :
          activeTab === 'responsible-companies' ? 'responsible-company' :
          activeTab === 'maintenance-types' ? 'maintenance-type' :
          'document-type'
        )}
        handleExport={handleExport}
        canExport={canExport}
        canCreate={canCreate}
        canEdit={canEdit}
        canDelete={canDelete}
        onEdit={onEdit}
        onDelete={onDelete}
        onToggleStatus={onToggleStatus}
        brands={brands}
      />
    </div>
  );
};

const Table = ({ 
  data, title, type, onAddClick, handleExport, canExport, canCreate, canEdit, canDelete,
  onEdit, onDelete, onToggleStatus, brands
}: { 
  key?: any,
  data: any[], title: string, type: string, onAddClick: () => void,
  handleExport: (type: string, title: string) => Promise<void>,
  canExport?: boolean, canCreate?: boolean, canEdit?: boolean, canDelete?: boolean,
  onEdit: (type: string, item: any) => void,
  onDelete: (type: string, id: number) => void,
  onToggleStatus: (type: string, item: any) => void,
  brands: Brand[]
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);

  const filteredData = data.filter(item => {
    const name = item.name || item.title || '';
    const matchesSearch = (name || '').toLowerCase().includes((searchQuery || '').toLowerCase());
    const matchesStatus = statusFilter === '' || item.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const paginatedData = filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter]);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-bold text-white">{title}</h3>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 w-48">
            <Search className="w-3.5 h-3.5 text-zinc-500 mr-2" />
            <input 
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar..."
              className="bg-transparent border-none text-xs text-white focus:ring-0 outline-none w-full"
            />
          </div>
          <div className="flex items-center gap-2">
            {canExport && (
              <button 
                onClick={() => handleExport(type, title)}
                className="flex items-center px-3 py-1.5 bg-zinc-800 text-white text-sm rounded-lg hover:bg-zinc-700 transition-colors"
                title="Exportar para Excel"
              >
                <Download className="w-4 h-4 mr-2" />
                Exportar
              </button>
            )}
            {canCreate && (
              <button 
                onClick={onAddClick}
                className="flex items-center px-3 py-1.5 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-500 transition-colors"
              >
                <Plus className="w-4 h-4 mr-2" />
                Adicionar
              </button>
            )}
          </div>
        </div>
      </div>

      <ExpandableFilters isOpen={isFiltersOpen} onToggle={() => setIsFiltersOpen(!isFiltersOpen)}>
        <div className="space-y-1">
          <label className="text-xs font-medium text-zinc-500 uppercase">Status</label>
          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-emerald-500/20 outline-none"
          >
            <option value="">Todos</option>
            <option value="Ativo">Ativo</option>
            <option value="Inativo">Inativo</option>
          </select>
        </div>
      </ExpandableFilters>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="px-4 py-3 text-sm font-medium text-zinc-400 uppercase">ID</th>
                <th className="px-4 py-3 text-sm font-medium text-zinc-400 uppercase">Nome</th>
                {title === 'Modelos' && <th className="px-4 py-3 text-sm font-medium text-zinc-400 uppercase">Marca</th>}
                {title === 'Modelos' && <th className="px-4 py-3 text-sm font-medium text-zinc-400 uppercase">Meta (KM/L)</th>}
                {title === 'Tipos de Manutenção' && <th className="px-4 py-3 text-sm font-medium text-zinc-400 uppercase">Categoria</th>}
                {title === 'Tipos de Manutenção' && <th className="px-4 py-3 text-sm font-medium text-zinc-400 uppercase">Intervalo (KM)</th>}
                {title === 'Tipos de Documento' && <th className="px-4 py-3 text-sm font-medium text-zinc-400 uppercase">Categoria</th>}
                <th className="px-4 py-3 text-sm font-medium text-zinc-400 uppercase">Status</th>
                <th className="px-4 py-3 text-sm font-medium text-zinc-400 uppercase text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {paginatedData.map((item) => (
                <tr key={item.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                  <td className="px-4 py-3 text-zinc-500 text-sm">{item.id}</td>
                  <td className="px-4 py-3 text-white font-medium">{item.name}</td>
                  {title === 'Modelos' && (
                    <td className="px-4 py-3 text-zinc-400 text-sm">
                      {brands.find(b => b.id === item.brand_id)?.name || '-'}
                    </td>
                  )}
                  {title === 'Modelos' && (
                    <td className="px-4 py-3 text-zinc-400 text-sm">
                      {item.target_consumption ? `${item.target_consumption} KM/L` : '-'}
                    </td>
                  )}
                  {title === 'Tipos de Manutenção' && (
                    <td className="px-4 py-3 text-zinc-400 text-sm">{item.category}</td>
                  )}
                  {title === 'Tipos de Manutenção' && (
                    <td className="px-4 py-3 text-zinc-400 text-sm">{formatNumber(item.km_interval)} KM</td>
                  )}
                  {title === 'Tipos de Documento' && (
                    <td className="px-4 py-3 text-zinc-400 text-sm">{item.category}</td>
                  )}
                  <td className="px-4 py-3">
                    {canEdit ? (
                      <button 
                        onClick={() => onToggleStatus(type, item)}
                        className={cn(
                          "px-2 py-1 text-xs font-medium rounded-full transition-colors",
                          item.status === 'Ativo' ? "bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20" : "bg-rose-500/10 text-rose-500 hover:bg-rose-500/20"
                        )}
                      >
                        {item.status || 'Ativo'}
                      </button>
                    ) : (
                      <span className={cn(
                        "px-2 py-1 text-xs font-medium rounded-full",
                        item.status === 'Ativo' ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"
                      )}>
                        {item.status || 'Ativo'}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end space-x-2">
                      {canEdit && (
                        <button 
                          onClick={() => onEdit(type, item)}
                          className="p-1.5 text-zinc-400 hover:text-emerald-500 transition-colors"
                        >
                          <Settings className="w-4 h-4" />
                        </button>
                      )}
                      {canDelete && (
                        <button 
                          onClick={() => onDelete(type, item.id)}
                          className="p-1.5 text-zinc-400 hover:text-rose-500 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredData.length === 0 && (
                <tr>
                  <td colSpan={title === 'Modelos' ? 6 : (title === 'Tipos de Manutenção' || title === 'Tipos de Documento' ? 5 : 4)} className="px-4 py-8 text-center text-zinc-500">Nenhum registro encontrado.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          itemsPerPage={itemsPerPage}
          onItemsPerPageChange={setItemsPerPage}
          totalItems={filteredData.length}
        />
      </Card>
    </div>
  );
};

// --- Main App ---

const PlateMappingModal = ({ 
  isOpen, 
  onClose, 
  duplicates, 
  onConfirm 
}: { 
  isOpen: boolean, 
  onClose: () => void, 
  duplicates: any[],
  onConfirm: (mappings: {[key: string]: string}, saveToDb: boolean) => void
}) => {
  const [selections, setSelections] = useState<{[key: string]: string}>({});
  const [saveToDb, setSaveToDb] = useState(true);

  useEffect(() => {
    if (isOpen) {
      // Default to replacing with equivalent
      const initial: {[key: string]: string} = {};
      duplicates.forEach(dup => {
        initial[dup.original] = dup.equivalent;
      });
      setSelections(initial);
    }
  }, [isOpen, duplicates]);

  if (!isOpen || duplicates.length === 0) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Avaliação Inteligente de Placas">
      <div className="space-y-4">
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
          <div className="flex space-x-3">
            <AlertTriangle className="w-5 h-5 text-blue-500 flex-shrink-0" />
            <p className="text-sm text-blue-400">
              Detectamos placas na planilha que são equivalentes a veículos já cadastrados (padrão Mercosul). 
              Escolha se deseja mapear para o veículo existente ou criar um novo cadastro.
            </p>
          </div>
        </div>

        <div className="max-h-[400px] overflow-y-auto space-y-3 pr-2 custom-scrollbar">
          {duplicates.map((dup, idx) => (
            <div key={idx} className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-4">
              <div className="flex justify-between items-center mb-3">
                <div className="space-y-1">
                  <span className="text-xs text-zinc-500 uppercase font-bold">Placa na Planilha</span>
                  <div className="text-lg font-bold text-white">{dup.original}</div>
                </div>
                <ArrowRight className="w-5 h-5 text-zinc-600" />
                <div className="space-y-1 text-right">
                  <span className="text-xs text-zinc-500 uppercase font-bold">Veículo Encontrado</span>
                  <div className="text-lg font-bold text-emerald-500">{dup.equivalent}</div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                <button 
                  type="button"
                  onClick={() => setSelections(prev => ({ ...prev, [dup.original]: dup.equivalent }))}
                  className={cn(
                    "px-3 py-2 rounded-lg text-xs font-bold transition-all border",
                    selections[dup.original] === dup.equivalent 
                      ? "bg-emerald-600 border-emerald-500 text-white shadow-lg shadow-emerald-900/20" 
                      : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700"
                  )}
                >
                  Substituir (Usar {dup.equivalent})
                </button>
                <button 
                  type="button"
                  onClick={() => setSelections(prev => ({ ...prev, [dup.original]: dup.original }))}
                  className={cn(
                    "px-3 py-2 rounded-lg text-xs font-bold transition-all border",
                    selections[dup.original] === dup.original 
                      ? "bg-amber-600 border-amber-500 text-white shadow-lg shadow-amber-900/20" 
                      : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700"
                  )}
                >
                  Seguir com Cadastro Novo
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center space-x-2 py-2">
          <input 
            type="checkbox" 
            id="saveToDb" 
            checked={saveToDb} 
            onChange={(e) => setSaveToDb(e.target.checked)}
            className="w-4 h-4 rounded border-zinc-800 bg-zinc-900 text-emerald-600 focus:ring-emerald-500/20"
          />
          <label htmlFor="saveToDb" className="text-sm text-zinc-400 cursor-pointer">
            Lembrar estas alterações para futuras importações
          </label>
        </div>

        <div className="flex justify-end space-x-3 mt-6">
          <button type="button" onClick={onClose} className="px-4 py-2 text-zinc-400 hover:text-white transition-colors">Cancelar</button>
          <button 
            type="button"
            onClick={() => onConfirm(selections, saveToDb)}
            disabled={Object.keys(selections).length < duplicates.length}
            className="px-6 py-2 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-emerald-900/20"
          >
            Confirmar e Importar
          </button>
        </div>
      </div>
    </Modal>
  );
};

const SupplierModal = ({ 
  isOpen, 
  onClose, 
  onSave, 
  supplier 
}: { 
  isOpen: boolean, 
  onClose: () => void, 
  onSave: (data: any) => Promise<void>,
  supplier: Supplier | null
}) => {
  const [formData, setFormData] = useState({
    name: '',
    trade_name: '',
    cnpj: '',
    phone: '',
    email: '',
    street: '',
    number: '',
    neighborhood: '',
    zip_code: '',
    city: '',
    state: '',
    status: 'Ativo'
  });
  const [isSearching, setIsSearching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      if (supplier) {
        setFormData({
          name: supplier.name,
          trade_name: supplier.trade_name || '',
          cnpj: supplier.cnpj || '',
          phone: supplier.phone || '',
          email: supplier.email || '',
          street: supplier.street || '',
          number: supplier.number || '',
          neighborhood: supplier.neighborhood || '',
          zip_code: supplier.zip_code || '',
          city: supplier.city || '',
          state: supplier.state || '',
          status: supplier.status
        });
      } else {
        setFormData({
          name: '',
          trade_name: '',
          cnpj: '',
          phone: '',
          email: '',
          street: '',
          number: '',
          neighborhood: '',
          zip_code: '',
          city: '',
          state: '',
          status: 'Ativo'
        });
      }
    }
  }, [supplier, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSaving(true);
    try {
      await onSave(formData);
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar fornecedor');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCnpjLookup = async () => {
    const cleanCnpj = formData.cnpj.replace(/\D/g, '');
    if (cleanCnpj.length !== 14) {
      setError('Por favor, insira um CNPJ válido com 14 dígitos.');
      return;
    }

    setIsSearching(true);
    setError(null);
    try {
      const response = await fetchWithAuth(`/api/cnpj/${cleanCnpj}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'CNPJ não encontrado');
      }
      
      const data = await response.json();
      
      setFormData(prev => ({
        ...prev,
        name: data.razao_social || prev.name,
        trade_name: data.nome_fantasia || prev.trade_name,
        phone: data.ddd_telefone_1 || prev.phone,
        email: data.email || prev.email,
        street: data.logradouro || prev.street,
        number: data.numero || prev.number,
        neighborhood: data.bairro || prev.neighborhood,
        zip_code: data.cep || prev.zip_code,
        city: data.municipio || prev.city,
        state: data.uf || prev.state
      }));
    } catch (error: any) {
      console.error('Erro ao buscar CNPJ:', error);
      setError(error.message || 'Não foi possível encontrar os dados para este CNPJ. Verifique se o número está correto.');
    } finally {
      setIsSearching(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-lg overflow-hidden shadow-2xl">
        <div className="px-6 py-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50">
          <h3 className="text-lg font-bold text-white">
            {supplier ? 'Editar Fornecedor' : 'Novo Fornecedor'}
          </h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 flex items-center space-x-3 mb-4">
              <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
              <p className="text-sm text-red-500 font-medium">{error}</p>
            </div>
          )}
          <div className="space-y-1.5 mb-4">
            <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">CNPJ</label>
            <div className="flex gap-2">
              <input 
                value={formData.cnpj}
                onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
                placeholder="00.000.000/0000-00"
                className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all outline-none"
              />
              <button
                type="button"
                onClick={handleCnpjLookup}
                disabled={isSearching}
                className="px-4 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors border border-zinc-700 flex items-center justify-center min-w-[100px]"
              >
                {isSearching ? (
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <>
                    <Search className="w-4 h-4 mr-2" />
                    <span>Buscar</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <Input 
            label="Razão Social *" 
            required
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Ex: Oficina do João LTDA"
          />

          <Input 
            label="Nome Fantasia" 
            value={formData.trade_name}
            onChange={(e) => setFormData({ ...formData, trade_name: e.target.value })}
            placeholder="Ex: Oficina do João"
          />
          
          <div className="grid grid-cols-2 gap-4">
            <Input 
              label="Telefone" 
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="(00) 00000-0000"
            />
            <Input 
              label="E-mail" 
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="contato@fornecedor.com"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <Input 
                label="Logradouro" 
                value={formData.street}
                onChange={(e) => setFormData({ ...formData, street: e.target.value })}
                placeholder="Ex: Rua das Flores"
              />
            </div>
            <Input 
              label="Número" 
              value={formData.number}
              onChange={(e) => setFormData({ ...formData, number: e.target.value })}
              placeholder="Ex: 123"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input 
              label="Bairro" 
              value={formData.neighborhood}
              onChange={(e) => setFormData({ ...formData, neighborhood: e.target.value })}
              placeholder="Ex: Centro"
            />
            <Input 
              label="CEP" 
              value={formData.zip_code}
              onChange={(e) => setFormData({ ...formData, zip_code: e.target.value })}
              placeholder="00000-000"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input 
              label="Cidade" 
              value={formData.city}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              placeholder="Ex: São Paulo"
            />
            <Input 
              label="Estado" 
              value={formData.state}
              onChange={(e) => setFormData({ ...formData, state: e.target.value })}
              placeholder="Ex: SP"
              maxLength={2}
            />
          </div>

          <div className="mt-4">
            <Select 
              name="status" 
              label="Status" 
              required 
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              options={[
                { value: 'Ativo', label: 'Ativo' },
                { value: 'Inativo', label: 'Inativo' }
              ]} 
            />
          </div>

          <div className="pt-4 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 text-zinc-400 hover:text-white transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 transition-colors font-medium disabled:opacity-50 flex items-center"
            >
              {isSaving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin mr-2"></div>
                  Salvando...
                </>
              ) : (
                'Salvar Fornecedor'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const SettingsView = ({ 
  onReset, 
  onSeed, 
  currentUser,
  settings,
  onUpdateSettings
}: { 
  onReset: () => void, 
  onSeed: () => void, 
  currentUser: UserType | null,
  settings: any,
  onUpdateSettings: (key: string, value: string) => Promise<void>
}) => {
  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-white mb-2">Configurações do Sistema</h2>
        <p className="text-zinc-400 text-lg italic serif">Gerencie as preferências e dados globais do sistema.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center space-x-3 mb-4">
            <div className="p-2 bg-zinc-800 rounded-lg">
              <Users className="w-5 h-5 text-zinc-400" />
            </div>
            <h3 className="text-lg font-bold text-white">Perfil do Usuário</h3>
          </div>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest block mb-1">Nome</label>
              <p className="text-white">{currentUser?.name || '-'}</p>
            </div>
            <div>
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest block mb-1">E-mail</label>
              <p className="text-white font-mono">{currentUser?.email || '-'}</p>
            </div>
            <div>
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest block mb-1">Nível de Acesso</label>
              <p className="text-emerald-500 font-medium">{currentUser?.profile_name || (currentUser?.is_admin ? 'Administrador' : 'Colaborador')}</p>
            </div>
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center space-x-3 mb-4">
            <div className="p-2 bg-zinc-800 rounded-lg">
              <LayoutDashboard className="w-5 h-5 text-zinc-400" />
            </div>
            <h3 className="text-lg font-bold text-white">Layout</h3>
          </div>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest block mb-2">Logo Personalizada</label>
              <p className="text-zinc-400 text-sm mb-4">Faça upload de uma imagem para substituir a logo padrão na tela de login e no menu lateral.</p>
              
              {settings?.customLogo && (
                <div className="mb-4 p-4 bg-zinc-950 rounded-xl border border-zinc-800 flex justify-center items-center">
                  <img src={settings.customLogo} alt="Logo Atual" className="max-h-24 object-contain" />
                </div>
              )}

              <div className="flex space-x-3">
                <label className="flex-1 cursor-pointer py-2 px-4 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl transition-all duration-300 font-medium text-center border border-zinc-700 flex items-center justify-center space-x-2">
                  <Upload className="w-4 h-4" />
                  <span>Escolher Imagem</span>
                  <input 
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          if (reader.result) {
                            onUpdateSettings('customLogo', reader.result as string);
                          }
                        };
                        reader.readAsDataURL(file);
                      }
                    }} 
                  />
                </label>
                {settings?.customLogo && (
                  <button 
                    onClick={() => onUpdateSettings('customLogo', '')}
                    className="py-2 px-4 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl transition-all duration-300 font-medium border border-red-500/20 flex items-center justify-center"
                    title="Remover Logo"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center space-x-3 mb-4">
            <div className="p-2 bg-zinc-800 rounded-lg">
              <FileText className="w-5 h-5 text-zinc-400" />
            </div>
            <h3 className="text-lg font-bold text-white">Sobre o Sistema</h3>
          </div>
          <div className="space-y-2 text-sm text-zinc-400">
            <p><span className="text-zinc-500 font-bold">Versão:</span> 1.2.0</p>
            <p><span className="text-zinc-500 font-bold">Última Atualização:</span> 12/03/2026</p>
            <p className="pt-4 italic serif">Desenvolvido para gestão eficiente de frotas e controle de custos operacionais.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function App() {
  const [currentUser, setCurrentUser] = useState<UserType | null>(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [toasts, setToasts] = useState<{ id: number; message: string; type: 'success' | 'error' }[]>([]);

  const addToast = (message: string, type: 'success' | 'error' = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  };
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const [lastRefreshTime, setLastRefreshTime] = useState<Date>(new Date());
  const [activeTab, setActiveTab] = useState('dashboard');
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [helpers, setHelpers] = useState<Helper[]>([]);
  const [plans, setPlans] = useState<MaintenancePlan[]>([]);
  const [maintenanceTypes, setMaintenanceTypes] = useState<any[]>([]);
  const [fleetCategories, setFleetCategories] = useState<FleetCategory[]>([]);
  const [responsibleCompanies, setResponsibleCompanies] = useState<ResponsibleCompany[]>([]);
  const [vehicleTypes, setVehicleTypes] = useState<VehicleType[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [users, setUsers] = useState<UserType[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [expiringDocsCount, setExpiringDocsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [plateQuery, setPlateQuery] = useState<string[]>([]);
  const [modelQuery, setModelQuery] = useState<string[]>([]);
  const [fuelTypeQuery, setFuelTypeQuery] = useState<string[]>([]);
  const [serviceQuery, setServiceQuery] = useState<string[]>([]);
  const [consumptionStatusFilter, setConsumptionStatusFilter] = useState<string[]>([]);
  const [fleetTypeQuery, setFleetTypeQuery] = useState<string[]>([]);
  const [branchQuery, setBranchQuery] = useState<string[]>([]);
  const [responsibleQuery, setResponsibleQuery] = useState<string[]>([]);
  const [vehicleSearchQuery, setVehicleSearchQuery] = useState('');
  const [driverSearchQuery, setDriverSearchQuery] = useState('');
  const [helperSearchQuery, setHelperSearchQuery] = useState('');
  const [maintenanceSearchQuery, setMaintenanceSearchQuery] = useState('');
  const [supplierSearchQuery, setSupplierSearchQuery] = useState('');
  const [period, setPeriod] = useState(30);

  // Modal states
  const [isVehicleModalOpen, setIsVehicleModalOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [isDriverModalOpen, setIsDriverModalOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [isHelperModalOpen, setIsHelperModalOpen] = useState(false);
  const [editingHelper, setEditingHelper] = useState<Helper | null>(null);
  const [isMaintenanceModalOpen, setIsMaintenanceModalOpen] = useState(false);
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserType | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [isAuxModalOpen, setIsAuxModalOpen] = useState(false);
  const [auxModalType, setAuxModalType] = useState<string>('');
  const [editingAuxRecord, setEditingAuxRecord] = useState<any>(null);
  const [selectedBrandId, setSelectedBrandId] = useState<string>('');
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const [isPlateMappingModalOpen, setIsPlateMappingModalOpen] = useState(false);
  const [potentialDuplicates, setPotentialDuplicates] = useState<any[]>([]);
  const [existingTransactionsCount, setExistingTransactionsCount] = useState<number>(0);
  const [pendingImportData, setPendingImportData] = useState<any[]>([]);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  const [maintenanceOrders, setMaintenanceOrders] = useState<any[]>([]);
  const [isMaintenanceEntryModalOpen, setIsMaintenanceEntryModalOpen] = useState(false);
  const [selectedOrderForAudit, setSelectedOrderForAudit] = useState<any | null>(null);
  const [editingMaintenanceOrder, setEditingMaintenanceOrder] = useState<any | null>(null);
  const [isMaintenanceCloseModalOpen, setIsMaintenanceCloseModalOpen] = useState(false);
  const [selectedOrderForClose, setSelectedOrderForClose] = useState<any | null>(null);
  const [preSelectedVehicleId, setPreSelectedVehicleId] = useState<number | undefined>(undefined);
  const [preSelectedMaintenanceTypeIds, setPreSelectedMaintenanceTypeIds] = useState<string | string[] | undefined>(undefined);
  const [preSelectedPlanId, setPreSelectedPlanId] = useState<number | undefined>(undefined);

  const criticalMaintenanceCount = plans.filter(p => p.status === 'VERMELHO').length;
  const warningMaintenanceCount = plans.filter(p => p.status === 'AMARELO').length;
  const totalAlerts = criticalMaintenanceCount + warningMaintenanceCount;

  // Confirmation modal state
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel?: () => void;
    confirmText?: string;
    cancelText?: string;
    variant?: 'danger' | 'primary';
  }>({
    title: '',
    message: '',
    onConfirm: () => {}
  });

  useEffect(() => {
    if (editingVehicle) {
      setSelectedBrandId(editingVehicle.brand_id?.toString() || '');
    }
  }, [editingVehicle]);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    const handleAuthError = () => {
      setCurrentUser(null);
      globalToken = '';
      localStorage.removeItem('fleet_token');
      addToast('Sua sessão expirou. Por favor, faça login novamente.', 'error');
    };

    window.addEventListener('auth-error', handleAuthError);

    return () => {
      window.removeEventListener('auth-error', handleAuthError);
    };
  }, []);

  const [settings, setSettings] = useState<any>({});

  const getInitialTab = (user: UserType | null) => {
    if (!user) return 'dashboard';
    if (user.is_admin === 1) return 'dashboard';
    
    const perms = user.permissions as any;
    if (!perms) return 'dashboard';

    if (perms.dashboard?.access) return 'dashboard';
    if (perms.reports?.access) return 'reports';
    if (perms.fueling?.access) return 'fuel';
    if (perms.maintenance_board?.access) return 'maintenance-board';
    if (perms.maintenance_plan?.access) return 'maintenance';
    if (perms.fleet_documents?.access) return 'fleet-documents';
    if (perms.registrations?.vehicles?.view) return 'vehicles';
    if (perms.registrations?.drivers?.view) return 'drivers';
    if (perms.registrations?.helpers?.view) return 'helpers';
    if (perms.registrations?.suppliers?.view) return 'suppliers';
    if (perms.registrations?.auxiliary_tables?.view) return 'auxiliary';
    
    return 'dashboard';
  };

  const checkAuth = async () => {
    try {
      const storedToken = localStorage.getItem('fleet_token');
      
      // Fetch settings first so they are available on the login screen
      const settingsRes = await fetchWithAuth('/api/settings');
      if (settingsRes.ok) {
        setSettings(await settingsRes.json());
      }

      if (!storedToken) {
        setIsAuthChecking(false);
        return;
      }

      const res = await fetchWithAuth('/api/auth/me');
      if (res.ok) {
        const user = await res.json();
        // Ensure token is preserved in state
        const userWithToken = { ...user, token: storedToken || user.token };
        globalToken = userWithToken.token;
        setCurrentUser(userWithToken);
        if (userWithToken.token) {
          localStorage.setItem('fleet_token', userWithToken.token);
        }
        
        // Ensure active tab is valid for this user
        const initialTab = getInitialTab(userWithToken);
        setActiveTab(prev => {
          // If current tab is dashboard but user has no access, switch to initial
          if (prev === 'dashboard' && !userWithToken.is_admin && !userWithToken.permissions?.dashboard?.access) {
            return initialTab;
          }
          return prev;
        });
      } else {
        setCurrentUser(null);
        globalToken = '';
        localStorage.removeItem('fleet_token');
      }
    } catch (e) {
      setCurrentUser(null);
    } finally {
      setIsAuthChecking(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetchWithAuth('/api/auth/logout', { method: 'POST' });
      setCurrentUser(null);
      globalToken = '';
      localStorage.removeItem('fleet_token');
      setActiveTab('dashboard');
    } catch (e) {
      console.error('Logout error:', e);
    }
  };

  const handleLogin = (user: UserType | null) => {
    console.log("[handleLogin] User logged in:", user?.email, !!user?.token);
    if (user?.token) {
      globalToken = user.token;
      localStorage.setItem('fleet_token', user.token);
    } else if (user === null) {
      globalToken = '';
      localStorage.removeItem('fleet_token');
    }
    setCurrentUser(user);
    if (user) {
      setActiveTab(getInitialTab(user));
    }
  };

  useEffect(() => {
    if (currentUser) {
      fetchDashboardStats();
      
      // Auto-refresh dashboard stats every 30 seconds
      const interval = setInterval(() => {
        fetchDashboardStats();
      }, 30000);
      
      return () => clearInterval(interval);
    }
  }, [currentUser, plateQuery, modelQuery, fuelTypeQuery, serviceQuery, fleetTypeQuery, branchQuery, responsibleQuery, period, consumptionStatusFilter]);

  useEffect(() => {
    if (currentUser) {
      fetchGlobalData();
      
      // Auto-refresh global data every 2 minutes
      const interval = setInterval(() => {
        fetchGlobalData();
      }, 120000);
      
      return () => clearInterval(interval);
    }
  }, [currentUser]);

  const hasPermission = (module: keyof AppPermissions, action: string = 'access') => {
    if (currentUser?.is_admin === 1) return true;
    const permissions = currentUser?.permissions as any;
    if (!permissions || !permissions[module]) return false;
    
    // Handle registrations sub-modules
    if (module === 'registrations' && action.includes('.')) {
      const [subModule, subAction] = action.split('.');
      return permissions.registrations?.[subModule]?.[subAction] === true;
    }

    return permissions[module]?.[action] === true;
  };

  const fetchDashboardStats = async () => {
    if (!currentUser) return;
    try {
      if (hasPermission('dashboard')) {
        const statsUrl = `/api/dashboard/stats?days=${period}&plate=${encodeURIComponent(plateQuery.join(','))}&model=${encodeURIComponent(modelQuery.join(','))}&fuelType=${encodeURIComponent(fuelTypeQuery.join(','))}&service=${encodeURIComponent(serviceQuery.join(','))}&fleetCategoryId=${fleetTypeQuery.join(',')}&branch=${encodeURIComponent(branchQuery.join(','))}&responsibleId=${responsibleQuery.join(',')}&consumptionStatus=${encodeURIComponent(consumptionStatusFilter.join(','))}`;
        
        const statsRes = await fetchWithAuth(statsUrl).catch(() => null);
        if (statsRes && statsRes.ok) {
          const sData = await statsRes.json().catch(() => null);
          if (sData) {
            setStats(sData);
            setLastRefreshTime(new Date());
          }
        }
      }
    } catch (e) {
      console.error('Error fetching dashboard stats:', e);
    } finally {
      // Always stop loading the dashboard once stats are fetched
      setLoading(false);
    }
  };

  const fetchGlobalData = async () => {
    if (!currentUser) return;
    try {
      // Fetch expiring documents for notifications
      if (hasPermission('fleet_documents')) {
        const expRes = await fetchWithAuth('/api/fleet-documents/expiring').catch(() => null);
        if (expRes && expRes.ok) {
          const expData = await expRes.json().catch(() => null);
          if (Array.isArray(expData)) setExpiringDocsCount(expData.length);
        }
      }

      // Fetch the rest in the background
      const endpoints = [
        { url: '/api/fleet-vehicles', hasPerm: hasPermission('registrations', 'vehicles.view') || hasPermission('maintenance_board') || hasPermission('maintenance_plan') },
        { url: '/api/maintenance/plans', hasPerm: hasPermission('maintenance_plan', 'view_active') },
        { url: '/api/drivers', hasPerm: hasPermission('registrations', 'drivers.view') || hasPermission('maintenance_board') || hasPermission('maintenance_plan') },
        { url: '/api/maintenance-types', hasPerm: hasPermission('registrations', 'auxiliary_tables.view') || hasPermission('maintenance_board') || hasPermission('maintenance_plan') },
        { url: '/api/fleet-categories', hasPerm: hasPermission('registrations', 'auxiliary_tables.view') || hasPermission('dashboard') || hasPermission('maintenance_board') || hasPermission('maintenance_plan') },
        { url: '/api/responsible-companies', hasPerm: hasPermission('registrations', 'auxiliary_tables.view') || hasPermission('dashboard') || hasPermission('maintenance_board') || hasPermission('maintenance_plan') },
        { url: '/api/vehicle-types', hasPerm: hasPermission('registrations', 'auxiliary_tables.view') || hasPermission('registrations', 'vehicles.view') || hasPermission('maintenance_board') || hasPermission('maintenance_plan') },
        { url: '/api/brands', hasPerm: hasPermission('registrations', 'auxiliary_tables.view') || hasPermission('registrations', 'vehicles.view') || hasPermission('maintenance_board') || hasPermission('maintenance_plan') },
        { url: '/api/models', hasPerm: hasPermission('registrations', 'auxiliary_tables.view') || hasPermission('registrations', 'vehicles.view') || hasPermission('dashboard') || hasPermission('maintenance_board') || hasPermission('maintenance_plan') },
        { url: '/api/suppliers', hasPerm: hasPermission('registrations', 'suppliers.view') || hasPermission('maintenance_board') },
        { url: '/api/helpers', hasPerm: hasPermission('registrations', 'helpers.view') || hasPermission('maintenance_board') || hasPermission('maintenance_plan') },
        { url: '/api/maintenance/history', hasPerm: hasPermission('maintenance_plan', 'view_history') || hasPermission('maintenance_board') },
        { url: '/api/users', hasPerm: currentUser.is_admin === 1 },
        { url: '/api/profiles', hasPerm: currentUser.is_admin === 1 },
        { url: '/api/document-types', hasPerm: hasPermission('registrations', 'auxiliary_tables.view') || hasPermission('fleet_documents', 'access') }
      ];

      const activeEndpoints = endpoints.filter(e => e.hasPerm);

      const responses = await Promise.all(activeEndpoints.map(e => fetchWithAuth(e.url).catch(err => {
        console.error(`Fetch error for ${e.url}:`, err);
        return { ok: false, status: 500, statusText: 'Fetch Error', url: e.url, json: () => Promise.resolve([]) } as any;
      })));

      const results: { [key: string]: any } = {};
      
      for (let i = 0; i < responses.length; i++) {
        const res = responses[i];
        const endpoint = activeEndpoints[i];
        if (res && res.ok) {
          try {
            const data = await res.json();
            results[endpoint.url] = data;
          } catch (e) {
            console.error(`Error parsing JSON for ${endpoint.url}:`, e);
          }
        }
      }

      if (Array.isArray(results['/api/fleet-vehicles'])) setVehicles(results['/api/fleet-vehicles']);
      if (Array.isArray(results['/api/maintenance/plans'])) setPlans(results['/api/maintenance/plans']);
      if (Array.isArray(results['/api/drivers'])) setDrivers(results['/api/drivers']);
      if (Array.isArray(results['/api/maintenance-types'])) setMaintenanceTypes(results['/api/maintenance-types']);
      if (Array.isArray(results['/api/fleet-categories'])) setFleetCategories(results['/api/fleet-categories']);
      if (Array.isArray(results['/api/responsible-companies'])) setResponsibleCompanies(results['/api/responsible-companies']);
      if (Array.isArray(results['/api/vehicle-types'])) setVehicleTypes(results['/api/vehicle-types']);
      if (Array.isArray(results['/api/brands'])) setBrands(results['/api/brands']);
      if (Array.isArray(results['/api/models'])) setModels(results['/api/models']);
      if (Array.isArray(results['/api/suppliers'])) setSuppliers(results['/api/suppliers']);
      if (Array.isArray(results['/api/helpers'])) setHelpers(results['/api/helpers']);
      if (Array.isArray(results['/api/maintenance/history'])) setMaintenanceOrders(results['/api/maintenance/history']);
      if (Array.isArray(results['/api/users'])) setUsers(results['/api/users']);
      if (Array.isArray(results['/api/profiles'])) setProfiles(results['/api/profiles']);
      if (Array.isArray(results['/api/document-types'])) setDocumentTypes(results['/api/document-types']);
      
      const lastUpdateRes = await fetchWithAuth('/api/system/last-update').catch(() => null);
      if (lastUpdateRes && lastUpdateRes.ok) {
        const luData = await lastUpdateRes.json().catch(() => null);
        if (luData) setLastUpdate(luData.lastUpdate);
        setLastRefreshTime(new Date());
      }

    } catch (e) {
      console.error('Error fetching global data:', e);
    }
  };

  const fetchData = async () => {
    // This is kept for backward compatibility if called elsewhere, but we split the logic
    await Promise.all([
      fetchDashboardStats(),
      fetchGlobalData()
    ]);
  };

  const handleCreate = async (endpoint: string, data: any, closeModal: () => void) => {
    try {
      const isVehicleUpdate = editingVehicle && endpoint === '/api/fleet-vehicles';
      const isDriverUpdate = editingDriver && endpoint === '/api/drivers';
      const isAuxUpdate = editingAuxRecord && (
        endpoint === '/api/brands' || 
        endpoint === '/api/models' || 
        endpoint === '/api/vehicle-types' || 
        endpoint === '/api/fleet-categories' ||
        endpoint === '/api/responsible-companies' ||
        endpoint === '/api/maintenance-types' ||
        endpoint === '/api/document-types'
      );
      
      let url = endpoint;
      let method = 'POST';

      if (isVehicleUpdate) {
        url = `${endpoint}/${editingVehicle.id}`;
        method = 'PUT';
      } else if (isDriverUpdate) {
        url = `${endpoint}/${editingDriver.id}`;
        method = 'PUT';
      } else if (editingHelper && endpoint === '/api/helpers') {
        url = `${endpoint}/${editingHelper.id}`;
        method = 'PUT';
      } else if (isAuxUpdate) {
        url = `${endpoint}/${editingAuxRecord.id}`;
        method = 'PUT';
      }

      const res = await fetchWithAuth(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (res.ok) {
        closeModal();
        setEditingVehicle(null);
        setEditingDriver(null);
        setEditingAuxRecord(null);
        fetchData();
      } else {
        const err = await res.json();
        alert(`Erro: ${err.error}`);
      }
    } catch (e) {
      alert('Erro ao salvar dados');
    }
  };

  const handleAddSupplier = async (data: any) => {
    try {
      const res = await fetchWithAuth('/api/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        await fetchData();
        setIsSupplierModalOpen(false);
        addToast('Fornecedor adicionado com sucesso!');
      } else {
        const err = await res.json();
        throw new Error(err.error);
      }
    } catch (e: any) {
      console.error('Error adding supplier:', e);
      throw e;
    }
  };

  const handleEditSupplier = async (data: any) => {
    if (!editingSupplier) return;
    try {
      const res = await fetchWithAuth(`/api/suppliers/${editingSupplier.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        await fetchData();
        setIsSupplierModalOpen(false);
        setEditingSupplier(null);
        addToast('Fornecedor atualizado com sucesso!');
      } else {
        const err = await res.json();
        throw new Error(err.error);
      }
    } catch (e: any) {
      console.error('Error editing supplier:', e);
      throw e;
    }
  };

  const handleSaveUser = async (userData: Partial<UserType>) => {
    const url = editingUser ? `/api/users/${editingUser.id}` : '/api/users';
    const method = editingUser ? 'PUT' : 'POST';
    
    try {
      const res = await fetchWithAuth(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData)
      });
      
      if (res.ok) {
        setIsUserModalOpen(false);
        fetchData();
        addToast(editingUser ? 'Usuário atualizado!' : 'Usuário criado!');
      } else {
        const err = await res.json();
        addToast(`Erro: ${err.error}`, 'error');
      }
    } catch (e) {
      console.error('Error saving user:', e);
      addToast('Erro ao salvar usuário', 'error');
    }
  };

  const handleSaveProfile = async (profileData: Partial<Profile>) => {
    const url = editingProfile ? `/api/profiles/${editingProfile.id}` : '/api/profiles';
    const method = editingProfile ? 'PUT' : 'POST';
    
    try {
      const res = await fetchWithAuth(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profileData)
      });
      
      if (res.ok) {
        setIsProfileModalOpen(false);
        fetchData();
        addToast(editingProfile ? 'Perfil atualizado!' : 'Perfil criado!');
      } else {
        const err = await res.json();
        addToast(`Erro: ${err.error}`, 'error');
      }
    } catch (e) {
      console.error('Error saving profile:', e);
      addToast('Erro ao salvar perfil', 'error');
    }
  };

  const handleDeleteComment = async (commentId: number, onSuccess?: () => void) => {
    setConfirmConfig({
      title: 'Excluir Mensagem',
      message: 'Tem certeza que deseja excluir esta mensagem?',
      onConfirm: async () => {
        try {
          const res = await fetchWithAuth(`/api/maintenance/comments/${commentId}`, {
            method: 'DELETE'
          });
          if (res.ok) {
            fetchData();
            if (onSuccess) onSuccess();
          } else {
            const err = await res.json();
            alert(err.error || "Erro ao excluir comentário");
          }
        } catch (err) {
          console.error(err);
        }
      }
    });
    setIsConfirmOpen(true);
  };

  const handleMaintenanceEntry = async (data: any) => {
    try {
      const url = editingMaintenanceOrder 
        ? `/api/maintenance/orders/${editingMaintenanceOrder.id}`
        : '/api/maintenance/open';
      const method = editingMaintenanceOrder ? 'PUT' : 'POST';

      const res = await fetchWithAuth(url, {
        method,
        body: JSON.stringify(data)
      });

      if (res.ok) {
        setIsMaintenanceEntryModalOpen(false);
        setEditingMaintenanceOrder(null);
        fetchData();
      } else {
        const err = await res.json();
        alert(`Erro: ${err.error}`);
      }
    } catch (e) {
      alert('Erro ao processar entrada em manutenção');
    }
  };

  const handleSaveMaintenancePlans = async (data: any) => {
    try {
      const res = await fetchWithAuth('/api/maintenance/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicle_id: data.vehicleId,
          maintenance_type_ids: data.maintenanceTypeIds,
          last_service_km: data.lastServiceKm,
          next_service_km: data.nextServiceKm
        })
      });

      if (res.ok) {
        setIsMaintenanceModalOpen(false);
        fetchData();
      } else {
        const err = await res.json();
        alert(`Erro ao salvar plano de manutenção: ${err.error}`);
      }
    } catch (e) {
      alert('Erro ao salvar plano de manutenção');
    }
  };

  const handleMaintenanceClose = async (data: any) => {
    if (!selectedOrderForClose) return;
    try {
      const res = await fetchWithAuth(`/api/maintenance/orders/${selectedOrderForClose.id}/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      if (res.ok) {
        setIsMaintenanceCloseModalOpen(false);
        setSelectedOrderForClose(null);
        fetchData();
      } else {
        const err = await res.json();
        alert(`Erro: ${err.error}`);
      }
    } catch (e) {
      alert('Erro ao processar baixa de manutenção');
    }
  };

  const handleDeleteSupplier = async (id: number) => {
    setConfirmConfig({
      title: 'Excluir Fornecedor',
      message: 'Deseja realmente excluir este fornecedor? Esta ação não pode ser desfeita.',
      onConfirm: async () => {
        try {
          const res = await fetchWithAuth(`/api/suppliers/${id}`, { method: 'DELETE' });
          if (res.ok) await fetchData();
          else {
            const err = await res.json();
            alert(`Erro: ${err.error}`);
          }
        } catch (e) {
          console.error('Error deleting supplier:', e);
        }
      }
    });
    setIsConfirmOpen(true);
  };

  const handleDeleteUser = async (id: number) => {
    setConfirmConfig({
      title: 'Excluir Usuário',
      message: 'Deseja realmente excluir este usuário? Esta ação não pode ser desfeita.',
      onConfirm: async () => {
        try {
          const res = await fetchWithAuth(`/api/users/${id}`, { method: 'DELETE' });
          if (res.ok) await fetchData();
          else {
            const err = await res.json();
            alert(`Erro: ${err.error}`);
          }
        } catch (e) {
          console.error('Error deleting user:', e);
        }
      }
    });
    setIsConfirmOpen(true);
  };

  const handleDeleteProfile = async (id: number) => {
    setConfirmConfig({
      title: 'Excluir Nível de Acesso',
      message: 'Deseja realmente excluir este nível de acesso? Esta ação não pode ser desfeita.',
      onConfirm: async () => {
        try {
          const res = await fetchWithAuth(`/api/profiles/${id}`, { method: 'DELETE' });
          if (res.ok) await fetchData();
          else {
            const err = await res.json();
            alert(`Erro: ${err.error}`);
          }
        } catch (e) {
          console.error('Error deleting profile:', e);
        }
      }
    });
    setIsConfirmOpen(true);
  };

  const handleToggleSupplierStatus = async (supplier: Supplier) => {
    const newStatus = supplier.status === 'Ativo' ? 'Inativo' : 'Ativo';
    setConfirmConfig({
      title: newStatus === 'Ativo' ? 'Ativar Fornecedor' : 'Desativar Fornecedor',
      message: `Deseja realmente ${newStatus === 'Ativo' ? 'ativar' : 'desativar'} o fornecedor ${supplier.name}?`,
      onConfirm: async () => {
        try {
          const res = await fetchWithAuth(`/api/suppliers/${supplier.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus }),
          });
          if (res.ok) await fetchData();
          else {
            const err = await res.json();
            alert(`Erro: ${err.error}`);
          }
        } catch (e) {
          console.error('Error toggling supplier status:', e);
        }
      }
    });
    setIsConfirmOpen(true);
  };

  const handleUpdateSettings = async (key: string, value: string) => {
    try {
      const res = await fetchWithAuth('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value })
      });
      if (res.ok) {
        setSettings((prev: any) => ({ ...prev, [key]: value }));
        addToast('Configuração salva com sucesso', 'success');
      } else {
        addToast('Erro ao salvar configuração', 'error');
      }
    } catch (e) {
      addToast('Erro ao salvar configuração', 'error');
    }
  };

  const handleSystemReset = () => {
    setConfirmConfig({
      title: 'Resetar Banco de Dados',
      message: 'Deseja realmente excluir TODOS os registros? Esta ação não pode ser desfeita e limpará todo o sistema.',
      onConfirm: async () => {
        const res = await fetchWithAuth('/api/system/reset', { method: 'POST' });
        if (res.ok) {
          alert('Banco de dados resetado com sucesso.');
          fetchData();
        } else {
          alert('Erro ao resetar banco de dados.');
        }
      }
    });
    setIsConfirmOpen(true);
  };

  const handleSeedData = async () => {
    setConfirmConfig({
      title: 'Gerar Dados de Exemplo',
      message: 'Deseja gerar registros fictícios para demonstração? Isso adicionará novos veículos e manutenções ao sistema.',
      onConfirm: async () => {
        const res = await fetchWithAuth('/api/seed', { method: 'POST' });
        if (res.ok) {
          alert('Dados de exemplo gerados com sucesso.');
          fetchData();
        } else {
          alert('Erro ao gerar dados de exemplo.');
        }
      }
    });
    setIsConfirmOpen(true);
  };

  const handleImport = async (data: any[]) => {
    console.log('[IMPORT] Iniciando importação com', data.length, 'registros');
    setIsImporting(true);
    setImportResult(null);
    try {
      // Step 1: Dry run to check for duplicates
      const dryRunRes = await fetchWithAuth('/api/fuel-records/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ records: data, dryRun: true })
      });
      
      if (!dryRunRes.ok) {
        const errorText = await dryRunRes.text().catch(() => 'Erro desconhecido');
        console.error('Dry run error response:', errorText);
        throw new Error('O servidor demorou muito para responder ou encontrou um erro interno. Tente novamente com menos registros ou verifique sua conexão.');
      }
      
      const dryRunResult = await dryRunRes.json();
      setExistingTransactionsCount(dryRunResult.existingTransactionsCount || 0);
      
      if (dryRunResult.potentialDuplicates && dryRunResult.potentialDuplicates.length > 0) {
        setPotentialDuplicates(dryRunResult.potentialDuplicates);
        setPendingImportData(data);
        setIsPlateMappingModalOpen(true);
        setIsImporting(false);
        return;
      }

      if (dryRunResult.existingTransactionsCount > 0) {
        setIsImporting(false);
        setConfirmConfig({
          title: 'Transações Duplicadas Detectadas',
          message: `Encontramos ${dryRunResult.existingTransactionsCount} transações que já existem no sistema. Deseja atualizar os registros existentes com os novos dados da planilha ou apenas ignorar as duplicatas e importar os novos registros?`,
          confirmText: 'Atualizar Existentes',
          cancelText: 'Ignorar Duplicatas',
          variant: 'primary',
          onConfirm: () => executeImport(data, undefined, false, true),
          onCancel: () => executeImport(data, undefined, false, false)
        });
        setIsConfirmOpen(true);
        return;
      }

      // Step 2: Proceed with import if no duplicates
      await executeImport(data);
    } catch (e: any) {
      console.error('Import error:', e);
      setImportResult({ error: e.message || 'Erro na importação. Verifique sua conexão e o formato do arquivo.' });
      setIsImporting(false);
    }
  };

  const executeImport = async (data: any[], confirmedMappings?: {[key: string]: string}, saveToDb: boolean = false, updateExisting: boolean = false) => {
    setIsImporting(true);
    setImportResult(null);
    try {
      // If saveToDb is true, save each mapping to the database first
      if (saveToDb && confirmedMappings) {
        for (const [original, mapped] of Object.entries(confirmedMappings)) {
          if (original !== mapped) {
            await fetchWithAuth('/api/fleet-vehicles/map-plate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ original_plate: original, mapped_plate: mapped })
            });
          }
        }
      }

      const res = await fetchWithAuth('/api/fuel-records/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ records: data, confirmedMappings, updateExisting })
      });
      
      if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        let errorMessage = 'Erro interno no servidor ao processar os dados.';
        
        try {
          if (errorText.startsWith('{')) {
            const errorData = JSON.parse(errorText);
            errorMessage = errorData.error || errorMessage;
          } else if (errorText.includes('<!DOCTYPE html>') || errorText.includes('<html>')) {
            errorMessage = 'O servidor demorou muito para responder (Timeout). Tente importar o arquivo em partes menores.';
          }
        } catch (parseError) {
          console.error('Error parsing error response:', parseError);
        }
        
        setImportResult({ error: errorMessage });
        return;
      }

      const result = await res.json();
      setImportResult(result);
      fetchData();
    } catch (e) {
      console.error('Import error:', e);
      setImportResult({ error: 'Erro na importação.' });
    } finally {
      setIsImporting(false);
    }
  };

  const filteredVehicles = vehicles.filter(v => 
    (v.plate || '').toLowerCase().includes((vehicleSearchQuery || '').toLowerCase()) ||
    (v.model_name || '').toLowerCase().includes((vehicleSearchQuery || '').toLowerCase()) ||
    (v.brand_name || '').toLowerCase().includes((vehicleSearchQuery || '').toLowerCase())
  );

  const filteredDrivers = drivers.filter(d => 
    (d.name || '').toLowerCase().includes((driverSearchQuery || '').toLowerCase()) ||
    (d.cpf || '').toLowerCase().includes((driverSearchQuery || '').toLowerCase())
  );

  const filteredPlans = plans.filter(p => 
    (p.plate || '').toLowerCase().includes((maintenanceSearchQuery || '').toLowerCase()) ||
    (p.type_name || '').toLowerCase().includes((maintenanceSearchQuery || '').toLowerCase())
  );

  const branches = Array.from(new Set([
    ...vehicles.map(v => v.branch),
    ...drivers.map(d => d.branch)
  ].filter(Boolean))).sort() as string[];

  const renderContent = () => {
    if (!currentUser) return null;

    const hasAccess = (tab: string) => {
      if (currentUser.is_admin === 1) return true;
      const perms = currentUser.permissions as any;
      if (!perms) return false;
      
      switch (tab) {
        case 'dashboard': return perms.dashboard?.access;
        case 'reports': return perms.reports?.access;
        case 'fuel': return perms.fueling?.access;
        case 'maintenance-board': return perms.maintenance_board?.access;
        case 'maintenance': return perms.maintenance_plan?.access;
        case 'fleet-documents': return perms.fleet_documents?.access;
        case 'vehicles': return perms.registrations?.vehicles?.view;
        case 'drivers': return perms.registrations?.drivers?.view;
        case 'helpers': return perms.registrations?.helpers?.view;
        case 'suppliers': return perms.registrations?.suppliers?.view;
        case 'auxiliary': return perms.registrations?.auxiliary_tables?.view;
        case 'users': return currentUser.is_admin === 1;
        case 'profiles': return currentUser.is_admin === 1;
        default: return true;
      }
    };

    if (!hasAccess(activeTab)) {
      return (
        <div className="flex flex-col items-center justify-center h-full space-y-4">
          <div className="p-4 bg-red-500/10 rounded-full">
            <ShieldAlert className="w-12 h-12 text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-white">Acesso Negado</h2>
          <p className="text-zinc-400">Você não tem permissão para acessar este módulo.</p>
          <button 
            onClick={() => setActiveTab(getInitialTab(currentUser))}
            className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 transition-colors"
          >
            Voltar para Início
          </button>
        </div>
      );
    }

    switch (activeTab) {
      case 'dashboard': return (
        <DashboardView 
          stats={stats} 
          period={period} 
          setPeriod={setPeriod} 
          vehicles={vehicles}
          models={models}
          fleetCategories={fleetCategories}
          responsibleCompanies={responsibleCompanies}
          plateQuery={plateQuery}
          setPlateQuery={setPlateQuery}
          modelQuery={modelQuery}
          setModelQuery={setModelQuery}
          fuelTypeQuery={fuelTypeQuery}
          setFuelTypeQuery={setFuelTypeQuery}
          serviceQuery={serviceQuery}
          setServiceQuery={setServiceQuery}
          fleetTypeQuery={fleetTypeQuery}
          setFleetTypeQuery={setFleetTypeQuery}
          responsibleQuery={responsibleQuery}
          setResponsibleQuery={setResponsibleQuery}
          branchQuery={branchQuery}
          setBranchQuery={setBranchQuery}
          consumptionStatusFilter={consumptionStatusFilter}
          setConsumptionStatusFilter={setConsumptionStatusFilter}
          plans={plans}
          maintenanceOrders={maintenanceOrders}
          lastRefreshTime={lastRefreshTime}
        />
      );
      case 'vehicles': return (
        <VehiclesView 
          vehicles={filteredVehicles} 
          searchQuery={vehicleSearchQuery}
          setSearchQuery={setVehicleSearchQuery}
          onAdd={() => { setEditingVehicle(null); setIsVehicleModalOpen(true); }} 
          onEdit={(v) => { setEditingVehicle(v); setIsVehicleModalOpen(true); }}
          onDelete={(id) => {
            setConfirmConfig({
              title: 'Excluir Veículo',
              message: 'Deseja realmente excluir este veículo? Esta ação não pode ser desfeita.',
              onConfirm: async () => {
                const res = await fetchWithAuth(`/api/fleet-vehicles/${id}`, { method: 'DELETE' });
                if (res.ok) fetchData();
                else {
                  const err = await res.json();
                  alert(`Erro: ${err.error}`);
                }
              }
            });
            setIsConfirmOpen(true);
          }}
          onToggleStatus={(v) => {
            setConfirmConfig({
              title: v.status === 'Ativo' ? 'Desativar Veículo' : 'Ativar Veículo',
              message: `Deseja realmente ${v.status === 'Ativo' ? 'desativar' : 'ativar'} o veículo ${v.plate}?`,
              onConfirm: async () => {
                const res = await fetchWithAuth(`/api/fleet-vehicles/${v.id}`, {
                  method: 'PUT',
                  body: JSON.stringify({ status: v.status === 'Ativo' ? 'Inativo' : 'Ativo' })
                });
                if (res.ok) fetchData();
                else {
                  const err = await res.json();
                  alert(`Erro: ${err.error}`);
                }
              }
            });
            setIsConfirmOpen(true);
          }}
          brands={brands}
          fleetCategories={fleetCategories}
          branches={stats?.branches || []}
          responsibleCompanies={responsibleCompanies}
          canCreate={hasPermission('registrations', 'vehicles.create')}
          canEdit={hasPermission('registrations', 'vehicles.edit')}
          canDelete={hasPermission('registrations', 'vehicles.delete')}
          canExport={hasPermission('registrations', 'vehicles.export')}
          onRefresh={fetchData}
        />
      );
      case 'fuel': return (
        <FuelImportView 
          onImport={handleImport} 
          onReset={handleSystemReset}
          canCreate={hasPermission('fueling', 'create')}
          canDelete={hasPermission('fueling', 'delete')}
          canExport={hasPermission('fueling', 'export')}
          vehicles={vehicles}
          branches={stats?.branches || []}
          models={models}
        />
      );
      case 'maintenance': return (
        <MaintenancePlansView 
          plans={filteredPlans} 
          searchQuery={maintenanceSearchQuery}
          setSearchQuery={setMaintenanceSearchQuery}
          suppliers={suppliers}
          responsibleCompanies={responsibleCompanies}
          onAdd={() => setIsMaintenanceModalOpen(true)} 
          onDelete={(id) => {
            setConfirmConfig({
              title: 'Excluir Plano',
              message: 'Deseja realmente excluir este plano de manutenção? O histórico de manutenções já realizadas não será afetado.',
              onConfirm: async () => {
                const res = await fetchWithAuth(`/api/maintenance/plans/${id}`, { method: 'DELETE' });
                if (res.ok) fetchData();
                else {
                  const err = await res.json();
                  alert(`Erro: ${err.error}`);
                }
              }
            });
            setIsConfirmOpen(true);
          }}
          onOpenOrder={(plan) => {
            setPreSelectedVehicleId(plan.vehicle_id);
            setPreSelectedMaintenanceTypeIds(plan.maintenance_type_ids);
            setPreSelectedPlanId(plan.id);
            setIsMaintenanceEntryModalOpen(true);
          }}
          canCreate={hasPermission('maintenance_plan', 'create')}
          canDelete={hasPermission('maintenance_plan', 'delete')}
          canExport={hasPermission('maintenance_plan', 'export')}
          canViewActive={hasPermission('maintenance_plan', 'view_active')}
          canViewHistory={hasPermission('maintenance_plan', 'view_history')}
          canSearch={hasPermission('maintenance_plan', 'search')}
        />
      );
      case 'maintenance-board': return (
        <MaintenanceBoardView 
          orders={maintenanceOrders}
          vehicles={vehicles}
          responsibleCompanies={responsibleCompanies}
          fleetCategories={fleetCategories}
          suppliers={suppliers}
          branches={stats?.branches || []}
          setSelectedOrderForAudit={setSelectedOrderForAudit}
          onAdd={() => setIsMaintenanceEntryModalOpen(true)}
          onEdit={(order) => {
            setEditingMaintenanceOrder(order);
            setIsMaintenanceEntryModalOpen(true);
          }}
          onDelete={(id) => {
            setConfirmConfig({
              title: 'Excluir Registro',
              message: 'Deseja realmente excluir este registro de manutenção? Esta ação não pode ser desfeita.',
              onConfirm: async () => {
                const res = await fetchWithAuth(`/api/maintenance/orders/${id}`, { method: 'DELETE' });
                if (res.ok) fetchData();
                else {
                  const err = await res.json();
                  alert(`Erro: ${err.error}`);
                }
              }
            });
            setIsConfirmOpen(true);
          }}
          onCloseOrder={(order) => {
            setSelectedOrderForClose(order);
            setIsMaintenanceCloseModalOpen(true);
          }}
          handleDeleteComment={handleDeleteComment}
          currentUser={currentUser}
          onImport={async (data) => {
            setLoading(true);
            try {
              for (const row of data) {
                const plate = row['Placa']?.toString().trim();
                if (!plate) continue;

                // Find vehicle
                const vehicle = vehicles.find(v => (v.plate || '').toUpperCase().replace(/[^A-Z0-9]/g, '') === (plate || '').toUpperCase().replace(/[^A-Z0-9]/g, ''));
                if (!vehicle) {
                  console.warn(`Veículo não encontrado: ${plate}`);
                  continue;
                }

                // Find driver
                const driverName = row['Motorista']?.toString().trim();
                const driver = drivers.find(d => (d.name || '').toUpperCase() === (driverName || '').toUpperCase());

                // Find maintenance type
                const typeName = row['Serviço']?.toString().trim();
                const type = maintenanceTypes.find(t => (t.name || '').toUpperCase() === (typeName || '').toUpperCase());

                // Find supplier
                const supplierName = row['Fornecedor']?.toString().trim();
                const supplier = suppliers.find(s => (s.name || '').toUpperCase() === (supplierName || '').toUpperCase());

                const payload = {
                  vehicleId: vehicle.id,
                  maintenanceTypeId: type?.id,
                  driverId: driver?.id,
                  supplierId: supplier?.id,
                  supplier: supplierName || supplier?.name,
                  openDate: parseExcelDate(row['Data de Entrada']) || getLocalISODate(),
                  estimatedCompletionDate: parseExcelDate(row['Previsão de Saída']),
                  notes: row['Descrição']
                };

                await fetchWithAuth('/api/maintenance/open', {
                  method: 'POST',
                  body: JSON.stringify(payload)
                });
              }
              await fetchData();
            } catch (error) {
              console.error('Erro ao importar manutenções:', error);
            } finally {
              setLoading(false);
            }
          }}
          canCreate={hasPermission('maintenance_board', 'create')}
          canEdit={hasPermission('maintenance_board', 'edit')}
          canDelete={hasPermission('maintenance_board', 'delete')}
          canImport={hasPermission('maintenance_board', 'import')}
          canExport={hasPermission('maintenance_board', 'export')}
          canDownloadTemplate={hasPermission('maintenance_board', 'download_template')}
          canSearch={hasPermission('maintenance_board', 'search')}
        />
      );
      case 'fleet-documents': return (
        <FleetDocumentsView 
          vehicles={vehicles}
          drivers={drivers}
          documentTypes={documentTypes}
          fleetCategories={fleetCategories}
          branches={branches}
          onRefresh={fetchData}
          canCreate={hasPermission('fleet_documents', 'create')}
          canEdit={hasPermission('fleet_documents', 'edit')}
          canDelete={hasPermission('fleet_documents', 'delete')}
        />
      );
      case 'drivers': return (
        <DriversView 
          drivers={filteredDrivers} 
          searchQuery={driverSearchQuery}
          setSearchQuery={setDriverSearchQuery}
          onAdd={() => { setEditingDriver(null); setIsDriverModalOpen(true); }} 
          onEdit={(d) => { setEditingDriver(d); setIsDriverModalOpen(true); }}
          onDelete={(id) => {
            setConfirmConfig({
              title: 'Excluir Motorista',
              message: 'Deseja realmente excluir este motorista? Esta ação não pode ser desfeita.',
              onConfirm: async () => {
                const res = await fetchWithAuth(`/api/drivers/${id}`, { method: 'DELETE' });
                if (res.ok) fetchData();
                else {
                  const err = await res.json();
                  alert(`Erro: ${err.error}`);
                }
              }
            });
            setIsConfirmOpen(true);
          }}
          onToggleStatus={(d) => {
            setConfirmConfig({
              title: d.status === 'Ativo' ? 'Desativar Motorista' : 'Ativar Motorista',
              message: `Deseja realmente ${d.status === 'Ativo' ? 'desativar' : 'ativar'} o motorista ${d.name}?`,
              onConfirm: async () => {
                const res = await fetchWithAuth(`/api/drivers/${d.id}`, {
                  method: 'PUT',
                  body: JSON.stringify({ status: d.status === 'Ativo' ? 'Inativo' : 'Ativo' })
                });
                if (res.ok) fetchData();
                else {
                  const err = await res.json();
                  alert(`Erro: ${err.error}`);
                }
              }
            });
            setIsConfirmOpen(true);
          }}
          branches={stats?.branches || []}
          fleetCategories={fleetCategories}
          canCreate={hasPermission('registrations', 'drivers.create')}
          canEdit={hasPermission('registrations', 'drivers.edit')}
          canDelete={hasPermission('registrations', 'drivers.delete')}
          canExport={hasPermission('registrations', 'drivers.export')}
          onRefresh={fetchData}
        />
      );
      case 'helpers': return (
        <HelpersView 
          helpers={helpers} 
          searchQuery={helperSearchQuery}
          setSearchQuery={setHelperSearchQuery}
          onAdd={() => { setEditingHelper(null); setIsHelperModalOpen(true); }} 
          onEdit={(h) => { setEditingHelper(h); setIsHelperModalOpen(true); }}
          onDelete={(id) => {
            setConfirmConfig({
              title: 'Excluir Ajudante',
              message: 'Deseja realmente excluir este ajudante? Esta ação não pode ser desfeita.',
              onConfirm: async () => {
                const res = await fetchWithAuth(`/api/helpers/${id}`, { method: 'DELETE' });
                if (res.ok) fetchData();
                else {
                  const err = await res.json();
                  if (err.error?.includes('violates foreign key constraint')) {
                    alert('Não é possível excluir este ajudante pois ele possui registros vinculados (ex: abastecimentos). Tente desativá-lo em vez de excluir.');
                  } else {
                    alert(`Erro: ${err.error}`);
                  }
                }
              }
            });
            setIsConfirmOpen(true);
          }}
          onToggleStatus={(h) => {
            setConfirmConfig({
              title: h.status === 'Ativo' ? 'Desativar Ajudante' : 'Ativar Ajudante',
              message: `Deseja realmente ${h.status === 'Ativo' ? 'desativar' : 'ativar'} o ajudante ${h.name}?`,
              onConfirm: async () => {
                const res = await fetchWithAuth(`/api/helpers/${h.id}`, {
                  method: 'PUT',
                  body: JSON.stringify({ status: h.status === 'Ativo' ? 'Inativo' : 'Ativo' })
                });
                if (res.ok) fetchData();
                else {
                  const err = await res.json();
                  alert(`Erro: ${err.error}`);
                }
              }
            });
            setIsConfirmOpen(true);
          }}
          branches={stats?.branches || []}
          canCreate={hasPermission('registrations', 'helpers.create')}
          canEdit={hasPermission('registrations', 'helpers.edit')}
          canDelete={hasPermission('registrations', 'helpers.delete')}
          canExport={hasPermission('registrations', 'helpers.export')}
        />
      );
      case 'suppliers': return (
        <SuppliersView 
          suppliers={suppliers}
          searchQuery={supplierSearchQuery}
          setSearchQuery={setSupplierSearchQuery}
          onAdd={() => { setEditingSupplier(null); setIsSupplierModalOpen(true); }}
          onEdit={(s) => { setEditingSupplier(s); setIsSupplierModalOpen(true); }}
          onDelete={handleDeleteSupplier}
          onToggleStatus={handleToggleSupplierStatus}
          canCreate={hasPermission('registrations', 'suppliers.create')}
          canEdit={hasPermission('registrations', 'suppliers.edit')}
          canDelete={hasPermission('registrations', 'suppliers.delete')}
          canExport={hasPermission('registrations', 'suppliers.export')}
        />
      );
      case 'auxiliary': return (
        <AuxiliaryTablesView 
          fleetCategories={fleetCategories}
          responsibleCompanies={responsibleCompanies}
          vehicleTypes={vehicleTypes}
          brands={brands}
          models={models}
          maintenanceTypes={maintenanceTypes}
          documentTypes={documentTypes}
          onAdd={(type) => {
            setAuxModalType(type);
            setEditingAuxRecord(null);
            setIsAuxModalOpen(true);
          }}
          onEdit={(type, item) => {
            setAuxModalType(type);
            setEditingAuxRecord(item);
            setIsAuxModalOpen(true);
          }}
          onDelete={(type, id) => {
            setConfirmConfig({
              title: 'Excluir Registro',
              message: 'Deseja realmente excluir este registro? Esta ação não pode ser desfeita.',
              onConfirm: async () => {
                let endpoint = `/api/${type}s`;
                if (type === 'fleet-category') endpoint = '/api/fleet-categories';
                if (type === 'responsible-company') endpoint = '/api/responsible-companies';
                if (type === 'vehicle-type') endpoint = '/api/vehicle-types';
                if (type === 'maintenance-type') endpoint = '/api/maintenance-types';
                const res = await fetchWithAuth(`${endpoint}/${id}`, { method: 'DELETE' });
                if (res.ok) fetchData();
                else {
                  const err = await res.json();
                  alert(`Erro: ${err.error || 'Falha ao excluir'}`);
                }
              }
            });
            setIsConfirmOpen(true);
          }}
          onToggleStatus={(type, item) => {
            setConfirmConfig({
              title: item.status === 'Inativo' ? 'Ativar Registro' : 'Desativar Registro',
              message: `Deseja realmente ${item.status === 'Inativo' ? 'ativar' : 'desativar'} o registro "${item.name}"?`,
              onConfirm: async () => {
                let endpoint = `/api/${type}s`;
                if (type === 'fleet-category') endpoint = '/api/fleet-categories';
                if (type === 'responsible-company') endpoint = '/api/responsible-companies';
                if (type === 'vehicle-type') endpoint = '/api/vehicle-types';
                if (type === 'maintenance-type') endpoint = '/api/maintenance-types';
                const res = await fetchWithAuth(`${endpoint}/${item.id}`, {
                  method: 'PUT',
                  body: JSON.stringify({ status: item.status === 'Inativo' ? 'Ativo' : 'Inativo' })
                });
                if (res.ok) fetchData();
                else {
                  const err = await res.json();
                  alert(`Erro: ${err.error || 'Falha ao atualizar status'}`);
                }
              }
            });
            setIsConfirmOpen(true);
          }}
          canCreate={hasPermission('registrations', 'auxiliary_tables.create')}
          canEdit={hasPermission('registrations', 'auxiliary_tables.edit')}
          canDelete={hasPermission('registrations', 'auxiliary_tables.delete')}
          canExport={hasPermission('registrations', 'auxiliary_tables.export')}
        />
      );
      case 'reports': return <ReportsView />;
      case 'users': return (
        <UsersView 
          users={users}
          onAdd={() => { setEditingUser(null); setIsUserModalOpen(true); }}
          onEdit={(u) => { setEditingUser(u); setIsUserModalOpen(true); }}
          onDelete={handleDeleteUser}
        />
      );
      case 'profiles': return (
        <ProfilesView 
          profiles={profiles}
          onAdd={() => { setEditingProfile(null); setIsProfileModalOpen(true); }}
          onEdit={(p) => { setEditingProfile(p); setIsProfileModalOpen(true); }}
          onDelete={handleDeleteProfile}
        />
      );
      case 'settings': return <SettingsView onReset={handleSystemReset} onSeed={handleSeedData} currentUser={currentUser} settings={settings} onUpdateSettings={handleUpdateSettings} />;
      default: return (
        <DashboardView 
          stats={stats} 
          period={period} 
          setPeriod={setPeriod} 
          vehicles={vehicles}
          models={models}
          fleetCategories={fleetCategories}
          responsibleCompanies={responsibleCompanies}
          plateQuery={plateQuery}
          setPlateQuery={setPlateQuery}
          modelQuery={modelQuery}
          setModelQuery={setModelQuery}
          fuelTypeQuery={fuelTypeQuery}
          setFuelTypeQuery={setFuelTypeQuery}
          serviceQuery={serviceQuery}
          setServiceQuery={setServiceQuery}
          fleetTypeQuery={fleetTypeQuery}
          setFleetTypeQuery={setFleetTypeQuery}
          branchQuery={branchQuery}
          setBranchQuery={setBranchQuery}
          responsibleQuery={responsibleQuery}
          setResponsibleQuery={setResponsibleQuery}
          consumptionStatusFilter={consumptionStatusFilter}
          setConsumptionStatusFilter={setConsumptionStatusFilter}
          plans={plans}
          maintenanceOrders={maintenanceOrders}
          lastRefreshTime={lastRefreshTime}
        />
      );
    }
  };

  if (isAuthChecking) {
    return (
      <div className="h-screen bg-black flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-48 flex items-center justify-center animate-pulse">
            {settings?.customLogo ? (
              <img src={settings.customLogo} alt="Logo" className="w-full h-auto object-contain max-h-24" />
            ) : (
              <GenericLogo className="w-full h-auto" />
            )}
          </div>
          <p className="text-zinc-500 text-sm font-medium animate-pulse">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <LoginView onLogin={handleLogin} settings={settings} />;
  }

  return (
    <div className="flex h-screen bg-black text-zinc-100 font-sans selection:bg-emerald-500/30 overflow-hidden">
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-zinc-950 border-b border-zinc-800 z-50 flex items-center justify-between px-4">
        <div className="w-32">
          {settings?.customLogo ? (
            <img src={settings.customLogo} alt="Logo" className="w-full h-auto object-contain max-h-12" />
          ) : (
            <GenericLogo className="w-full h-auto" />
          )}
        </div>
        <button 
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 text-zinc-400 hover:text-white transition-colors"
        >
          {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Toasts */}
      <div className="fixed bottom-6 right-6 z-[100] space-y-3">
        {toasts.map(toast => (
          <div 
            key={toast.id}
            className={`flex items-center space-x-3 px-4 py-3 rounded-xl shadow-2xl border backdrop-blur-md animate-in slide-in-from-right duration-300 ${
              toast.type === 'success' 
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                : 'bg-red-500/10 border-red-500/20 text-red-400'
            }`}
          >
            {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
            <p className="text-sm font-medium">{toast.message}</p>
          </div>
        ))}
      </div>

      {/* Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed lg:static inset-y-0 left-0 w-64 bg-zinc-950 border-r border-zinc-800 flex flex-col z-[70] transition-transform duration-300 lg:translate-x-0",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-6 hidden lg:block">
          <div className="flex flex-col items-center mb-8">
            <div className="w-48 flex items-center justify-center mb-4">
              {settings?.customLogo ? (
                <img src={settings.customLogo} alt="Logo" className="w-full h-auto object-contain max-h-24" />
              ) : (
                <GenericLogo className="w-full h-auto" />
              )}
            </div>
          </div>
        </div>

        <div className="p-6 lg:pt-0 flex-1 flex flex-col overflow-y-auto custom-scrollbar">
          <div className="lg:hidden mb-8 flex justify-center">
            <div className="w-40">
              {settings?.customLogo ? (
                <img src={settings.customLogo} alt="Logo" className="w-full h-auto object-contain max-h-20" />
              ) : (
                <GenericLogo className="w-full h-auto" />
              )}
            </div>
          </div>
          
          <nav className="space-y-6">
            <div>
              <p className="px-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Visão Geral</p>
              {hasPermission('dashboard') && <SidebarItem icon={LayoutDashboard} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => { setActiveTab('dashboard'); setIsMobileMenuOpen(false); }} />}
              {hasPermission('reports') && <SidebarItem icon={FileText} label="Relatórios" active={activeTab === 'reports'} onClick={() => { setActiveTab('reports'); setIsMobileMenuOpen(false); }} />}
            </div>

            <div>
              <p className="px-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Operacional</p>
              {hasPermission('fueling') && <SidebarItem icon={Fuel} label="Abastecimentos" active={activeTab === 'fuel'} onClick={() => { setActiveTab('fuel'); setIsMobileMenuOpen(false); }} />}
              {hasPermission('maintenance_board') && <SidebarItem icon={LayoutDashboard} label="Quadro de Manutenção" active={activeTab === 'maintenance-board'} onClick={() => { setActiveTab('maintenance-board'); setIsMobileMenuOpen(false); }} />}
              {hasPermission('maintenance_plan') && <SidebarItem icon={Wrench} label="Plano de Manutenção" active={activeTab === 'maintenance'} onClick={() => { setActiveTab('maintenance'); setIsMobileMenuOpen(false); }} badge={totalAlerts} />}
              {hasPermission('fleet_documents') && <SidebarItem icon={FileCheck} label="Controle Documental" active={activeTab === 'fleet-documents'} onClick={() => { setActiveTab('fleet-documents'); setIsMobileMenuOpen(false); }} badge={expiringDocsCount} />}
            </div>

            <div>
              <p className="px-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Cadastros</p>
              {hasPermission('registrations', 'vehicles.view') && <SidebarItem icon={Truck} label="Veículos" active={activeTab === 'vehicles'} onClick={() => { setActiveTab('vehicles'); setIsMobileMenuOpen(false); }} />}
              {hasPermission('registrations', 'drivers.view') && <SidebarItem icon={User} label="Motoristas" active={activeTab === 'drivers'} onClick={() => { setActiveTab('drivers'); setIsMobileMenuOpen(false); }} />}
              {hasPermission('registrations', 'helpers.view') && <SidebarItem icon={Users} label="Ajudantes" active={activeTab === 'helpers'} onClick={() => { setActiveTab('helpers'); setIsMobileMenuOpen(false); }} />}
              {hasPermission('registrations', 'suppliers.view') && <SidebarItem icon={Briefcase} label="Fornecedores" active={activeTab === 'suppliers'} onClick={() => { setActiveTab('suppliers'); setIsMobileMenuOpen(false); }} />}
              {hasPermission('registrations', 'auxiliary_tables.view') && <SidebarItem icon={Database} label="Tabelas Auxiliares" active={activeTab === 'auxiliary'} onClick={() => { setActiveTab('auxiliary'); setIsMobileMenuOpen(false); }} />}
            </div>

            {currentUser?.is_admin === 1 && (
              <div>
                <p className="px-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Configurações</p>
                <SidebarItem icon={Users} label="Usuários" active={activeTab === 'users'} onClick={() => { setActiveTab('users'); setIsMobileMenuOpen(false); }} />
                <SidebarItem icon={ShieldCheck} label="Níveis de Acesso" active={activeTab === 'profiles'} onClick={() => { setActiveTab('profiles'); setIsMobileMenuOpen(false); }} />
              </div>
            )}
          </nav>
        </div>
        
        <div className="mt-auto p-6 border-t border-zinc-800 space-y-2">
          <div className="flex items-center space-x-3 px-4 mb-4 py-2 bg-zinc-900/50 rounded-lg border border-zinc-800/50">
            <div className="w-8 h-8 rounded-full bg-emerald-600/20 flex items-center justify-center text-emerald-500 font-bold text-xs">
              {currentUser.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-white truncate">{currentUser.name}</p>
              <p className="text-[10px] text-zinc-500 truncate">{currentUser.email}</p>
            </div>
          </div>
          {currentUser?.is_admin === 1 && (
            <SidebarItem icon={Settings} label="Configurações" active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />
          )}
          <button 
            onClick={handleLogout}
            className="w-full flex items-center space-x-3 px-4 py-2.5 text-sm font-medium rounded-xl transition-all duration-200 text-rose-500 hover:bg-rose-500/10"
          >
            <LogOut className="w-5 h-5" />
            <span>Sair</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-zinc-950 pb-40 pt-16 lg:pt-0">
        <header className="h-16 border-b border-zinc-800 flex items-center justify-between px-4 lg:px-8 bg-zinc-950/50 backdrop-blur-md sticky top-0 z-10">
          <div className="flex items-center space-x-4">
            <button 
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden p-2 text-zinc-400 hover:text-white transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h2 className="text-sm font-medium text-zinc-400 capitalize truncate">{activeTab.replace('-', ' ')}</h2>
            {lastUpdate && (
              <div className="hidden lg:flex items-center px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
                <Clock className="w-3 h-3 text-emerald-500 mr-2" />
                <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">
                  Última Atualização: {new Date(lastUpdate).toLocaleString('pt-BR')}
                </span>
              </div>
            )}
          </div>
          
          <div className="flex items-center space-x-2 md:space-x-4">
            <div className="relative">
              <button 
                onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                className={cn(
                  "relative p-2 transition-colors rounded-lg",
                  isNotificationsOpen ? "bg-zinc-800 text-white" : "text-zinc-400 hover:text-white hover:bg-zinc-900"
                )}
              >
                <AlertTriangle className="w-5 h-5" />
                {totalAlerts > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full border-2 border-zinc-950"></span>
                )}
              </button>

              {isNotificationsOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-20" 
                    onClick={() => setIsNotificationsOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-72 md:w-80 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl z-30 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="p-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50">
                      <h3 className="text-sm font-bold text-white">Alertas de Manutenção</h3>
                      <span className="text-[10px] bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full uppercase tracking-wider">
                        {totalAlerts} pendentes
                      </span>
                    </div>
                    <div className="max-h-[300px] md:max-h-[400px] overflow-y-auto p-2 space-y-1">
                      {plans.filter(p => p.status !== 'VERDE').length === 0 ? (
                        <div className="py-8 text-center">
                          <CheckCircle2 className="w-8 h-8 text-emerald-500/20 mx-auto mb-2" />
                          <p className="text-xs text-zinc-500">Nenhum alerta crítico no momento</p>
                        </div>
                      ) : (
                        plans
                          .filter(p => p.status !== 'VERDE')
                          .sort((a, b) => (a.status === 'VERMELHO' ? -1 : 1))
                          .map(plan => (
                            <button
                              key={plan.id}
                              onClick={() => {
                                setActiveTab('maintenance');
                                setIsNotificationsOpen(false);
                              }}
                              className="w-full p-3 flex items-start space-x-3 hover:bg-zinc-800 rounded-xl transition-colors text-left group"
                            >
                              <div className={cn(
                                "w-2 h-2 rounded-full mt-1.5 flex-shrink-0",
                                plan.status === 'VERMELHO' ? "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]" : "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]"
                              )} />
                              <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-start">
                                  <p className="text-sm font-bold text-white truncate">{plan.plate}</p>
                                  <span className={cn(
                                    "text-[10px] font-bold px-1.5 py-0.5 rounded uppercase",
                                    plan.status === 'VERMELHO' ? "bg-rose-500/10 text-rose-500" : "bg-amber-500/10 text-amber-500"
                                  )}>
                                    {plan.status === 'VERMELHO' ? 'Vencido' : 'Próximo'}
                                  </span>
                                </div>
                                <p className="text-xs text-zinc-400 truncate">{plan.type_name}</p>
                                <p className="text-[10px] text-zinc-500 mt-1">
                                  {plan.status === 'VERMELHO' 
                                    ? `Vencido há ${formatNumber(Math.abs(plan.next_service_km - plan.current_km))} KM`
                                    : `Vence em ${formatNumber(Math.abs(plan.next_service_km - plan.current_km))} KM`
                                  }
                                </p>
                              </div>
                            </button>
                          ))
                      )}
                    </div>
                    <div className="p-2 border-t border-zinc-800 bg-zinc-900/50">
                      <button 
                        onClick={() => {
                          setActiveTab('maintenance');
                          setIsNotificationsOpen(false);
                        }}
                        className="w-full py-2 text-xs font-bold text-emerald-500 hover:text-emerald-400 transition-colors"
                      >
                        Ver todas as manutenções
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
            <div className="flex items-center space-x-3 pl-4 border-l border-zinc-800">
              <div className="text-right">
                <p className="text-sm font-medium text-white">{currentUser?.name || 'Usuário'}</p>
                <p className="text-xs text-zinc-500">{currentUser?.profile_name || (currentUser?.is_admin ? 'Administrador' : 'Colaborador')}</p>
              </div>
              <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xs font-bold text-emerald-500">
                {currentUser?.name?.charAt(0).toUpperCase() || 'U'}
              </div>
            </div>
          </div>
        </header>

        <div className="p-8 max-w-7xl mx-auto">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-emerald-500"></div>
            </div>
          ) : renderContent()}
        </div>
      </main>

      {/* Modals */}
      <Modal 
        isOpen={isVehicleModalOpen} 
        onClose={() => { setIsVehicleModalOpen(false); setEditingVehicle(null); setSelectedBrandId(''); }} 
        title={editingVehicle ? "Editar Veículo" : "Novo Veículo"}
      >
        <form onSubmit={(e) => {
          e.preventDefault();
          const formData = new FormData(e.currentTarget);
          handleCreate('/api/fleet-vehicles', Object.fromEntries(formData), () => setIsVehicleModalOpen(false));
        }}>
          <Input name="plate" label="Placa" required defaultValue={editingVehicle?.plate} disabled={!!editingVehicle} />
          <div className="grid grid-cols-2 gap-4">
            <Select 
              name="brand_id" 
              label="Marca" 
              required 
              defaultValue={editingVehicle?.brand_id} 
              onChange={(e) => setSelectedBrandId(e.target.value)}
              options={brands.map(b => ({ value: b.id, label: b.name }))} 
            />
            <Select 
              name="model_id" 
              label="Modelo" 
              required 
              defaultValue={editingVehicle?.model_id} 
              options={models
                .filter(m => !selectedBrandId || String(m.brand_id) === String(selectedBrandId))
                .map(m => ({ value: m.id, label: m.name }))} 
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input name="manufacture_year" label="Ano Fab." type="number" defaultValue={editingVehicle?.manufacture_year} />
            <Input name="model_year" label="Ano Mod." type="number" defaultValue={editingVehicle?.model_year} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input name="renavam" label="Renavam" defaultValue={editingVehicle?.renavam} />
            <Input name="chassis" label="Chassi" defaultValue={editingVehicle?.chassis} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select 
              name="fleet_category_id" 
              label="Tipo Frota" 
              required 
              defaultValue={editingVehicle?.fleet_category_id} 
              options={fleetCategories.map(c => ({ value: c.id, label: c.name }))} 
            />
            <Select 
              name="responsible_company_id" 
              label="Empresa Responsável" 
              required 
              defaultValue={editingVehicle?.responsible_company_id} 
              options={responsibleCompanies.map(rc => ({ value: rc.id, label: rc.name }))} 
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select 
              name="vehicle_type_id" 
              label="Tipo Veículo" 
              required 
              defaultValue={editingVehicle?.vehicle_type_id} 
              options={vehicleTypes.map(t => ({ value: t.id, label: t.name }))} 
            />
            <Select name="driver_id" label="Motorista Fixo" defaultValue={editingVehicle?.driver_id} options={drivers.map(d => ({ value: d.id, label: d.name }))} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input name="current_km" label="KM Atual" type="number" required defaultValue={editingVehicle?.current_km} />
            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-500 uppercase">Filial</label>
              <input 
                name="branch" 
                list="branch-list"
                defaultValue={editingVehicle?.branch}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-emerald-500/20 outline-none"
                placeholder="Selecione ou digite..."
              />
              <datalist id="branch-list">
                {stats?.branches?.map(b => (
                  <option key={b} value={b} />
                ))}
              </datalist>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select 
              name="status" 
              label="Status" 
              required 
              defaultValue={editingVehicle?.status || 'Ativo'} 
              options={[
                { value: 'Ativo', label: 'Ativo' },
                { value: 'Inativo', label: 'Inativo' },
                { value: 'Em Manutenção', label: 'Em Manutenção' }
              ]} 
            />
          </div>
          <div className="mt-4">
            <label className="text-xs font-medium text-zinc-500 uppercase block mb-1">Observações</label>
            <textarea 
              name="notes"
              defaultValue={editingVehicle?.notes}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-emerald-500/20 outline-none min-h-[100px]"
              placeholder="Informações relevantes e explicativas..."
            />
          </div>
          <button type="submit" className="w-full py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-500 transition-colors mt-4">
            {editingVehicle ? "Salvar Alterações" : "Cadastrar Veículo"}
          </button>
        </form>

        {editingVehicle && (
          <EntityDocumentsSection 
            entityId={editingVehicle.id} 
            entityType="vehicle"
            documentTypes={documentTypes}
            onRefresh={fetchData}
            canCreate={hasPermission('fleet_documents', 'create')}
            canEdit={hasPermission('fleet_documents', 'edit')}
            canDelete={hasPermission('fleet_documents', 'delete')}
          />
        )}
      </Modal>

      <Modal 
        isOpen={isDriverModalOpen} 
        onClose={() => { setIsDriverModalOpen(false); setEditingDriver(null); }} 
        title={editingDriver ? "Editar Motorista" : "Novo Motorista"}
      >
        <form onSubmit={(e) => {
          e.preventDefault();
          const formData = new FormData(e.currentTarget);
          handleCreate('/api/drivers', Object.fromEntries(formData), () => setIsDriverModalOpen(false));
        }}>
          <Input name="name" label="Nome Completo" required defaultValue={editingDriver?.name} />
          <Input name="cpf" label="CPF" required placeholder="000.000.000-00" defaultValue={editingDriver?.cpf} />
          <div className="grid grid-cols-2 gap-4">
            <Input name="license_category" label="Categoria CNH" required placeholder="E" defaultValue={editingDriver?.license_category} />
            <Input name="license_expiry" label="Vencimento CNH" type="date" required defaultValue={editingDriver?.license_expiry} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-500 uppercase">Filial</label>
            <input 
              name="branch" 
              list="branch-list-driver"
              defaultValue={editingDriver?.branch}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-emerald-500/20 outline-none"
              placeholder="Selecione ou digite..."
            />
            <datalist id="branch-list-driver">
              {stats?.branches?.map(b => (
                <option key={b} value={b} />
              ))}
            </datalist>
          </div>
          <div className="mt-4">
            <Select 
              name="fleet_category_id" 
              label="Classificação (Frota/Agregado)" 
              defaultValue={editingDriver?.fleet_category_id} 
              options={[
                { value: '', label: 'Selecione...' },
                ...fleetCategories.map(c => ({ value: c.id.toString(), label: c.name }))
              ]} 
            />
          </div>
          <div className="mt-4">
            <Select 
              name="status" 
              label="Status" 
              required 
              defaultValue={editingDriver?.status || 'Ativo'} 
              options={[
                { value: 'Ativo', label: 'Ativo' },
                { value: 'Inativo', label: 'Inativo' }
              ]} 
            />
          </div>
          <div className="mt-4">
            <label className="text-xs font-medium text-zinc-500 uppercase block mb-1">Observações</label>
            <textarea 
              name="notes"
              defaultValue={editingDriver?.notes}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-emerald-500/20 outline-none min-h-[100px]"
              placeholder="Informações relevantes e explicativas..."
            />
          </div>
          <button type="submit" className="w-full py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-500 transition-colors mt-4">
            {editingDriver ? "Salvar Alterações" : "Salvar Motorista"}
          </button>
        </form>

        {editingDriver && (
          <EntityDocumentsSection 
            entityId={editingDriver.id} 
            entityType="driver"
            documentTypes={documentTypes}
            onRefresh={fetchData}
            canCreate={hasPermission('fleet_documents', 'create')}
            canEdit={hasPermission('fleet_documents', 'edit')}
            canDelete={hasPermission('fleet_documents', 'delete')}
          />
        )}
      </Modal>

      <Modal 
        isOpen={isHelperModalOpen} 
        onClose={() => { setIsHelperModalOpen(false); setEditingHelper(null); }} 
        title={editingHelper ? "Editar Ajudante" : "Novo Ajudante"}
      >
        <form onSubmit={(e) => {
          e.preventDefault();
          const formData = new FormData(e.currentTarget);
          handleCreate('/api/helpers', Object.fromEntries(formData), () => setIsHelperModalOpen(false));
        }}>
          <Input name="name" label="Nome Completo" required defaultValue={editingHelper?.name} />
          <Input name="cpf" label="CPF" placeholder="000.000.000-00" defaultValue={editingHelper?.cpf} />
          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-500 uppercase">Filial</label>
            <input 
              name="branch" 
              list="branch-list-helper"
              defaultValue={editingHelper?.branch}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-emerald-500/20 outline-none"
              placeholder="Selecione ou digite..."
            />
            <datalist id="branch-list-helper">
              {stats?.branches?.map(b => (
                <option key={b} value={b} />
              ))}
            </datalist>
          </div>
          <div className="mt-4">
            <Select 
              name="status" 
              label="Status" 
              required 
              defaultValue={editingHelper?.status || 'Ativo'} 
              options={[
                { value: 'Ativo', label: 'Ativo' },
                { value: 'Inativo', label: 'Inativo' }
              ]} 
            />
          </div>
          <button type="submit" className="w-full py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-500 transition-colors mt-4">
            {editingHelper ? "Salvar Alterações" : "Salvar Ajudante"}
          </button>
        </form>
      </Modal>

      <UserModal 
        isOpen={isUserModalOpen}
        onClose={() => setIsUserModalOpen(false)}
        onSave={handleSaveUser}
        editingUser={editingUser}
        profiles={profiles}
      />

      <ProfileModal 
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        onSave={handleSaveProfile}
        editingProfile={editingProfile}
      />

      <SupplierModal 
        isOpen={isSupplierModalOpen}
        onClose={() => { setIsSupplierModalOpen(false); setEditingSupplier(null); }}
        onSave={editingSupplier ? handleEditSupplier : handleAddSupplier}
        supplier={editingSupplier}
      />

      <MaintenanceEntryModal 
        isOpen={isMaintenanceEntryModalOpen}
        onClose={() => { 
          setIsMaintenanceEntryModalOpen(false); 
          setEditingMaintenanceOrder(null);
          setPreSelectedVehicleId(undefined);
          setPreSelectedMaintenanceTypeIds(undefined);
          setPreSelectedPlanId(undefined);
        }}
        onConfirm={handleMaintenanceEntry}
        vehicles={vehicles}
        drivers={drivers}
        maintenanceTypes={maintenanceTypes}
        suppliers={suppliers}
        editingOrder={editingMaintenanceOrder}
        orders={maintenanceOrders}
        preSelectedVehicleId={preSelectedVehicleId?.toString()}
        preSelectedMaintenanceTypeIds={preSelectedMaintenanceTypeIds}
        preSelectedPlanId={preSelectedPlanId}
        currentUser={currentUser}
        fetchData={fetchData}
        handleDeleteComment={handleDeleteComment}
      />

      <AuditLogModal 
        isOpen={!!selectedOrderForAudit}
        onClose={() => setSelectedOrderForAudit(null)}
        tableName="maintenance_orders"
        recordId={selectedOrderForAudit?.id}
        title={`Ordem de Manutenção: ${selectedOrderForAudit?.registration_number} (${selectedOrderForAudit?.vehicle_plate || ''})`}
      />

      <MaintenanceCloseModal 
        isOpen={isMaintenanceCloseModalOpen}
        onClose={() => { setIsMaintenanceCloseModalOpen(false); setSelectedOrderForClose(null); }}
        onConfirm={handleMaintenanceClose}
        order={selectedOrderForClose}
      />

      <PlateMappingModal 
        isOpen={isPlateMappingModalOpen}
        onClose={() => setIsPlateMappingModalOpen(false)}
        duplicates={potentialDuplicates}
        onConfirm={(mappings, saveToDb) => {
          setIsPlateMappingModalOpen(false);
          if (existingTransactionsCount > 0) {
            setConfirmConfig({
              title: 'Transações Duplicadas Detectadas',
              message: `Encontramos ${existingTransactionsCount} transações que já existem no sistema. Deseja atualizar os registros existentes com os novos dados da planilha ou apenas ignorar as duplicatas e importar os novos registros?`,
              confirmText: 'Atualizar Existentes',
              cancelText: 'Ignorar Duplicatas',
              variant: 'primary',
              onConfirm: () => executeImport(pendingImportData, mappings, saveToDb, true),
              onCancel: () => executeImport(pendingImportData, mappings, saveToDb, false)
            });
            setIsConfirmOpen(true);
          } else {
            executeImport(pendingImportData, mappings, saveToDb);
          }
        }}
      />

      <MaintenancePlanModal 
        isOpen={isMaintenanceModalOpen}
        onClose={() => setIsMaintenanceModalOpen(false)}
        onSave={handleSaveMaintenancePlans}
        vehicles={vehicles}
        maintenanceTypes={maintenanceTypes}
      />

      <Modal 
        isOpen={isAuxModalOpen} 
        onClose={() => { setIsAuxModalOpen(false); setEditingAuxRecord(null); }} 
        title={editingAuxRecord ? `Editar Registro: ${auxModalType}` : `Novo Registro: ${auxModalType}`}
      >
        <form onSubmit={(e) => {
          e.preventDefault();
          const formData = new FormData(e.currentTarget);
          let endpoint = `/api/${auxModalType}s`;
          if (auxModalType === 'fleet-category') endpoint = '/api/fleet-categories';
          if (auxModalType === 'responsible-company') endpoint = '/api/responsible-companies';
          if (auxModalType === 'vehicle-type') endpoint = '/api/vehicle-types';
          if (auxModalType === 'maintenance-type') endpoint = '/api/maintenance-types';
          if (auxModalType === 'document-type') endpoint = '/api/document-types';
          
          const data: any = Object.fromEntries(formData);
          if (editingAuxRecord) {
            data.id = editingAuxRecord.id;
          }
          if (data.target_consumption) {
            data.target_consumption = parseFloat(data.target_consumption as string);
          }
          if (data.km_interval) {
            data.km_interval = parseFloat(data.km_interval as string);
          }
          if (data.time_interval_months) {
            data.time_interval_months = parseInt(data.time_interval_months as string);
          }
          
          handleCreate(endpoint, data, () => setIsAuxModalOpen(false));
        }}>
          {auxModalType === 'model' && (
            <Select 
              name="brand_id" 
              label="Marca" 
              required 
              defaultValue={editingAuxRecord?.brand_id}
              options={brands.map(b => ({ value: b.id, label: b.name }))} 
            />
          )}
          <Input name="name" label="Nome" required defaultValue={editingAuxRecord?.name} />
          {auxModalType === 'model' && (
            <Input 
              name="target_consumption" 
              label="Meta de Consumo (KM/L)" 
              type="number" 
              step="0.01" 
              defaultValue={editingAuxRecord?.target_consumption} 
            />
          )}
          {auxModalType === 'maintenance-type' && (
            <>
              <Select 
                name="category" 
                label="Categoria" 
                required 
                defaultValue={editingAuxRecord?.category}
                options={[
                  { value: 'Preventiva', label: 'Preventiva' },
                  { value: 'Corretiva', label: 'Corretiva' },
                  { value: 'Preditiva', label: 'Preditiva' },
                ]}
              />
              <div className="grid grid-cols-2 gap-4">
                <Input 
                  name="km_interval" 
                  label="Intervalo (KM)" 
                  type="number" 
                  required 
                  defaultValue={editingAuxRecord?.km_interval} 
                />
                <Input 
                  name="time_interval_months" 
                  label="Intervalo (Meses)" 
                  type="number" 
                  required 
                  defaultValue={editingAuxRecord?.time_interval_months} 
                />
              </div>
              <div className="space-y-1 mb-4">
                <label className="text-sm font-medium text-zinc-400">Descrição</label>
                <textarea 
                  name="description" 
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-emerald-500/20 outline-none min-h-[80px]"
                  defaultValue={editingAuxRecord?.description}
                />
              </div>
            </>
          )}
          {auxModalType === 'document-type' && (
            <Select 
              name="category" 
              label="Categoria" 
              required 
              defaultValue={editingAuxRecord?.category}
              options={[
                { value: 'VEICULO', label: 'Veículo' },
                { value: 'MOTORISTA', label: 'Motorista' },
              ]}
            />
          )}
          <div className="mt-4">
            <Select 
              name="status" 
              label="Status" 
              required 
              defaultValue={editingAuxRecord?.status || 'Ativo'} 
              options={[
                { value: 'Ativo', label: 'Ativo' },
                { value: 'Inativo', label: 'Inativo' }
              ]} 
            />
          </div>
          <button type="submit" className="w-full py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-500 transition-colors mt-4">
            {editingAuxRecord ? "Salvar Alterações" : "Salvar Registro"}
          </button>
        </form>
      </Modal>

      <ConfirmModal 
        isOpen={isConfirmOpen}
        onClose={() => {
          setIsConfirmOpen(false);
          if (confirmConfig.onCancel) confirmConfig.onCancel();
        }}
        onConfirm={() => {
          confirmConfig.onConfirm();
          setIsConfirmOpen(false);
        }}
        title={confirmConfig.title}
        message={confirmConfig.message}
        confirmText={confirmConfig.confirmText}
        cancelText={confirmConfig.cancelText}
        variant={confirmConfig.variant}
      />

      {/* Import Status Modal */}
      <Modal 
        isOpen={isImporting || !!importResult} 
        onClose={() => !isImporting && setImportResult(null)} 
        title={isImporting ? "Processando Importação" : "Resultado da Importação"}
      >
        <div className="py-4">
          {isImporting ? (
            <div className="flex flex-col items-center justify-center space-y-4 py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500"></div>
              <p className="text-zinc-400 animate-pulse">Processando dados da planilha...</p>
              <p className="text-xs text-zinc-500">Isso pode levar alguns segundos dependendo do volume de dados.</p>
            </div>
          ) : importResult?.error ? (
            <div className="space-y-4">
              <div className="flex items-center space-x-3 text-rose-500 bg-rose-500/10 p-4 rounded-xl border border-rose-500/20">
                <AlertTriangle className="w-6 h-6 flex-shrink-0" />
                <p className="font-medium">{importResult.error}</p>
              </div>
              <button 
                onClick={() => setImportResult(null)}
                className="w-full py-3 bg-zinc-800 text-white font-bold rounded-xl hover:bg-zinc-700 transition-colors"
              >
                Fechar
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800 text-center">
                  <p className="text-2xl font-bold text-emerald-500">{importResult?.imported || 0}</p>
                  <p className="text-xs text-zinc-500 uppercase tracking-wider font-medium mt-1">Novos</p>
                </div>
                {importResult?.updated > 0 ? (
                  <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800 text-center">
                    <p className="text-2xl font-bold text-blue-500">{importResult?.updated || 0}</p>
                    <p className="text-xs text-zinc-500 uppercase tracking-wider font-medium mt-1">Atualizados</p>
                  </div>
                ) : (
                  <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800 text-center">
                    <p className="text-2xl font-bold text-amber-500">{importResult?.duplicateTransactions?.length || 0}</p>
                    <p className="text-xs text-zinc-500 uppercase tracking-wider font-medium mt-1">Ignorados</p>
                  </div>
                )}
              </div>

              {importResult?.duplicateTransactions && importResult.duplicateTransactions.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-zinc-400 flex items-center">
                    <Copy className={cn("w-4 h-4 mr-2", importResult?.updated > 0 ? "text-blue-500" : "text-amber-500")} />
                    Transações Duplicadas ({importResult.duplicateTransactions.length})
                  </p>
                  <p className="text-xs text-zinc-500 italic">
                    {importResult?.updated > 0 
                      ? "Estes registros já existiam no sistema e foram atualizados com os novos dados."
                      : "Estes registros já existem no sistema e não foram importados novamente para evitar duplicidade."}
                  </p>
                  <div className="max-h-32 overflow-y-auto bg-zinc-950 rounded-lg p-3 border border-zinc-800 flex flex-wrap gap-2">
                    {importResult.duplicateTransactions.map((id: string, idx: number) => (
                      <span key={idx} className="text-[10px] bg-zinc-900 text-zinc-400 px-2 py-0.5 rounded border border-zinc-800 font-mono">
                        {id}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {importResult?.errors && importResult.errors.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-zinc-400 flex items-center">
                    <AlertTriangle className="w-4 h-4 mr-2 text-amber-500" />
                    Alertas ({importResult.errors.length})
                  </p>
                  <div className="max-h-40 overflow-y-auto bg-zinc-950 rounded-lg p-3 border border-zinc-800 space-y-2">
                    {importResult.errors.map((err: string, idx: number) => (
                      <p key={idx} className="text-xs text-zinc-500 border-l-2 border-amber-500/50 pl-2">{err}</p>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex space-x-3">
                <button 
                  onClick={() => {
                    setImportResult(null);
                    setActiveTab('dashboard');
                  }}
                  className="flex-1 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-500 transition-colors shadow-lg shadow-emerald-900/20"
                >
                  Ir para Dashboard
                </button>
                <button 
                  onClick={() => setImportResult(null)}
                  className="flex-1 py-3 bg-zinc-800 text-white font-bold rounded-xl hover:bg-zinc-700 transition-colors"
                >
                  Fechar
                </button>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
