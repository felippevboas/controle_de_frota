-- Supabase (PostgreSQL) Schema for Fleet Management System

-- Enable UUID extension if needed
-- CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table: fleet_categories
CREATE TABLE IF NOT EXISTS fleet_categories (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    status TEXT DEFAULT 'Ativo'
);

-- Table: responsible_companies
CREATE TABLE IF NOT EXISTS responsible_companies (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    status TEXT DEFAULT 'Ativo'
);

-- Table: vehicle_types
CREATE TABLE IF NOT EXISTS vehicle_types (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    status TEXT DEFAULT 'Ativo'
);

-- Table: brands
CREATE TABLE IF NOT EXISTS brands (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    status TEXT DEFAULT 'Ativo'
);

-- Table: models
CREATE TABLE IF NOT EXISTS models (
    id SERIAL PRIMARY KEY,
    brand_id INTEGER NOT NULL REFERENCES brands(id),
    name TEXT NOT NULL,
    target_consumption REAL,
    status TEXT DEFAULT 'Ativo',
    UNIQUE(brand_id, name)
);

-- Table: drivers
CREATE TABLE IF NOT EXISTS drivers (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    cpf TEXT UNIQUE,
    license_category TEXT,
    license_expiry DATE,
    status TEXT DEFAULT 'Ativo',
    branch TEXT,
    fleet_category_id INTEGER REFERENCES fleet_categories(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table: helpers
CREATE TABLE IF NOT EXISTS helpers (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    cpf TEXT UNIQUE,
    status TEXT DEFAULT 'Ativo',
    branch TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table: vehicles
CREATE TABLE IF NOT EXISTS vehicles (
    id SERIAL PRIMARY KEY,
    plate TEXT UNIQUE NOT NULL,
    brand_id INTEGER REFERENCES brands(id),
    model_id INTEGER REFERENCES models(id),
    manufacture_year INTEGER,
    model_year INTEGER,
    renavam TEXT,
    chassis TEXT,
    vehicle_type_id INTEGER REFERENCES vehicle_types(id),
    fleet_category_id INTEGER REFERENCES fleet_categories(id),
    fuel_type TEXT,
    tank_capacity REAL,
    current_km REAL DEFAULT 0,
    driver_id INTEGER REFERENCES drivers(id),
    status TEXT DEFAULT 'Ativo',
    branch TEXT,
    responsible_company_id INTEGER REFERENCES responsible_companies(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table: fuel_stations
CREATE TABLE IF NOT EXISTS fuel_stations (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    city TEXT,
    state TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table: fuel_records
CREATE TABLE IF NOT EXISTS fuel_records (
    id SERIAL PRIMARY KEY,
    transaction_id TEXT UNIQUE,
    vehicle_id INTEGER REFERENCES vehicles(id),
    driver_id INTEGER REFERENCES drivers(id),
    helper_id INTEGER REFERENCES helpers(id),
    station_id INTEGER REFERENCES fuel_stations(id),
    date TIMESTAMP WITH TIME ZONE,
    odometer REAL,
    liters REAL,
    total_cost REAL,
    fuel_type TEXT,
    service TEXT,
    branch TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_fuel_records_vehicle_date ON fuel_records(vehicle_id, date DESC, odometer DESC);

-- Table: maintenance_types
CREATE TABLE IF NOT EXISTS maintenance_types (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT,
    description TEXT,
    km_interval REAL,
    time_interval_months INTEGER,
    nature TEXT DEFAULT 'Preventiva'
);

-- Table: suppliers
CREATE TABLE IF NOT EXISTS suppliers (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    trade_name TEXT,
    cnpj TEXT UNIQUE,
    phone TEXT,
    email TEXT,
    street TEXT,
    number TEXT,
    neighborhood TEXT,
    zip_code TEXT,
    city TEXT,
    state TEXT,
    status TEXT DEFAULT 'Ativo',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add trade_name column if it doesn't exist (for existing databases)
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS trade_name TEXT;

-- Table: maintenance_orders
CREATE TABLE IF NOT EXISTS maintenance_orders (
    id SERIAL PRIMARY KEY,
    registration_number TEXT UNIQUE,
    vehicle_id INTEGER REFERENCES vehicles(id),
    maintenance_type_id INTEGER REFERENCES maintenance_types(id),
    supplier_id INTEGER REFERENCES suppliers(id),
    driver_id INTEGER REFERENCES drivers(id),
    open_date TIMESTAMP WITH TIME ZONE,
    close_date TIMESTAMP WITH TIME ZONE,
    estimated_completion_date TIMESTAMP WITH TIME ZONE,
    km REAL,
    cost REAL,
    supplier TEXT,
    notes TEXT,
    maintenance_nature TEXT,
    status TEXT DEFAULT 'Aberta',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table: maintenance_order_types
CREATE TABLE IF NOT EXISTS maintenance_order_types (
    order_id INTEGER REFERENCES maintenance_orders(id),
    maintenance_type_id INTEGER REFERENCES maintenance_types(id),
    PRIMARY KEY(order_id, maintenance_type_id)
);

-- Table: vehicle_maintenance_plans
CREATE TABLE IF NOT EXISTS vehicle_maintenance_plans (
    id SERIAL PRIMARY KEY,
    registration_number TEXT UNIQUE,
    vehicle_id INTEGER REFERENCES vehicles(id),
    maintenance_type_id INTEGER REFERENCES maintenance_types(id),
    last_service_km REAL,
    last_service_date TIMESTAMP WITH TIME ZONE,
    next_service_km REAL,
    next_service_date TIMESTAMP WITH TIME ZONE,
    status TEXT DEFAULT 'VERDE'
);

-- Table: maintenance_plan_types
CREATE TABLE IF NOT EXISTS maintenance_plan_types (
    plan_id INTEGER REFERENCES vehicle_maintenance_plans(id),
    maintenance_type_id INTEGER REFERENCES maintenance_types(id),
    PRIMARY KEY(plan_id, maintenance_type_id)
);

-- Table: maintenance_order_plans
CREATE TABLE IF NOT EXISTS maintenance_order_plans (
    order_id INTEGER REFERENCES maintenance_orders(id),
    plan_id INTEGER REFERENCES vehicle_maintenance_plans(id),
    PRIMARY KEY(order_id, plan_id)
);

-- Table: plate_mappings
CREATE TABLE IF NOT EXISTS plate_mappings (
    id SERIAL PRIMARY KEY,
    original_plate TEXT UNIQUE NOT NULL,
    mapped_plate TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table: profiles
CREATE TABLE IF NOT EXISTS profiles (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    permissions JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table: users
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    profile_id INTEGER REFERENCES profiles(id),
    is_admin INTEGER DEFAULT 0,
    status TEXT DEFAULT 'Ativo',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table: document_types
CREATE TABLE IF NOT EXISTS document_types (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    category TEXT NOT NULL, -- VEICULO or MOTORISTA
    status TEXT DEFAULT 'Ativo',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table: vehicle_documents
CREATE TABLE IF NOT EXISTS vehicle_documents (
    id SERIAL PRIMARY KEY,
    vehicle_id INTEGER NOT NULL REFERENCES vehicles(id),
    document_type_id INTEGER REFERENCES document_types(id),
    type TEXT,
    expiration_date DATE NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table: driver_documents
CREATE TABLE IF NOT EXISTS driver_documents (
    id SERIAL PRIMARY KEY,
    driver_id INTEGER NOT NULL REFERENCES drivers(id),
    document_type_id INTEGER REFERENCES document_types(id),
    type TEXT,
    expiration_date DATE NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table: settings
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
);

-- Table: audit_logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    table_name TEXT NOT NULL,
    record_id INTEGER NOT NULL,
    action TEXT NOT NULL, -- 'CREATE', 'UPDATE', 'DELETE', 'CLOSE'
    user_id INTEGER REFERENCES users(id),
    user_name TEXT,
    old_data JSONB,
    new_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table: maintenance_order_comments
CREATE TABLE IF NOT EXISTS maintenance_order_comments (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES maintenance_orders(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id),
    user_name TEXT,
    comment TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Grant permissions to service_role (standard Supabase roles)
-- This ensures the backend can seed data even if permissions were restricted
GRANT USAGE ON SCHEMA public TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO service_role;

-- Ensure anon and authenticated roles have basic access (RLS will still apply)
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated;
