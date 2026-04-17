export interface FleetCategory {
  id: number;
  name: string;
}

export interface ResponsibleCompany {
  id: number;
  name: string;
}

export interface VehicleType {
  id: number;
  name: string;
}

export interface Brand {
  id: number;
  name: string;
}

export interface Model {
  id: number;
  brand_id: number;
  brand_name?: string;
  name: string;
  target_consumption?: number;
}

export interface Vehicle {
  id: number;
  plate: string;
  brand_id?: number;
  brand_name?: string;
  model_id?: number;
  model_name?: string;
  manufacture_year: number;
  model_year: number;
  renavam: string;
  chassis: string;
  vehicle_type_id?: number;
  vehicle_type_name?: string;
  fleet_category_id?: number;
  fleet_category_name?: string;
  responsible_company_id?: number;
  responsible_company_name?: string;
  fuel_type: string;
  tank_capacity: number;
  current_km: number;
  driver_id?: number;
  driver_name?: string;
  target_consumption?: number;
  status: string;
  branch?: string;
  notes?: string;
  created_at: string;
}

export interface Driver {
  id: number;
  name: string;
  cpf: string;
  license_category: string;
  license_expiry: string;
  status: string;
  branch?: string;
  fleet_category_id?: number;
  fleet_category_name?: string;
  notes?: string;
  created_at: string;
}

export interface Helper {
  id: number;
  name: string;
  cpf?: string;
  status: string;
  branch?: string;
  created_at: string;
}

export interface FuelRecord {
  id: number;
  vehicle_id: number;
  vehicle_plate: string;
  driver_id: number;
  driver_name: string;
  helper_id?: number;
  helper_name?: string;
  station_id: number;
  station_name: string;
  date: string;
  odometer: number;
  liters: number;
  total_cost: number;
  fuel_type: string;
  branch?: string;
  created_at: string;
}

export interface MaintenanceType {
  id: number;
  name: string;
  category: string;
  description?: string;
  km_interval: number;
  time_interval_months: number;
  status?: string;
}

export interface MaintenancePlan {
  id: number;
  registration_number?: string;
  vehicle_id: number;
  plate: string;
  current_km: number;
  maintenance_type_id: number;
  maintenance_type_ids?: string;
  type_name: string;
  km_interval: number;
  last_service_km: number;
  last_service_date: string;
  next_service_km: number;
  next_service_date: string;
  status: 'VERDE' | 'AMARELO' | 'VERMELHO';
  has_open_os: number;
  branch?: string;
  responsible_company_id?: number;
  responsible_company_name?: string;
}

export interface Supplier {
  id: number;
  name: string;
  trade_name?: string;
  cnpj?: string;
  phone?: string;
  email?: string;
  street?: string;
  number?: string;
  neighborhood?: string;
  zip_code?: string;
  city?: string;
  state?: string;
  status: string;
  created_at: string;
}

export interface ModulePermissions {
  access: boolean;
  create?: boolean;
  edit?: boolean;
  delete?: boolean;
  import?: boolean;
  export?: boolean;
  manage?: boolean;
  download_template?: boolean;
  search?: boolean;
  view_active?: boolean;
  view_history?: boolean;
  view?: boolean;
}

export interface FleetDocument {
  id: number | string;
  entity_id: number;
  entity_type?: 'vehicle' | 'driver';
  entity_name?: string;
  entity_plate?: string; // For vehicles
  document_type_id?: number;
  type_name?: string;
  type: string;
  expiration_date: string;
  notes?: string;
  status?: 'VERDE' | 'AMARELO' | 'VERMELHO';
  days_until_expiration?: number;
  is_cnh?: number;
  driver_id?: number;
  vehicle_id?: number;
  branch?: string;
  fleet_category_id?: number;
}

export interface DocumentType {
  id: number;
  name: string;
  category: 'VEICULO' | 'MOTORISTA';
  status?: string;
}

export interface AppPermissions {
  dashboard: { access: boolean };
  reports: { access: boolean };
  fueling: { 
    access: boolean;
    create: boolean;
    delete: boolean;
    export?: boolean;
  };
  maintenance_board: {
    access: boolean;
    import: boolean;
    export: boolean;
    create: boolean;
    edit: boolean;
    delete: boolean;
    download_template: boolean;
    search: boolean;
  };
  maintenance_plan: {
    access: boolean;
    view_active: boolean;
    view_history: boolean;
    search: boolean;
    export: boolean;
    create: boolean;
    edit: boolean;
    delete: boolean;
  };
  fleet_documents: {
    access: boolean;
    create: boolean;
    edit: boolean;
    delete: boolean;
  };
  registrations: {
    access: boolean;
    vehicles: { view: boolean; create: boolean; edit: boolean; delete: boolean; export: boolean };
    drivers: { view: boolean; create: boolean; edit: boolean; delete: boolean; export: boolean };
    helpers: { view: boolean; create: boolean; edit: boolean; delete: boolean; export: boolean };
    suppliers: { view: boolean; create: boolean; edit: boolean; delete: boolean; export: boolean };
    auxiliary_tables: { view: boolean; create: boolean; edit: boolean; delete: boolean; export: boolean };
  };
}

export interface Profile {
  id: number;
  name: string;
  permissions: AppPermissions;
  created_at: string;
}

export interface User {
  id: number;
  name: string;
  email: string;
  password?: string;
  profile_id?: number;
  profile_name?: string;
  is_admin: number;
  permissions?: AppPermissions;
  status: string;
  created_at: string;
  token?: string;
}
