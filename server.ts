import 'dotenv/config';
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cors from "cors";
import * as XLSX from "xlsx";
import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabaseUrl = process.env.URL_SUPABASE || process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error("ERRO: Variáveis de ambiente do Supabase não encontradas!");
  console.log("Verifique se o arquivo .env contém URL_SUPABASE e SUPABASE_SERVICE_ROLE_KEY");
} else {
  console.log(`[INIT] Supabase URL: ${supabaseUrl.substring(0, 15)}...`);
  console.log(`[INIT] Supabase Key length: ${supabaseKey.length}`);
}

export const supabase = createClient(supabaseUrl, supabaseKey);

const logAudit = async (tableName: string, recordId: number, action: string, user: any, oldData?: any, newData?: any) => {
  try {
    await supabase.from('audit_logs').insert({
      table_name: tableName,
      record_id: recordId,
      action: action,
      user_id: user?.id,
      user_name: user?.name || user?.email,
      old_data: oldData,
      new_data: newData
    });
  } catch (err) {
    console.error(`[AUDIT] Erro ao registrar log:`, err);
  }
};

const JWT_SECRET = process.env.JWT_SECRET || "controle-frota-secret-key-2026";

const normalizeName = (name: any) => {
  if (name === undefined || name === null || String(name).trim() === "") return "NÃO INFORMADO";
  let normalized = String(name).trim().toUpperCase();
  if (normalized === "PROPRIA") return "FROTA";
  return normalized;
};

// Data Cleanup & Normalization (Merge duplicates)
// Removed SQLite cleanupDuplicates logic


const supplierColumns = [
  "street TEXT",
  "number TEXT",
  "neighborhood TEXT",
  "zip_code TEXT",
  "trade_name TEXT"
];

const getMercosulEquivalent = (plate: string) => {
  const p = plate.replace(/[^A-Z0-9]/g, '').toUpperCase();
  if (p.length !== 7) return null;
  
  const mapping: {[key: string]: string} = {
    '0': 'A', '1': 'B', '2': 'C', '3': 'D', '4': 'E',
    '5': 'F', '6': 'G', '7': 'H', '8': 'I', '9': 'J'
  };
  const reverseMapping: {[key: string]: string} = Object.fromEntries(
    Object.entries(mapping).map(([k, v]) => [v, k])
  );

  const char5 = p[4];
  
  if (/[0-9]/.test(char5)) {
    // Is old format, convert to Mercosul
    return p.substring(0, 4) + mapping[char5] + p.substring(5);
  } else if (/[A-J]/.test(char5)) {
    // Is Mercosul format, convert to old
    return p.substring(0, 4) + reverseMapping[char5] + p.substring(5);
  }
  
  return null;
};

async function startServer() {
  console.log(`[SERVER] Starting server in ${process.env.NODE_ENV || 'development'} mode`);
  const app = express();
  
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    if (req.url.startsWith('/api/')) {
      res.setHeader('Content-Type', 'application/json');
    }
    next();
  });

  app.get("/api/health", (req, res) => res.json({ status: "ok" }));
  app.get("/health", (req, res) => res.json({ status: "ok" }));
  
  const fetchAllPages = async (queryBuilder: any) => {
    let allData: any[] = [];
    let from = 0;
    const step = 1000;
    let hasMore = true;
    while (hasMore) {
      const { data, error } = await queryBuilder.range(from, from + step - 1);
      if (error) throw error;
      if (data && data.length > 0) {
        allData = allData.concat(data);
        from += step;
        if (data.length < step) hasMore = false;
      } else {
        hasMore = false;
      }
    }
    return allData;
  };

  app.get("/api/db-check", async (req, res) => {
    try {
      if (!supabaseUrl || !supabaseKey) {
        return res.status(500).json({ 
          status: "error", 
          message: "Supabase configuration missing",
          url: !!supabaseUrl,
          key: !!supabaseKey
        });
      }
      
      const results: any = {
        status: "ok",
        checks: {}
      };

      // Check 1: Simple table query
      const { count, error: userError } = await supabase.from('users').select('*', { count: 'exact', head: true });
      results.checks.users_table = userError ? { status: "error", error: userError } : { status: "ok", count };
      
      if (userError && (userError.code === '42501' || userError.message.includes('permission denied'))) {
        results.permission_hint = "O Supabase está negando acesso ao schema 'public'. Por favor, execute o script SQL atualizado (supabase_schema.sql) no Editor SQL do Supabase para conceder as permissões necessárias ao 'service_role'.";
      } else if (userError && (userError.code === '42P01' || userError.message.includes('relation "users" does not exist'))) {
        results.table_hint = "A tabela 'users' não existe. Por favor, execute o script SQL (supabase_schema.sql) no Editor SQL do Supabase.";
      }

      // Check 2: Auth admin check (requires service_role)
      const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers({
        page: 1,
        perPage: 10
      });
      results.checks.auth_admin = authError ? { status: "error", error: authError } : { 
        status: "ok", 
        userCount: authUsers?.users?.length,
        emails: authUsers?.users?.map(u => u.email)
      };

      if (userError || authError) {
        results.status = "error";
        results.message = "One or more checks failed";
      }

      res.json(results);
    } catch (e: any) {
      res.status(500).json({ status: "error", message: e.message, details: e });
    }
  });

  // Required for express-rate-limit when behind a proxy (Cloud Run)
  app.set('trust proxy', true);

  // CORS configuration
  app.use(cors({
    origin: true,
    credentials: true
  }));

  // Security Hardening
  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
  }));

  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // Limit each IP to 1000 requests per windowMs
    message: { error: "Muitas requisições, tente novamente mais tarde." },
    validate: { trustProxy: false }
  });
  app.use("/api", limiter);

  app.use(express.json({ limit: '50mb' }));
  app.use(cookieParser());

  // Auth Middleware
  const authenticateToken = async (req: any, res: any, next: any) => {
    let token = req.cookies.token;
    
    // Fallback to Authorization header
    if (!token && req.headers.authorization) {
      const authHeader = req.headers.authorization;
      if (authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }
    }

    if (!token) {
      console.log(`[AUTH] No token found for ${req.method} ${req.url}. Headers:`, JSON.stringify(req.headers));
      return res.status(401).json({ error: "Não autorizado" });
    }

    try {
      const decoded: any = jwt.verify(token, JWT_SECRET);
      console.log(`[AUTH] Token verified for ID: ${decoded.id}, Email: ${decoded.email}`);
      
      // Fetch full user data including permissions to ensure they are up to date
      const { data: user, error } = await supabase
        .from('users')
        .select(`
          id, name, email, profile_id, is_admin, status,
          profiles ( permissions )
        `)
        .eq('id', decoded.id)
        .single();

      if (error || !user || user.status !== 'Ativo') {
        console.log(`[AUTH] Invalid user or inactive: ${decoded.id}. Email: ${decoded.email}. Status: ${user?.status}. Error:`, error);
        return res.status(401).json({ error: "Usuário inválido ou inativo" });
      }

      const rawPermissions = (user as any).profiles?.permissions;
      const permissions = typeof rawPermissions === 'string' ? JSON.parse(rawPermissions || '{}') : (rawPermissions || {});
      
      if (!user.is_admin && !user.profile_id) {
        console.log(`[AUTH] Denied: User ${user.email} is not an admin and has no profile assigned.`);
        return res.status(403).json({ error: "Usuário sem perfil de acesso atribuído. Entre em contato com o administrador." });
      }
      
      console.log(`[AUTH] User authenticated: ${user.email} (ID: ${user.id}) - Admin: ${user.is_admin} - Profile ID: ${user.profile_id}`);
      console.log(`[AUTH] Permissions keys for ${user.email}:`, Object.keys(permissions));
      
      if (Object.keys(permissions).length === 0) {
        console.log(`[AUTH] WARNING: User ${user.email} has no permissions configured (Profile ID: ${user.profile_id})`);
      }

      const formattedUser = {
        ...user,
        permissions: permissions,
        token: token
      };

      req.user = formattedUser;
      next();
    } catch (err: any) {
      if (err.name === 'TokenExpiredError') {
        console.log(`[AUTH] Token expired: ${err.message}`);
      } else {
        console.error(`[AUTH] Token verification failed:`, err);
      }
      return res.status(401).json({ error: "Sessão inválida", expired: err.name === 'TokenExpiredError' });
    }
  };

  // Permission Middleware
  const checkPermission = (module: string, action: string, subModule?: string) => {
    return (req: any, res: any, next: any) => {
      const user = req.user;
      if (!user) {
        console.log(`[PERMISSION] No user found in request for ${module}.${action}`);
        return res.status(401).json({ error: "Não autenticado" });
      }
      
      console.log(`[PERMISSION] Checking ${module}.${action} for user: ${user.email} - Admin: ${user.is_admin}`);
      
      // Admins bypass all permission checks
      if (user.is_admin) {
        console.log(`[PERMISSION] Admin bypass for ${module}.${action} - User: ${user.email}`);
        return next();
      }

      const perms = user.permissions;
      if (!perms) {
        console.log(`[PERMISSION] No permissions configured for user: ${user.email}`);
        return res.status(403).json({ error: "Sem permissões configuradas" });
      }

      // Check module access first
      const modulePerm = perms[module];
      console.log(`[PERMISSION] Module ${module} permission for ${user.email}:`, JSON.stringify(modulePerm));
      
      if (!modulePerm || !modulePerm.access) {
        console.log(`[PERMISSION] Denied: No access to module ${module} for user: ${user.email}. Permissions object:`, JSON.stringify(perms));
        return res.status(403).json({ error: `Sem acesso ao módulo: ${module}` });
      }

      // Check specific action
      if (subModule) {
        // Nested permissions like registrations.vehicles.view
        const subModulePerm = modulePerm?.[subModule];
        if (!subModulePerm || !subModulePerm[action]) {
          console.log(`[PERMISSION] Denied: No permission for ${action} in ${subModule} (Module: ${module}) for user: ${user.email}. Module perms:`, JSON.stringify(modulePerm));
          return res.status(403).json({ error: `Sem permissão para ${action} em ${subModule}` });
        }
      } else {
        // Direct permissions like fueling.create
        if (!modulePerm?.[action]) {
          console.log(`[PERMISSION] Denied: No permission for ${action} in ${module} for user: ${user.email}. Module perms:`, JSON.stringify(modulePerm));
          return res.status(403).json({ error: `Sem permissão para ${action} em ${module}` });
        }
      }

      console.log(`[PERMISSION] Granted: ${module}.${subModule ? subModule + '.' : ''}${action} for user: ${user.email}`);
      next();
    };
  };

  const checkAnyPermission = (permsList: { module: string, action: string, subModule?: string }[]) => {
    return (req: any, res: any, next: any) => {
      const user = req.user;
      if (!user) return res.status(401).json({ error: "Não autenticado" });
      if (user.is_admin) return next();

      const perms = user.permissions;
      if (!perms) return res.status(403).json({ error: "Sem permissões configuradas" });

      const hasAny = permsList.some(spec => {
        const modulePerm = perms[spec.module];
        if (!modulePerm || !modulePerm.access) return false;
        
        if (spec.subModule) {
          const subModulePerm = modulePerm?.[spec.subModule];
          return subModulePerm?.[spec.action] === true;
        } else {
          return modulePerm?.[spec.action] === true;
        }
      });

      if (hasAny) {
        console.log(`[PERMISSION] Granted any permission for user: ${user.email}`);
        return next();
      }
      
      console.log(`[PERMISSION] Denied any permission for user: ${user.email}. Tried:`, JSON.stringify(permsList));
      return res.status(403).json({ error: "Sem permissão para esta operação" });
    };
  };

  const checkAdmin = (req: any, res: any, next: any) => {
    if (req.user && req.user.is_admin) {
      next();
    } else {
      res.status(403).json({ error: "Acesso restrito a administradores" });
    }
  };

  const log = (msg: string) => {
    console.log(msg);
  };

  // Run initial db check
  (async () => {
    try {
      log("Running initial database check...");
      const { count, error: userError } = await supabase.from('users').select('*', { count: 'exact', head: true });
      if (userError) {
        log(`Users table check failed: ${JSON.stringify(userError)}`);
      } else {
        log(`Users table check passed: ${count} users found`);
      }

      const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers({
        page: 1,
        perPage: 1
      });
      if (authError) {
        log(`Auth admin check failed: ${JSON.stringify(authError)}`);
      } else {
        log(`Auth admin check passed: ${authUsers?.users?.length} auth users found`);
      }
    } catch (e: any) {
      log(`Initial db check failed with exception: ${e.message || e}`);
    }
  })();

  // Seed default profile if it doesn't exist
  try {
    log("Starting seeding process...");
    const { data: profileExists, error: profileCheckError } = await supabase.from('profiles').select('id').eq('name', 'Administrador').maybeSingle();
    
    if (profileCheckError) {
      log(`Error checking for default profile: ${JSON.stringify(profileCheckError)}`);
    }
    
    let adminProfileId = profileExists?.id;

    if (!profileExists && !profileCheckError) {
      log("Default profile not found, creating...");
      const { data: newProfile, error: profileInsertError } = await supabase.from('profiles').insert({
        name: "Administrador",
        permissions: {
          dashboard: { access: true },
          reports: { access: true },
          fueling: { access: true, create: true, delete: true },
          maintenance_board: { access: true, import: true, export: true, create: true, edit: true, delete: true, download_template: true, search: true },
          maintenance_plan: { access: true, view_active: true, view_history: true, search: true, export: true, create: true, edit: true, delete: true },
          fleet_documents: { access: true, create: true, edit: true, delete: true },
          registrations: {
            access: true,
            vehicles: { view: true, create: true, edit: true, delete: true },
            drivers: { view: true, create: true, edit: true, delete: true },
            helpers: { view: true, create: true, edit: true, delete: true },
            suppliers: { view: true, create: true, edit: true, delete: true },
            auxiliary_tables: { view: true, create: true, edit: true, delete: true }
          }
        }
      }).select('id').single();
      
      if (profileInsertError) {
        console.error("Error creating default profile:", profileInsertError);
      } else {
        adminProfileId = newProfile.id;
        console.log("Default profile created");
      }
    }

    // Seed default admin if it doesn't exist
    const { data: adminExists, error: checkError } = await supabase.from('users').select('id').eq('email', 'admin@fleetsmart.com').maybeSingle();
    
    if (checkError) {
      log(`Error checking for default admin: ${JSON.stringify(checkError)}`);
    } else {
      log(`Admin check result: ${adminExists ? "Found" : "Not Found"}`);
    }

    if (!adminExists && !checkError) {
      log("Default admin not found, creating...");
      const hashedPassword = await bcrypt.hash("admin123", 10);
      const { error: insertError } = await supabase.from('users').insert({
        name: "Administrador",
        email: "admin@fleetsmart.com",
        password: hashedPassword,
        is_admin: 1,
        status: "Ativo",
        profile_id: adminProfileId
      });
      
      if (insertError) {
        console.error("Error creating default admin:", insertError);
      } else {
        console.log("Default admin created: admin@fleetsmart.com / admin123");
      }
    }

    // Seed user's email if it doesn't exist
    const userEmail = "felippevvb@gmail.com";
    const { data: userExists, error: userCheckError } = await supabase.from('users').select('id').eq('email', userEmail).maybeSingle();
    
    if (userCheckError) {
      console.error("Error checking for user email:", userCheckError);
    }

    if (!userExists && !userCheckError) {
      const hashedPassword = await bcrypt.hash("admin123", 10);
      const { error: userInsertError } = await supabase.from('users').insert({
        name: "Felippe",
        email: userEmail,
        password: hashedPassword,
        is_admin: 1,
        status: "Ativo",
        profile_id: adminProfileId
      });
      
      if (userInsertError) {
        console.error("Error creating default user:", userInsertError);
      } else {
        console.log(`Default user created: ${userEmail} / admin123`);
      }
    }

    // List all users for verification
    const { data: allUsers } = await supabase.from('users').select('email, is_admin, status');
    log(`Seeding complete. Current users: ${JSON.stringify(allUsers)}`);
  } catch (e: any) {
    log(`Seeding failed with exception: ${e.message || e}`);
    console.error("Seeding failed with exception:", e);
  }

  // Protect all /api routes except auth public routes
  app.use("/api", (req, res, next) => {
    const publicAuthRoutes = ["/auth/login", "/auth/forgot-password", "/db-check", "/settings"];
    if (publicAuthRoutes.includes(req.path)) return next();
    authenticateToken(req, res, next);
  });

  const updateMaintenanceStatus = async (vehicleId: number, currentKm: number, preFetchedData?: { mTypes: any[], planTypes: any[] }) => {
    try {
      const { data: plans, error } = await supabase
        .from('vehicle_maintenance_plans')
        .select('id, maintenance_type_id, next_service_km, next_service_date, status')
        .eq('vehicle_id', vehicleId);

      if (error || !plans || plans.length === 0) return;

      let mTypes = preFetchedData?.mTypes;
      let planTypes = preFetchedData?.planTypes;

      if (!mTypes || !planTypes) {
        const [mtRes, ptRes] = await Promise.all([
          supabase.from('maintenance_types').select('id, km_interval, time_interval_months'),
          supabase.from('maintenance_plan_types').select('plan_id, maintenance_types ( km_interval, time_interval_months )')
        ]);
        mTypes = mtRes.data || [];
        planTypes = ptRes.data || [];
      }

      const now = new Date();
      const updates = [];

      for (const plan of plans) {
        let status = 'VERDE';
        const directType = (mTypes || []).find((mt: any) => mt.id === plan.maintenance_type_id);
        const relatedPlanTypes = (planTypes || []).filter((pt: any) => pt.plan_id === plan.id);
        
        let kmInterval = directType?.km_interval;
        let timeIntervalMonths = directType?.time_interval_months;

        if (relatedPlanTypes.length > 0) {
          const intervals = relatedPlanTypes.map((pt: any) => pt.maintenance_types).filter(Boolean);
          if (intervals.length > 0) {
            kmInterval = Math.min(...intervals.map((i: any) => i.km_interval || Infinity));
            timeIntervalMonths = Math.min(...intervals.map((i: any) => i.time_interval_months || Infinity));
          }
        }

        if (plan.next_service_km) {
          const remainingKm = plan.next_service_km - currentKm;
          const thresholdKm = (kmInterval || 10000) * 0.15;
          if (remainingKm <= 0) status = 'VERMELHO';
          else if (remainingKm <= thresholdKm) status = 'AMARELO';
        }

        if (plan.next_service_date && status !== 'VERMELHO') {
          const nextDate = new Date(plan.next_service_date);
          const diffDays = Math.ceil((nextDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          if (diffDays <= 0) status = 'VERMELHO';
          else if (diffDays <= 15 && status === 'VERDE') status = 'AMARELO';
        }
        
        if (status !== plan.status) {
          updates.push(supabase.from('vehicle_maintenance_plans').update({ status }).eq('id', plan.id));
        }
      }
      if (updates.length > 0) await Promise.all(updates);
    } catch (e) {
      console.error("Error updating maintenance status:", e);
    }
  };

  const updateAllMaintenancePlans = async () => {
    try {
      const { data: vehicles } = await supabase.from('vehicles').select('id, current_km').eq('status', 'Ativo');
      if (!vehicles) return;
      for (const v of vehicles) {
        await updateMaintenanceStatus(v.id, v.current_km || 0);
      }
    } catch (e) {
      console.error("Error updating all maintenance plans:", e);
    }
  };

  // Auth Routes
  app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body;
    console.log(`Login attempt for email: ${email}`);
    try {
      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .single();

      if (error || !user) {
        console.error(`User not found for email: ${email}. Supabase Error:`, JSON.stringify(error, null, 2));
        return res.status(400).json({ 
          error: "Usuário não encontrado",
          debug: process.env.NODE_ENV !== 'production' ? error : undefined
        });
      }
      if (user.status !== 'Ativo') return res.status(403).json({ error: "Usuário inativo" });

      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) return res.status(400).json({ error: "Senha incorreta" });

      const token = jwt.sign({ id: user.id, email: user.email, is_admin: user.is_admin }, JWT_SECRET, { expiresIn: '7d' });
      const isLocalhost = req.get('host')?.includes('localhost');
      res.cookie('token', token, { 
        httpOnly: true, 
        secure: !isLocalhost, 
        sameSite: isLocalhost ? 'lax' : 'none', 
        maxAge: 24 * 60 * 60 * 1000 
      });
      
      const { data: userWithPermissions, error: permError } = await supabase
        .from('users')
        .select(`
          id, name, email, profile_id, is_admin, status,
          profiles ( permissions, name )
        `)
        .eq('id', user.id)
        .single();

      if (permError || !userWithPermissions) {
        return res.status(500).json({ error: "Erro ao carregar permissões" });
      }

      const rawPermissions = (userWithPermissions as any).profiles?.permissions;
      const permissions = typeof rawPermissions === 'string' ? JSON.parse(rawPermissions || '{}') : (rawPermissions || null);

      const formattedUser = {
        ...userWithPermissions,
        profile_name: (userWithPermissions as any).profiles?.name,
        permissions: permissions,
        token: token // Include token in response for fallback
      };
      
      res.json(formattedUser);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    res.clearCookie('token', { 
      httpOnly: true, 
      secure: true, 
      sameSite: 'none' 
    });
    res.json({ success: true });
  });

  app.get("/api/auth/me", (req: any, res) => {
    res.json(req.user);
  });

  app.post("/api/auth/forgot-password", async (req, res) => {
    const { email } = req.body;
    const { data: user } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single();
    if (user) {
      res.json({ message: "Se o e-mail estiver cadastrado, você receberá instruções para resetar sua senha." });
    } else {
      res.status(404).json({ error: "E-mail não encontrado" });
    }
  });

  app.get("/api/system/last-update", async (req, res) => {
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'last_fuel_import')
        .maybeSingle();
      
      if (error) throw error;
      res.json({ lastUpdate: data?.value || null });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/db-check", async (req, res) => {
    try {
      const { data, error } = await supabase.from('users').select('count', { count: 'exact', head: true });
      if (error) {
        return res.status(500).json({ 
          status: "error", 
          message: "Erro ao acessar tabela 'users'", 
          details: error 
        });
      }
      res.json({ status: "ok", userCount: data });
    } catch (e: any) {
      res.status(500).json({ status: "error", message: e.message });
    }
  });

  app.post("/api/system/reset", checkAdmin, async (req, res) => {
    try {
      const tables = [
        "vehicle_documents",
        "driver_documents",
        "maintenance_order_plans",
        "maintenance_order_types",
        "maintenance_plan_types",
        "vehicle_maintenance_plans",
        "maintenance_orders",
        "fuel_records",
        "plate_mappings",
        "helpers",
        "drivers",
        "fuel_stations",
        "vehicles",
        "models",
        "brands",
        "vehicle_types",
        "fleet_categories",
        "maintenance_types",
        "suppliers",
        "responsible_companies",
        "document_types",
        "settings"
      ];

      for (const table of tables) {
        let error;
        if (table === 'settings') {
          const res = await supabase.from(table).delete().neq('key', 'none');
          error = res.error;
        } else if (table === 'maintenance_order_plans') {
          const res = await supabase.from(table).delete().neq('order_id', -1);
          error = res.error;
        } else if (table === 'maintenance_order_types') {
          const res = await supabase.from(table).delete().neq('order_id', -1);
          error = res.error;
        } else if (table === 'maintenance_plan_types') {
          const res = await supabase.from(table).delete().neq('plan_id', -1);
          error = res.error;
        } else {
          const res = await supabase.from(table).delete().neq('id', -1);
          error = res.error;
        }
        
        if (error) {
          console.error(`Error resetting table ${table}:`, JSON.stringify(error, null, 2));
        }
      }

      res.json({ success: true });
    } catch (e: any) {
      console.error("Reset error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // Settings Endpoints
  app.get("/api/settings", async (req, res) => {
    try {
      const { data: settings, error } = await supabase
        .from('settings')
        .select('key, value');
      
      if (error) throw error;

      const result = settings.reduce((acc: any, curr: any) => {
        acc[curr.key] = curr.value;
        return acc;
      }, {});
      res.json(result);
    } catch (error) {
      console.error("Error fetching settings:", error);
      res.status(500).json({ error: "Erro ao buscar configurações" });
    }
  });

  app.post("/api/settings", checkAdmin, async (req, res) => {
    try {
      const { key, value } = req.body;
      if (!key) return res.status(400).json({ error: "Chave é obrigatória" });
      
      const { error } = await supabase
        .from('settings')
        .upsert({ key, value }, { onConflict: 'key' });
      
      if (error) throw error;
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error saving setting:", error);
      res.status(500).json({ error: "Erro ao salvar configuração" });
    }
  });

  // Auxiliary Table Endpoints
  app.delete("/api/fleet-vehicles/:id", checkPermission('registrations', 'delete', 'vehicles'), async (req, res) => {
    const { id } = req.params;
    try {
      const { error } = await supabase
        .from('vehicles')
        .delete()
        .eq('id', id);
      if (error) throw error;
      res.json({ success: true });
    } catch (e: any) {
      let errorMessage = e.message;
      if (e.code === '23503') {
        errorMessage = "Não é possível excluir este veículo pois ele possui registros vinculados (ex: abastecimentos ou ordens de manutenção). Tente desativá-lo em vez de excluir.";
      }
      res.status(400).json({ error: errorMessage });
    }
  });

  app.get("/api/fleet-categories", checkAnyPermission([
    { module: 'registrations', action: 'view', subModule: 'auxiliary_tables' },
    { module: 'maintenance_board', action: 'access' },
    { module: 'maintenance_plan', action: 'access' }
  ]), async (req, res) => {
    const { data, error } = await supabase
      .from('fleet_categories')
      .select('*')
      .order('name');
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  app.get("/api/fleet-categories/export", checkPermission('registrations', 'export', 'auxiliary_tables'), async (req, res) => {
    const { data, error } = await supabase.from('fleet_categories').select('*').order('name');
    if (error) return res.status(500).json({ error: error.message });
    const formatted = data.map(item => ({ ID: item.id, Nome: item.name, Status: item.status }));
    res.json(formatted);
  });

  app.post("/api/fleet-categories", checkPermission('registrations', 'create', 'auxiliary_tables'), async (req, res) => {
    const name = normalizeName(req.body.name);
    try {
      const { data: existing } = await supabase
        .from('fleet_categories')
        .select('id')
        .ilike('name', name)
        .single();
      
      if (existing) return res.json({ id: existing.id });
      
      const { data, error } = await supabase
        .from('fleet_categories')
        .insert({ name })
        .select()
        .single();
      
      if (error) throw error;
      res.json({ id: data.id });
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  app.put("/api/fleet-categories/:id", checkPermission('registrations', 'edit', 'auxiliary_tables'), async (req, res) => {
    const { id } = req.params;
    const { name, status } = req.body;
    try {
      let updateData: any = {};
      if (status) updateData.status = status;
      if (name) updateData.name = name;

      const { error } = await supabase
        .from('fleet_categories')
        .update(updateData)
        .eq('id', id);
      
      if (error) throw error;
      res.json({ success: true });
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  app.delete("/api/fleet-categories/:id", checkPermission('registrations', 'delete', 'auxiliary_tables'), async (req, res) => {
    const { id } = req.params;
    try {
      const { error } = await supabase
        .from('fleet_categories')
        .delete()
        .eq('id', id);
      if (error) throw error;
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.get("/api/responsible-companies", checkAnyPermission([
    { module: 'registrations', action: 'view', subModule: 'auxiliary_tables' },
    { module: 'maintenance_board', action: 'access' },
    { module: 'maintenance_plan', action: 'access' }
  ]), async (req, res) => {
    const { data, error } = await supabase.from('responsible_companies').select('*').order('name');
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  app.get("/api/responsible-companies/export", checkPermission('registrations', 'export', 'auxiliary_tables'), async (req, res) => {
    const { data, error } = await supabase.from('responsible_companies').select('*').order('name');
    if (error) return res.status(500).json({ error: error.message });
    const formatted = data.map(item => ({ ID: item.id, Nome: item.name, Status: item.status }));
    res.json(formatted);
  });

  app.post("/api/responsible-companies", checkPermission('registrations', 'create', 'auxiliary_tables'), async (req, res) => {
    const name = normalizeName(req.body.name);
    try {
      const { data: existing } = await supabase.from('responsible_companies').select('id').ilike('name', name).maybeSingle();
      if (existing) return res.json({ id: existing.id });
      
      const { data, error } = await supabase.from('responsible_companies').insert({ name }).select().single();
      if (error) throw error;
      res.json({ id: data.id });
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  app.put("/api/responsible-companies/:id", checkPermission('registrations', 'edit', 'auxiliary_tables'), async (req, res) => {
    const { id } = req.params;
    const { name, status } = req.body;
    try {
      const updateData: any = {};
      if (name) updateData.name = name;
      if (status) updateData.status = status;
      const { error } = await supabase.from('responsible_companies').update(updateData).eq('id', id);
      if (error) throw error;
      res.json({ success: true });
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  app.delete("/api/responsible-companies/:id", checkPermission('registrations', 'delete', 'auxiliary_tables'), async (req, res) => {
    const { id } = req.params;
    try {
      const { error } = await supabase.from('responsible_companies').delete().eq('id', id);
      if (error) throw error;
      res.json({ success: true });
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  app.get("/api/vehicle-types", checkAnyPermission([
    { module: 'registrations', action: 'view', subModule: 'auxiliary_tables' },
    { module: 'maintenance_board', action: 'access' },
    { module: 'maintenance_plan', action: 'access' }
  ]), async (req, res) => {
    const { data, error } = await supabase.from('vehicle_types').select('*').order('name');
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  app.get("/api/vehicle-types/export", checkPermission('registrations', 'export', 'auxiliary_tables'), async (req, res) => {
    const { data, error } = await supabase.from('vehicle_types').select('*').order('name');
    if (error) return res.status(500).json({ error: error.message });
    const formatted = data.map(item => ({ ID: item.id, Nome: item.name, Status: item.status }));
    res.json(formatted);
  });

  app.post("/api/vehicle-types", checkPermission('registrations', 'create', 'auxiliary_tables'), async (req, res) => {
    const name = normalizeName(req.body.name);
    try {
      const { data: existing } = await supabase.from('vehicle_types').select('id').ilike('name', name).maybeSingle();
      if (existing) return res.json({ id: existing.id });

      const { data, error } = await supabase.from('vehicle_types').insert({ name }).select().single();
      if (error) throw error;
      res.json({ id: data.id });
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  app.put("/api/vehicle-types/:id", checkPermission('registrations', 'edit', 'auxiliary_tables'), async (req, res) => {
    const { id } = req.params;
    const { name, status } = req.body;
    try {
      const updateData: any = {};
      if (name) updateData.name = name;
      if (status) updateData.status = status;
      const { error } = await supabase.from('vehicle_types').update(updateData).eq('id', id);
      if (error) throw error;
      res.json({ success: true });
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  app.delete("/api/vehicle-types/:id", checkPermission('registrations', 'delete', 'auxiliary_tables'), async (req, res) => {
    const { id } = req.params;
    try {
      const { error } = await supabase.from('vehicle_types').delete().eq('id', id);
      if (error) throw error;
      res.json({ success: true });
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  app.get("/api/brands", checkAnyPermission([
    { module: 'registrations', action: 'view', subModule: 'auxiliary_tables' },
    { module: 'maintenance_board', action: 'access' },
    { module: 'maintenance_plan', action: 'access' }
  ]), async (req, res) => {
    const { data, error } = await supabase.from('brands').select('*').order('name');
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  app.get("/api/brands/export", checkPermission('registrations', 'export', 'auxiliary_tables'), async (req, res) => {
    const { data, error } = await supabase.from('brands').select('*').order('name');
    if (error) return res.status(500).json({ error: error.message });
    const formatted = data.map(item => ({ ID: item.id, Nome: item.name, Status: item.status }));
    res.json(formatted);
  });

  app.post("/api/brands", checkPermission('registrations', 'create', 'auxiliary_tables'), async (req, res) => {
    const name = normalizeName(req.body.name);
    try {
      const { data: existing } = await supabase.from('brands').select('id').ilike('name', name).maybeSingle();
      if (existing) return res.json({ id: existing.id });

      const { data, error } = await supabase.from('brands').insert({ name }).select().single();
      if (error) throw error;
      res.json({ id: data.id });
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  app.put("/api/brands/:id", checkPermission('registrations', 'edit', 'auxiliary_tables'), async (req, res) => {
    const { id } = req.params;
    const { name, status } = req.body;
    try {
      const updateData: any = {};
      if (name) updateData.name = name;
      if (status) updateData.status = status;
      const { error } = await supabase.from('brands').update(updateData).eq('id', id);
      if (error) throw error;
      res.json({ success: true });
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  app.delete("/api/brands/:id", checkPermission('registrations', 'delete', 'auxiliary_tables'), async (req, res) => {
    const { id } = req.params;
    try {
      const { error } = await supabase.from('brands').delete().eq('id', id);
      if (error) throw error;
      res.json({ success: true });
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  app.get("/api/suppliers", checkAnyPermission([
    { module: 'registrations', action: 'view', subModule: 'suppliers' },
    { module: 'maintenance_board', action: 'access' },
    { module: 'maintenance_plan', action: 'access' }
  ]), async (req, res) => {
    const { data, error } = await supabase.from('suppliers').select('*').order('name');
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  app.get("/api/suppliers/export", checkPermission('registrations', 'export', 'suppliers'), async (req, res) => {
    const { data, error } = await supabase
      .from('suppliers')
      .select('*')
      .order('name');
    
    if (error) return res.status(500).json({ error: error.message });
    
    const formatted = data.map(s => ({
      ID: s.id,
      Nome: s.name,
      CNPJ: s.cnpj,
      Telefone: s.phone,
      Email: s.email,
      Endereço: s.address,
      Status: s.status
    }));
    
    res.json(formatted);
  });

  app.get("/api/cnpj/:cnpj", checkPermission('registrations', 'view', 'suppliers'), async (req, res) => {
    const { cnpj } = req.params;
    try {
      let response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, {
        headers: {
          'User-Agent': 'SistemaGestaoFrota/1.0',
          'Accept': 'application/json'
        }
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[BrasilAPI CNPJ Lookup Failed] Status: ${response.status}, Body: ${errorText}`);
        
        // Fallback to ReceitaWS if BrasilAPI fails
        console.log(`[CNPJ Lookup] Falling back to ReceitaWS for CNPJ: ${cnpj}`);
        const fallbackResponse = await fetch(`https://www.receitaws.com.br/v1/cnpj/${cnpj}`, {
          headers: {
            'Accept': 'application/json'
          }
        });
        
        if (!fallbackResponse.ok) {
           const fallbackErrorText = await fallbackResponse.text();
           console.error(`[ReceitaWS CNPJ Lookup Failed] Status: ${fallbackResponse.status}, Body: ${fallbackErrorText}`);
           return res.status(fallbackResponse.status).json({ error: 'CNPJ não encontrado em nenhum serviço' });
        }
        
        const fallbackData = await fallbackResponse.json();
        
        // ReceitaWS returns status: "ERROR" for invalid CNPJs even with 200 OK
        if (fallbackData.status === 'ERROR') {
          return res.status(404).json({ error: fallbackData.message || 'CNPJ não encontrado' });
        }
        
        // Map ReceitaWS data to match BrasilAPI format expected by frontend
        const mappedData = {
          razao_social: fallbackData.nome,
          nome_fantasia: fallbackData.fantasia,
          ddd_telefone_1: fallbackData.telefone,
          email: fallbackData.email,
          logradouro: fallbackData.logradouro,
          numero: fallbackData.numero,
          bairro: fallbackData.bairro,
          cep: fallbackData.cep ? fallbackData.cep.replace(/\D/g, '') : '',
          municipio: fallbackData.municipio,
          uf: fallbackData.uf
        };
        
        return res.json(mappedData);
      }
      
      const data = await response.json();
      res.json(data);
    } catch (e: any) {
      console.error('[CNPJ Lookup Error]', e);
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/suppliers", checkPermission('registrations', 'create', 'suppliers'), async (req, res) => {
    const { name, trade_name, cnpj, phone, email, street, number, neighborhood, zip_code, city, state } = req.body;
    const cleanCnpj = cnpj ? cnpj.replace(/\D/g, '') : null;
    try {
      if (cleanCnpj) {
        const { data: existing } = await supabase.from('suppliers').select('id').eq('cnpj', cleanCnpj).maybeSingle();
        if (existing) {
          const { error } = await supabase.from('suppliers').update({
            name, trade_name: trade_name || null, phone, email, street, 
            number, neighborhood, zip_code, city, state,
            status: 'Ativo'
          }).eq('id', existing.id);
          if (error) throw error;
          return res.json({ id: existing.id, updated: true });
        }
      }
      const { data, error } = await supabase.from('suppliers').insert({
        name, trade_name: trade_name || null, cnpj: cleanCnpj, phone, email, street, 
        number, neighborhood, zip_code, city, state
      }).select().single();
      if (error) throw error;
      res.json({ id: data.id });
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  app.put("/api/suppliers/:id", checkPermission('registrations', 'edit', 'suppliers'), async (req, res) => {
    const { id } = req.params;
    const { name, trade_name, cnpj, phone, email, street, number, neighborhood, zip_code, city, state, status } = req.body;
    const cleanCnpj = cnpj !== undefined ? (cnpj ? cnpj.replace(/\D/g, '') : null) : undefined;
    try {
      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (trade_name !== undefined) updateData.trade_name = trade_name;
      if (cleanCnpj !== undefined) updateData.cnpj = cleanCnpj;
      if (phone !== undefined) updateData.phone = phone;
      if (email !== undefined) updateData.email = email;
      if (street !== undefined) updateData.street = street;
      if (number !== undefined) updateData.number = number;
      if (neighborhood !== undefined) updateData.neighborhood = neighborhood;
      if (zip_code !== undefined) updateData.zip_code = zip_code;
      if (city !== undefined) updateData.city = city;
      if (state !== undefined) updateData.state = state;
      if (status !== undefined) updateData.status = status;

      const { error } = await supabase.from('suppliers').update(updateData).eq('id', id);
      if (error) throw error;
      res.json({ success: true });
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  app.delete("/api/suppliers/:id", checkPermission('registrations', 'delete', 'suppliers'), async (req, res) => {
    const { id } = req.params;
    try {
      const { error } = await supabase.from('suppliers').delete().eq('id', id);
      if (error) throw error;
      res.json({ success: true });
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  app.get("/api/models", checkAnyPermission([
    { module: 'registrations', action: 'view', subModule: 'auxiliary_tables' },
    { module: 'maintenance_board', action: 'access' },
    { module: 'maintenance_plan', action: 'access' }
  ]), async (req, res) => {
    const { brand_id } = req.query;
    let query = supabase.from('models').select('*, brands(name)');
    if (brand_id) {
      query = query.eq('brand_id', brand_id);
    }
    const { data, error } = await query.order('name');
    if (error) return res.status(500).json({ error: error.message });
    
    const formattedData = data.map(m => ({
      ...m,
      brand_name: (m as any).brands?.name
    }));
    res.json(formattedData);
  });

  app.get("/api/models/export", checkPermission('registrations', 'export', 'auxiliary_tables'), async (req, res) => {
    const { data, error } = await supabase
      .from('models')
      .select('*, brands(name)')
      .order('name');
    if (error) return res.status(500).json({ error: error.message });
    const formatted = data.map(item => ({ 
      ID: item.id, 
      Nome: item.name, 
      Marca: (item as any).brands?.name,
      "Meta Consumo": item.target_consumption,
      Status: item.status 
    }));
    res.json(formatted);
  });

  app.post("/api/models", checkPermission('registrations', 'create', 'auxiliary_tables'), async (req, res) => {
    const { brand_id, target_consumption } = req.body;
    const name = normalizeName(req.body.name);
    const cleanTargetConsumption = target_consumption === '' || target_consumption === undefined || target_consumption === null ? null : parseFloat(target_consumption);
    
    try {
      const { data: existing } = await supabase.from('models').select('id').ilike('name', name).eq('brand_id', brand_id).maybeSingle();
      if (existing) {
        if (cleanTargetConsumption !== null) {
          await supabase.from('models').update({ target_consumption: cleanTargetConsumption }).eq('id', existing.id);
        }
        return res.json({ id: existing.id });
      }

      const { data, error } = await supabase.from('models').insert({ brand_id, name, target_consumption: cleanTargetConsumption }).select().single();
      if (error) throw error;
      res.json({ id: data.id });
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  app.put("/api/models/:id", checkPermission('registrations', 'edit', 'auxiliary_tables'), async (req, res) => {
    const { id } = req.params;
    const { brand_id, name, target_consumption, status } = req.body;
    const cleanTargetConsumption = target_consumption === '' || target_consumption === undefined || target_consumption === null ? null : parseFloat(target_consumption);
    try {
      const updateData: any = {};
      if (brand_id) updateData.brand_id = brand_id;
      if (name) updateData.name = name;
      if (target_consumption !== undefined) updateData.target_consumption = cleanTargetConsumption;
      if (status) updateData.status = status;
      const { error } = await supabase.from('models').update(updateData).eq('id', id);
      if (error) throw error;
      res.json({ success: true });
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  app.delete("/api/models/:id", checkPermission('registrations', 'delete', 'auxiliary_tables'), async (req, res) => {
    const { id } = req.params;
    try {
      const { error } = await supabase.from('models').delete().eq('id', id);
      if (error) throw error;
      res.json({ success: true });
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  app.get("/api/fleet-vehicles", checkAnyPermission([
    { module: 'registrations', action: 'view', subModule: 'vehicles' },
    { module: 'maintenance_board', action: 'access' },
    { module: 'maintenance_plan', action: 'access' }
  ]), async (req, res) => {
    const query = supabase
      .from('vehicles')
      .select(`
        *,
        drivers ( name ),
        brands ( name ),
        models ( name, target_consumption ),
        vehicle_types ( name ),
        fleet_categories ( name ),
        responsible_companies ( name )
      `)
      .order('plate');
    
    try {
      const data = await fetchAllPages(query);
      
      const formattedVehicles = data.map(v => ({
        ...v,
        driver_name: (v as any).drivers?.name,
        brand_name: (v as any).brands?.name,
        model_name: (v as any).models?.name,
        target_consumption: (v as any).models?.target_consumption,
        vehicle_type_name: (v as any).vehicle_types?.name,
        fleet_category_name: (v as any).fleet_categories?.name,
        responsible_company_name: (v as any).responsible_companies?.name
      }));
      
      res.json(formattedVehicles);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/fleet-vehicles/export", checkPermission('registrations', 'export', 'vehicles'), async (req, res) => {
    const { data, error } = await supabase
      .from('vehicles')
      .select(`
        id, plate, manufacture_year, model_year, renavam, chassis, fuel_type, tank_capacity, status, branch,
        brands ( name ),
        models ( name, target_consumption ),
        vehicle_types ( name ),
        fleet_categories ( name ),
        responsible_companies ( name ),
        drivers ( name )
      `)
      .order('plate');
    
    if (error) return res.status(500).json({ error: error.message });
    
    const formatted = data.map(v => ({
      ID: v.id,
      Placa: v.plate,
      Marca: (v as any).brands?.name,
      Modelo: (v as any).models?.name,
      "Meta Consumo": (v as any).models?.target_consumption,
      "Ano Fabricação": v.manufacture_year,
      "Ano Modelo": v.model_year,
      Renavam: v.renavam,
      Chassi: v.chassis,
      Tipo: (v as any).vehicle_types?.name,
      Frota: (v as any).fleet_categories?.name,
      "Responsável": (v as any).responsible_companies?.name,
      "Combustível": v.fuel_type,
      "Capacidade Tanque": v.tank_capacity,
      Motorista: (v as any).drivers?.name,
      Status: v.status,
      Filial: v.branch
    }));
    
    res.json(formatted);
  });

  app.post("/api/fleet-vehicles/import", checkPermission('registrations', 'edit', 'vehicles'), async (req, res) => {
    const data = req.body;
    if (!Array.isArray(data)) return res.status(400).json({ error: "Dados inválidos" });

    try {
      // Fetch all existing vehicles to match by plate if ID is missing
      const { data: existingVehicles } = await supabase.from('vehicles').select('id, plate');
      const vehicleByCleanPlate = new Map();
      existingVehicles?.forEach(v => {
        const clean = v.plate.toUpperCase().replace(/[^A-Z0-9]/g, '');
        vehicleByCleanPlate.set(clean, v.id);
      });

      for (const row of data) {
        let id = row.ID || row.id;
        const cleanPlate = (row.Placa || row.plate)?.toString().toUpperCase().replace(/[^A-Z0-9]/g, '');
        
        if (!id && cleanPlate) {
          id = vehicleByCleanPlate.get(cleanPlate);
        }
        
        if (!id) continue;

        // Lookup IDs for names
        const brandName = row.Marca || row.brand;
        const modelName = row.Modelo || row.model;
        const typeName = row.Tipo || row.type;
        const categoryName = row.Frota || row.category;
        const responsibleName = row["Responsável"] || row.responsible;
        const driverName = row.Motorista || row.driver;

        let brandId = null;
        if (brandName) {
          const { data: b } = await supabase.from('brands').select('id').eq('name', normalizeName(brandName)).single();
          brandId = b?.id || null;
        }

        let modelId = null;
        if (modelName && brandId) {
          const { data: m } = await supabase.from('models').select('id').eq('name', normalizeName(modelName)).eq('brand_id', brandId).single();
          modelId = m?.id || null;
        }

        let typeId = null;
        if (typeName) {
          const { data: t } = await supabase.from('vehicle_types').select('id').eq('name', normalizeName(typeName)).single();
          typeId = t?.id || null;
        }

        let categoryId = null;
        if (categoryName) {
          const { data: c } = await supabase.from('fleet_categories').select('id').eq('name', normalizeName(categoryName)).single();
          categoryId = c?.id || null;
        }

        let responsibleId = null;
        if (responsibleName) {
          const { data: r } = await supabase.from('responsible_companies').select('id').eq('name', normalizeName(responsibleName)).single();
          responsibleId = r?.id || null;
        }

        let driverId = null;
        if (driverName) {
          const { data: d } = await supabase.from('drivers').select('id').eq('name', normalizeName(driverName)).single();
          driverId = d?.id || null;
        }

        await supabase.from('vehicles').update({
          plate: cleanPlate,
          brand_id: brandId,
          model_id: modelId,
          manufacture_year: row["Ano Fabricação"] || row.manufacture_year,
          model_year: row["Ano Modelo"] || row.model_year,
          renavam: row.Renavam || row.renavam,
          chassis: row.Chassi || row.chassis,
          vehicle_type_id: typeId,
          fleet_category_id: categoryId,
          responsible_company_id: responsibleId,
          fuel_type: row["Combustível"] || row.fuel_type,
          tank_capacity: row["Capacidade Tanque"] || row.tank_capacity,
          driver_id: driverId,
          status: row.Status || row.status,
          branch: row.Filial || row.branch
        }).eq('id', id);

        // Update model target consumption if provided in vehicle import
        const target_consumption = row["Meta Consumo"] || row.target_consumption || row.Meta;
        if (modelId && target_consumption && parseFloat(target_consumption) > 0) {
          await supabase.from('models').update({ target_consumption: parseFloat(target_consumption) }).eq('id', modelId);
        }
      }
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/fleet-vehicles", checkPermission('registrations', 'create', 'vehicles'), async (req, res) => {
    const { 
      plate, brand_id, model_id, manufacture_year, model_year, 
      renavam, chassis, vehicle_type_id, fleet_category_id, 
      fuel_type, tank_capacity, current_km, driver_id, branch,
      responsible_company_id, notes
    } = req.body;
    
    const cleanPlate = plate ? plate.trim().toUpperCase().replace(/[^A-Z0-9]/g, '') : null;
    const cleanInt = (val: any) => val === '' || val === undefined || val === null ? null : parseInt(val, 10);
    const cleanFloat = (val: any) => val === '' || val === undefined || val === null ? null : parseFloat(val);

    const payload = {
      plate: cleanPlate,
      brand_id: cleanInt(brand_id),
      model_id: cleanInt(model_id),
      manufacture_year: cleanInt(manufacture_year),
      model_year: cleanInt(model_year),
      renavam: renavam || null,
      chassis: chassis || null,
      vehicle_type_id: cleanInt(vehicle_type_id),
      fleet_category_id: cleanInt(fleet_category_id),
      fuel_type: fuel_type || null,
      tank_capacity: cleanFloat(tank_capacity),
      current_km: cleanFloat(current_km),
      driver_id: cleanInt(driver_id),
      branch: branch || null,
      responsible_company_id: cleanInt(responsible_company_id),
      notes: notes || null
    };

    try {
      if (cleanPlate) {
        const { data: existing } = await supabase
          .from('vehicles')
          .select('id')
          .eq('plate', cleanPlate)
          .single();
        
        if (existing) {
          const { error } = await supabase
            .from('vehicles')
            .update({ ...payload, status: 'Ativo' })
            .eq('id', existing.id);
          if (error) throw error;
          return res.json({ id: existing.id, updated: true });
        }
      }
      const { data, error } = await supabase
        .from('vehicles')
        .insert(payload)
        .select()
        .single();
      
      if (error) throw error;
      res.json({ id: data.id });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.put("/api/fleet-vehicles/:id", checkPermission('registrations', 'edit', 'vehicles'), async (req, res) => {
    const { id } = req.params;
    const { 
      plate, brand_id, model_id, manufacture_year, model_year, 
      renavam, chassis, vehicle_type_id, fleet_category_id, 
      fuel_type, tank_capacity, current_km, driver_id, status, branch,
      responsible_company_id, notes
    } = req.body;
    
    const cleanPlate = plate !== undefined ? (plate ? plate.trim().toUpperCase().replace(/[^A-Z0-9]/g, '') : null) : undefined;
    const cleanInt = (val: any) => val === '' || val === undefined || val === null ? null : parseInt(val, 10);
    const cleanFloat = (val: any) => val === '' || val === undefined || val === null ? null : parseFloat(val);

    try {
      let updateData: any = {};
      if (cleanPlate !== undefined) updateData.plate = cleanPlate;
      if (brand_id !== undefined) updateData.brand_id = cleanInt(brand_id);
      if (model_id !== undefined) updateData.model_id = cleanInt(model_id);
      if (manufacture_year !== undefined) updateData.manufacture_year = cleanInt(manufacture_year);
      if (model_year !== undefined) updateData.model_year = cleanInt(model_year);
      if (renavam !== undefined) updateData.renavam = renavam || null;
      if (chassis !== undefined) updateData.chassis = chassis || null;
      if (vehicle_type_id !== undefined) updateData.vehicle_type_id = cleanInt(vehicle_type_id);
      if (fleet_category_id !== undefined) updateData.fleet_category_id = cleanInt(fleet_category_id);
      if (fuel_type !== undefined) updateData.fuel_type = fuel_type || null;
      if (tank_capacity !== undefined) updateData.tank_capacity = cleanFloat(tank_capacity);
      if (current_km !== undefined) updateData.current_km = cleanFloat(current_km);
      if (driver_id !== undefined) updateData.driver_id = cleanInt(driver_id);
      if (status !== undefined) updateData.status = status || null;
      if (branch !== undefined) updateData.branch = branch || null;
      if (responsible_company_id !== undefined) updateData.responsible_company_id = cleanInt(responsible_company_id);
      if (notes !== undefined) updateData.notes = notes || null;

      const { error } = await supabase
        .from('vehicles')
        .update(updateData)
        .eq('id', id);
      
      if (error) throw error;
      res.json({ success: true });
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  app.get("/api/drivers", checkAnyPermission([
    { module: 'registrations', action: 'view', subModule: 'drivers' },
    { module: 'maintenance_board', action: 'access' },
    { module: 'maintenance_plan', action: 'access' }
  ]), async (req, res) => {
    const { data, error } = await supabase
      .from('drivers')
      .select('*, fleet_categories(name)')
      .order('name');
    if (error) return res.status(500).json({ error: error.message });
    
    const drivers = data.map((d: any) => ({
      ...d,
      fleet_category_name: d.fleet_categories?.name
    }));
    
    res.json(drivers);
  });

  app.get("/api/drivers/export", checkPermission('registrations', 'export', 'drivers'), async (req, res) => {
    const { data, error } = await supabase
      .from('drivers')
      .select('id, name, cpf, license_category, license_expiry, status, branch')
      .order('name');
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  app.post("/api/drivers/import", checkPermission('registrations', 'edit', 'drivers'), async (req, res) => {
    const data = req.body;
    if (!Array.isArray(data)) return res.status(400).json({ error: "Dados inválidos" });

    try {
      for (const row of data) {
        if (!row.id) continue;
        const cleanCpf = row.cpf ? String(row.cpf).replace(/\D/g, '') : null;
        await supabase.from('drivers').update({
          name: row.name,
          cpf: cleanCpf,
          license_category: row.license_category,
          license_expiry: row.license_expiry,
          status: row.status,
          branch: row.branch
        }).eq('id', row.id);
      }
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/drivers", checkPermission('registrations', 'create', 'drivers'), async (req, res) => {
    const { name, cpf, license_category, license_expiry, branch, fleet_category_id, notes } = req.body;
    const cleanCpf = cpf ? cpf.replace(/\D/g, '') : null;
    const cleanExpiry = license_expiry === '' ? null : license_expiry;
    const cleanFleetCategoryId = fleet_category_id === '' ? null : fleet_category_id;
    try {
      if (cleanCpf) {
        const { data: existing } = await supabase
          .from('drivers')
          .select('id')
          .eq('cpf', cleanCpf)
          .single();
        
        if (existing) {
          const { error } = await supabase
            .from('drivers')
            .update({ 
              name, 
              license_category, 
              license_expiry: cleanExpiry, 
              branch, 
              fleet_category_id: cleanFleetCategoryId,
              notes: notes || null,
              status: 'Ativo' 
            })
            .eq('id', existing.id);
          if (error) throw error;
          return res.json({ id: existing.id, updated: true });
        }
      }
      const { data, error } = await supabase
        .from('drivers')
        .insert({ 
          name, 
          cpf: cleanCpf, 
          license_category, 
          license_expiry: cleanExpiry, 
          branch,
          fleet_category_id: cleanFleetCategoryId,
          notes: notes || null
        })
        .select()
        .single();
      if (error) throw error;
      res.json({ id: data.id });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.put("/api/drivers/:id", checkPermission('registrations', 'edit', 'drivers'), async (req, res) => {
    const { id } = req.params;
    const { name, cpf, license_category, license_expiry, status, branch, fleet_category_id, notes } = req.body;
    const cleanCpf = cpf !== undefined ? (cpf ? cpf.replace(/\D/g, '') : null) : undefined;
    try {
      let updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (cleanCpf !== undefined) updateData.cpf = cleanCpf;
      if (license_category !== undefined) updateData.license_category = license_category;
      if (license_expiry !== undefined) updateData.license_expiry = license_expiry === '' ? null : license_expiry;
      if (status !== undefined) updateData.status = status;
      if (branch !== undefined) updateData.branch = branch;
      if (fleet_category_id !== undefined) updateData.fleet_category_id = fleet_category_id === '' ? null : fleet_category_id;
      if (notes !== undefined) updateData.notes = notes || null;

      const { error } = await supabase
        .from('drivers')
        .update(updateData)
        .eq('id', id);
      
      if (error) throw error;
      res.json({ success: true });
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  app.post("/api/drivers/sync-from-fuel", checkPermission('registrations', 'edit', 'drivers'), async (req, res) => {
    try {
      const { data: records, error } = await supabase
        .from('fuel_records')
        .select(`
          driver_id,
          date,
          transaction_id,
          branch,
          vehicles ( fleet_category_id )
        `)
        .not('driver_id', 'is', null)
        .order('date', { ascending: false });

      if (error) throw error;

      const driverUpdates = new Map();
      for (const r of records as any[]) {
        if (!r.driver_id) continue;
        if (driverUpdates.has(r.driver_id)) continue;

        const fleetCategoryId = r.vehicles?.fleet_category_id;
        if (fleetCategoryId || r.branch) {
          driverUpdates.set(r.driver_id, {
            fleet_category_id: fleetCategoryId,
            branch: r.branch
          });
        }
      }

      const updates = Array.from(driverUpdates.entries());
      let updatedCount = 0;
      for (const [driverId, data] of updates) {
        const { error: uError } = await supabase
          .from('drivers')
          .update(data)
          .eq('id', driverId);
        if (!uError) updatedCount++;
      }

      res.json({ success: true, updatedCount });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.delete("/api/drivers/:id", checkPermission('registrations', 'delete', 'drivers'), async (req, res) => {
    const { id } = req.params;
    try {
      const { error } = await supabase
        .from('drivers')
        .delete()
        .eq('id', id);
      if (error) throw error;
      res.json({ success: true });
    } catch (e: any) {
      let errorMessage = e.message;
      if (e.code === '23503') {
        errorMessage = "Não é possível excluir este motorista pois ele possui registros vinculados (ex: abastecimentos ou ordens de manutenção). Tente desativá-lo em vez de excluir.";
      }
      res.status(400).json({ error: errorMessage });
    }
  });

  app.post("/api/stations", checkPermission('registrations', 'create', 'auxiliary_tables'), async (req, res) => {
    const { name, city, state } = req.body;
    try {
      const { data, error } = await supabase
        .from('fuel_stations')
        .insert({ name, city, state })
        .select()
        .single();
      if (error) throw error;
      res.json({ id: data.id });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.post("/api/maintenance/plans", checkPermission('maintenance_plan', 'create'), async (req, res) => {
    const { vehicle_id, maintenance_type_id, maintenance_type_ids, last_service_km, next_service_km } = req.body;
    try {
      const ids = maintenance_type_ids || (maintenance_type_id ? [maintenance_type_id] : []);
      
      const { data: lastPlan } = await supabase
        .from('vehicle_maintenance_plans')
        .select('id')
        .order('id', { ascending: false })
        .limit(1)
        .single();
      
      const nextId = (lastPlan?.id || 0) + 1;
      const regNumber = `PLN-${nextId.toString().padStart(4, '0')}`;

      const { data: plan, error: planError } = await supabase
        .from('vehicle_maintenance_plans')
        .insert({
          registration_number: regNumber,
          vehicle_id,
          last_service_km,
          next_service_km
        })
        .select()
        .single();
      
      if (planError) throw planError;
      
      if (ids.length > 0) {
        const typeInserts = ids.filter((id: any) => id).map((id: any) => ({
          plan_id: plan.id,
          maintenance_type_id: id
        }));
        const { error: typeError } = await supabase
          .from('maintenance_plan_types')
          .insert(typeInserts);
        if (typeError) throw typeError;
      }

      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.get("/api/maintenance-types", checkAnyPermission([
    { module: 'registrations', action: 'view', subModule: 'auxiliary_tables' },
    { module: 'maintenance_board', action: 'access' },
    { module: 'maintenance_plan', action: 'access' }
  ]), async (req, res) => {
    const { data, error } = await supabase
      .from('maintenance_types')
      .select('*')
      .order('name');
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  app.get("/api/maintenance-types/export", checkPermission('registrations', 'export', 'auxiliary_tables'), async (req, res) => {
    const { data, error } = await supabase.from('maintenance_types').select('*').order('name');
    if (error) return res.status(500).json({ error: error.message });
    const formatted = data.map(item => ({ 
      ID: item.id, 
      Nome: item.name, 
      Categoria: item.category,
      "Intervalo (KM)": item.interval_km,
      Status: item.status 
    }));
    res.json(formatted);
  });

  // Profiles Endpoints
  app.get("/api/profiles", checkAdmin, async (req, res) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('name');
    if (error) return res.status(500).json({ error: error.message });
    res.json(data.map((p: any) => ({ ...p, permissions: typeof p.permissions === 'string' ? JSON.parse(p.permissions || '{}') : p.permissions })));
  });

  app.post("/api/profiles", checkAdmin, async (req, res) => {
    const { name, permissions } = req.body;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .insert({ name, permissions: JSON.stringify(permissions) })
        .select()
        .single();
      if (error) throw error;
      res.json({ id: data.id });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.put("/api/profiles/:id", checkAdmin, async (req, res) => {
    const { id } = req.params;
    const { name, permissions } = req.body;
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ name, permissions: JSON.stringify(permissions) })
        .eq('id', id);
      if (error) throw error;
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.delete("/api/profiles/:id", checkAdmin, async (req, res) => {
    const { id } = req.params;
    try {
      const { error } = await supabase.from('profiles').delete().eq('id', id);
      if (error) throw error;
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // Users Endpoints
  app.get("/api/users", checkAdmin, async (req, res) => {
    const { data, error } = await supabase
      .from('users')
      .select(`
        *,
        profiles ( name )
      `)
      .order('name');
    
    if (error) return res.status(500).json({ error: error.message });
    
    const formattedUsers = data.map(u => ({
      ...u,
      profile_name: (u as any).profiles?.name
    }));
    
    res.json(formattedUsers);
  });

  app.post("/api/users", checkAdmin, async (req, res) => {
    const { name, email, password, profile_id, is_admin, status } = req.body;
    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      const { data, error } = await supabase
        .from('users')
        .insert({
          name,
          email,
          password: hashedPassword,
          profile_id,
          is_admin: is_admin ? 1 : 0,
          status: status || 'Ativo'
        })
        .select()
        .single();
      
      if (error) throw error;
      res.json({ id: data.id });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.put("/api/users/:id", checkAdmin, async (req, res) => {
    const { id } = req.params;
    const { name, email, password, profile_id, is_admin, status } = req.body;
    try {
      let updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (email !== undefined) updateData.email = email;
      if (profile_id !== undefined) updateData.profile_id = profile_id;
      if (is_admin !== undefined) updateData.is_admin = is_admin ? 1 : 0;
      if (status !== undefined) updateData.status = status;

      if (password) {
        updateData.password = await bcrypt.hash(password, 10);
      }

      const { error } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', id);
      
      if (error) throw error;
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.delete("/api/users/:id", checkAdmin, async (req, res) => {
    const { id } = req.params;
    try {
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', id);
      if (error) throw error;
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.post("/api/maintenance-types", checkPermission('registrations', 'create', 'auxiliary_tables'), async (req, res) => {
    const { name, category, description, km_interval, time_interval_months } = req.body;
    try {
      const { data, error } = await supabase
        .from('maintenance_types')
        .insert({
          name,
          category,
          nature: category,
          description,
          km_interval,
          time_interval_months
        })
        .select()
        .single();
      if (error) throw error;
      res.json({ id: data.id });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.put("/api/maintenance-types/:id", checkPermission('registrations', 'edit', 'auxiliary_tables'), async (req, res) => {
    const { name, category, description, km_interval, time_interval_months, status } = req.body;
    try {
      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (category !== undefined) {
        updateData.category = category;
        updateData.nature = category;
      }
      if (description !== undefined) updateData.description = description;
      if (km_interval !== undefined) updateData.km_interval = km_interval;
      if (time_interval_months !== undefined) updateData.time_interval_months = time_interval_months;
      if (status !== undefined) updateData.status = status;

      const { error } = await supabase
        .from('maintenance_types')
        .update(updateData)
        .eq('id', req.params.id);
      
      if (error) throw error;
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.delete("/api/maintenance-types/:id", checkPermission('registrations', 'delete', 'auxiliary_tables'), async (req, res) => {
    try {
      const { error } = await supabase.from('maintenance_types').delete().eq('id', req.params.id);
      if (error) throw error;
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.get("/api/document-types", checkPermission('registrations', 'view', 'auxiliary_tables'), async (req, res) => {
    const { data, error } = await supabase
      .from('document_types')
      .select('*')
      .order('name', { ascending: true });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  app.get("/api/document-types/export", checkPermission('registrations', 'export', 'auxiliary_tables'), async (req, res) => {
    const { data, error } = await supabase.from('document_types').select('*').order('name');
    if (error) return res.status(500).json({ error: error.message });
    const formatted = data.map(item => ({ 
      ID: item.id, 
      Nome: item.name, 
      Categoria: item.category,
      Status: item.status 
    }));
    res.json(formatted);
  });

  app.post("/api/document-types", checkPermission('registrations', 'create', 'auxiliary_tables'), async (req, res) => {
    const { name, category, status } = req.body;
    try {
      const { data, error } = await supabase
        .from('document_types')
        .insert({ name, category, status: status || 'Ativo' })
        .select()
        .single();
      if (error) throw error;
      res.json({ id: data.id });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.put("/api/document-types/:id", checkPermission('registrations', 'edit', 'auxiliary_tables'), async (req, res) => {
    const { id } = req.params;
    const { name, category, status } = req.body;
    try {
      const { error } = await supabase
        .from('document_types')
        .update({ name, category, status })
        .eq('id', id);
      if (error) throw error;
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.delete("/api/document-types/:id", checkPermission('registrations', 'delete', 'auxiliary_tables'), async (req, res) => {
    const { id } = req.params;
    try {
      const { error } = await supabase.from('document_types').delete().eq('id', id);
      if (error) throw error;
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.put("/api/maintenance-types/:id", checkPermission('registrations', 'edit', 'auxiliary_tables'), async (req, res) => {
    const { name, category, description, km_interval, time_interval_months, status } = req.body;
    try {
      const { error } = await supabase
        .from('maintenance_types')
        .update({
          name,
          category,
          description,
          km_interval,
          time_interval_months,
          status
        })
        .eq('id', req.params.id);

      if (error) throw error;
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.get("/api/helpers", checkAnyPermission([
    { module: 'registrations', action: 'view', subModule: 'helpers' },
    { module: 'maintenance_board', action: 'access' },
    { module: 'maintenance_plan', action: 'access' }
  ]), async (req, res) => {
    const { data, error } = await supabase
      .from('helpers')
      .select('*')
      .order('name');
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });
  
  app.get("/api/helpers/export", checkPermission('registrations', 'export', 'helpers'), async (req, res) => {
    const { data, error } = await supabase
      .from('helpers')
      .select('*')
      .order('name');
    
    if (error) return res.status(500).json({ error: error.message });
    
    const formatted = data.map(h => ({
      ID: h.id,
      Nome: h.name,
      CPF: h.cpf,
      Filial: h.branch,
      Status: h.status
    }));
    
    res.json(formatted);
  });

  app.post("/api/helpers", checkPermission('registrations', 'create', 'helpers'), async (req, res) => {
    const { name, cpf, branch } = req.body;
    const cleanCpf = cpf ? cpf.replace(/\D/g, '') : null;
    try {
      if (cleanCpf) {
        const { data: existing } = await supabase
          .from('helpers')
          .select('id')
          .eq('cpf', cleanCpf)
          .single();
        
        if (existing) {
          const { error } = await supabase
            .from('helpers')
            .update({ name, branch, status: 'Ativo' })
            .eq('id', existing.id);
          if (error) throw error;
          return res.json({ id: existing.id, updated: true });
        }
      }
      const { data, error } = await supabase
        .from('helpers')
        .insert({ name, cpf: cleanCpf, branch })
        .select()
        .single();
      if (error) throw error;
      res.json({ id: data.id });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.put("/api/helpers/:id", checkPermission('registrations', 'edit', 'helpers'), async (req, res) => {
    const { id } = req.params;
    const { name, cpf, branch, status } = req.body;
    const cleanCpf = cpf !== undefined ? (cpf ? cpf.replace(/\D/g, '') : null) : undefined;
    try {
      let updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (cleanCpf !== undefined) updateData.cpf = cleanCpf;
      if (branch !== undefined) updateData.branch = branch;
      if (status !== undefined) updateData.status = status;

      const { error } = await supabase
        .from('helpers')
        .update(updateData)
        .eq('id', id);
      
      if (error) throw error;
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.delete("/api/helpers/:id", checkPermission('registrations', 'delete', 'helpers'), async (req, res) => {
    const { id } = req.params;
    try {
      const { error } = await supabase
        .from('helpers')
        .delete()
        .eq('id', id);
      if (error) throw error;
      res.json({ success: true });
    } catch (e: any) {
      let errorMessage = e.message;
      if (e.code === '23503') {
        errorMessage = "Não é possível excluir este ajudante pois ele possui registros vinculados (ex: abastecimentos). Tente desativá-lo em vez de excluir.";
      }
      res.status(400).json({ error: errorMessage });
    }
  });

  app.get("/api/stations", checkPermission('registrations', 'view', 'auxiliary_tables'), async (req, res) => {
    const { data, error } = await supabase
      .from('fuel_stations')
      .select('*')
      .order('name');
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  app.get("/api/fuel-records", checkPermission('fueling', 'access'), async (req, res) => {
    console.log(`[API] Fetching fuel records for user ${(req as any).user?.email}`);
    const { startDate, endDate, plate, branch } = req.query;

    let query = supabase
      .from('fuel_records')
      .select(`
        *,
        vehicles ( plate ),
        drivers ( name ),
        helpers ( name ),
        fuel_stations ( name )
      `)
      .order('date', { ascending: false });

    if (startDate) query = query.gte('date', startDate as string);
    if (endDate) query = query.lte('date', endDate as string);
    if (branch) query = query.ilike('branch', `%${branch}%`);
    
    // If no filters are applied, limit to 100 to avoid massive payloads
    if (!startDate && !endDate && !plate && !branch) {
      query = query.limit(100);
    } else {
      query = query.limit(2000); // reasonable upper limit for filtered results
    }

    const { data, error } = await query;
    
    if (error) return res.status(500).json({ error: error.message });
    
    let formattedRecords = data.map(fr => ({
      ...fr,
      vehicle_plate: (fr as any).vehicles?.plate,
      driver_name: (fr as any).drivers?.name,
      helper_name: (fr as any).helpers?.name,
      station_name: (fr as any).fuel_stations?.name
    }));

    if (plate) {
      const plateUpper = (plate as string).toUpperCase();
      formattedRecords = formattedRecords.filter(r => r.vehicle_plate?.toUpperCase().includes(plateUpper));
    }
    
    res.json(formattedRecords);
  });

  app.post("/api/fleet-vehicles/map-plate", checkPermission('fueling', 'create'), async (req, res) => {
    const { original_plate, mapped_plate } = req.body;
    try {
      const { error } = await supabase
        .from('plate_mappings')
        .upsert({
          original_plate: original_plate.toUpperCase().replace(/[^A-Z0-9]/g, ''),
          mapped_plate: mapped_plate.toUpperCase().replace(/[^A-Z0-9]/g, '')
        }, { onConflict: 'original_plate' });
      if (error) throw error;
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.post("/api/fuel-records/import", checkPermission('fueling', 'create'), async (req, res) => {
    const { records, dryRun, confirmedMappings, updateExisting } = req.body;
    
    console.log(`[IMPORT] Iniciando importação. dryRun: ${dryRun}, updateExisting: ${updateExisting}`);
    console.log(`[IMPORT] Total de registros recebidos: ${records?.length || 0}`);
    
    if (!records || !Array.isArray(records) || records.length === 0) {
      console.log('[IMPORT] Nenhum registro válido recebido.');
      return res.json({ imported: 0, updated: 0, errors: ['Nenhum registro encontrado no arquivo.'] });
    }

    if (records.length > 0) {
      console.log('[IMPORT] Exemplo do primeiro registro:', JSON.stringify(records[0]));
    }
    
    const results = { 
      imported: 0, 
      updated: 0, 
      errors: [] as string[], 
      potentialDuplicates: [] as any[], 
      duplicateTransactions: [] as string[],
      existingTransactionsCount: 0 
    };

    const checkDuplicates = async () => {
      const transactionIds = records.map(r => r.transaction_id).filter(Boolean);
      let existingCount = 0;
      
      if (transactionIds.length > 0) {
        // Chunk transaction IDs to avoid URL length limits in Supabase
        const chunkSize = 200;
        for (let i = 0; i < transactionIds.length; i += chunkSize) {
          const chunk = transactionIds.slice(i, i + chunkSize);
          const { data: existing, error } = await supabase
            .from('fuel_records')
            .select('transaction_id')
            .in('transaction_id', chunk);
          
          if (error) {
            console.error('[IMPORT] Erro ao verificar duplicados:', error);
          } else if (existing) {
            existingCount += existing.length;
            results.duplicateTransactions.push(...existing.map(e => e.transaction_id));
          }
        }
      }

      const duplicates = [];
      const processedPlates = new Set();
      const rawPlates = records.map(r => r.plate?.toString().toUpperCase().replace(/[^A-Z0-9]/g, '')).filter(Boolean);
      const uniquePlates = Array.from(new Set(rawPlates));

      // Fetch all mappings
      const { data: allMappings } = await supabase.from('plate_mappings').select('original_plate, mapped_plate');
      const mappingMap = new Map(allMappings?.map(m => [m.original_plate, m.mapped_plate]) || []);

      // Fetch all vehicles to avoid N+1 queries
      const { data: allVehicles } = await supabase.from('vehicles').select('id, plate');
      const vehicleMap = new Map();
      allVehicles?.forEach(v => {
        if (v.plate) {
          vehicleMap.set(v.plate.toUpperCase().replace(/[^A-Z0-9]/g, ''), v);
        }
      });

      for (const plate of uniquePlates) {
        if (plate === 'TOTAL') continue;
        if (processedPlates.has(plate)) continue;
        processedPlates.add(plate);

        if (mappingMap.has(plate)) continue;
        if (confirmedMappings && confirmedMappings[plate]) continue;

        if (vehicleMap.has(plate)) continue;

        const equivalent = getMercosulEquivalent(plate);
        if (equivalent && vehicleMap.has(equivalent)) {
          const existingEquivalent = vehicleMap.get(equivalent);
          duplicates.push({
            original: plate,
            equivalent: existingEquivalent.plate,
            equivalentId: existingEquivalent.id
          });
        }
      }
      return { plates: duplicates, existingCount };
    };

    if (dryRun) {
      try {
        const check = await checkDuplicates();
        results.potentialDuplicates = check.plates;
        results.existingTransactionsCount = check.existingCount;
        return res.json(results);
      } catch (e: any) {
        return res.status(500).json({ error: e.message });
      }
    }

    try {
      console.log('[IMPORT] Executando importação real otimizada...');
      console.log('[IMPORT] Backend recebeu registros:', records.length);
      console.log('[IMPORT] Primeiros 5 registros:', JSON.stringify(records.slice(0, 5), null, 2));
      
      // 1. Pre-fetch all necessary data in batch
      const rawPlates = records.map(r => r.plate?.toString().toUpperCase().replace(/[^A-Z0-9]/g, '')).filter(Boolean);
      const uniquePlates = Array.from(new Set(rawPlates));
      
      // Fetch all mappings
      const { data: mappings, error: mError } = await supabase
        .from('plate_mappings')
        .select('original_plate, mapped_plate')
        .in('original_plate', uniquePlates);
      if (mError) {
        console.error('[IMPORT] Erro ao buscar mapeamentos:', mError);
        throw mError;
      }
      const mappingMap = new Map(mappings?.map(m => [m.original_plate, m.mapped_plate]) || []);

      // 2. Identify and batch-create auxiliary entities
      console.log(`[IMPORT] Iniciando processamento de ${records.length} registros...`);
      const uniqueBrands = Array.from(new Set(records.map((r: any) => normalizeName(r.brand || r.vehicle_brand || 'OUTROS'))));
      const uniqueCategories = Array.from(new Set(records.map((r: any) => normalizeName(r.fleet_category || r.fleet_type || 'OUTROS'))));
      const uniqueVTypes = Array.from(new Set(records.map((r: any) => normalizeName(r.vehicle_type || 'OUTROS'))));
      const uniqueDrivers = Array.from(new Set(records.map((r: any) => normalizeName(r.driver)).filter(n => n && n !== 'NÃO INFORMADO')));
      const uniqueHelpers = Array.from(new Set(records.map((r: any) => normalizeName(r.helper)).filter(n => n && n !== 'NÃO INFORMADO')));
      const uniqueStations = Array.from(new Set(records.map((r: any) => normalizeName(r.station)).filter(n => n && n !== 'NÃO INFORMADO')));

      console.log('[IMPORT] Postos únicos encontrados no arquivo:', uniqueStations);

      // Helper function for batch creation
      const batchCreateMissing = async (table: string, names: string[], existingMap: Map<string, number>, extraData: any = {}) => {
        const missing = names.filter(name => name && !existingMap.has(name));
        if (missing.length > 0) {
          console.log(`[IMPORT] Criando ${missing.length} novos registros em ${table}:`, missing);
          const toInsert = missing.map(name => ({ name, ...extraData }));
          const { data, error } = await supabase.from(table).insert(toInsert).select('id, name');
          if (error) {
            console.error(`[IMPORT] Erro ao criar em ${table}:`, error);
          }
          if (data) {
            console.log(`[IMPORT] ${data.length} registros criados com sucesso em ${table}`);
            data.forEach(item => existingMap.set(normalizeName(item.name), item.id));
          }
        }
      };

      // Initial fetch of maps in parallel
      const [
        { data: brands },
        { data: categories },
        { data: vTypes },
        { data: drivers },
        { data: helpers },
        { data: stations }
      ] = await Promise.all([
        supabase.from('brands').select('id, name'),
        supabase.from('fleet_categories').select('id, name'),
        supabase.from('vehicle_types').select('id, name'),
        supabase.from('drivers').select('id, name'),
        supabase.from('helpers').select('id, name'),
        supabase.from('fuel_stations').select('id, name')
      ]);

      const brandMap = new Map(brands?.map(b => [normalizeName(b.name), b.id]) || []);
      const categoryMap = new Map(categories?.map(c => [normalizeName(c.name), c.id]) || []);
      const vTypeMap = new Map(vTypes?.map(vt => [normalizeName(vt.name), vt.id]) || []);
      const driverMap = new Map(drivers?.map(d => [normalizeName(d.name), d.id]) || []);
      const helperMap = new Map(helpers?.map(h => [normalizeName(h.name), h.id]) || []);
      const stationMap = new Map(stations?.map(s => [normalizeName(s.name), s.id]) || []);

      await Promise.all([
        batchCreateMissing('brands', uniqueBrands, brandMap),
        batchCreateMissing('fleet_categories', uniqueCategories, categoryMap),
        batchCreateMissing('vehicle_types', uniqueVTypes, vTypeMap),
        batchCreateMissing('drivers', uniqueDrivers, driverMap, { status: 'Ativo' }),
        batchCreateMissing('helpers', uniqueHelpers, helperMap, { status: 'Ativo' }),
        batchCreateMissing('fuel_stations', uniqueStations, stationMap)
      ]);

      console.log('[IMPORT] Mapeamento de postos (stationMap):', Array.from(stationMap.keys()));
      
      // Models need brand_id, so we handle them separately
      const { data: models } = await supabase.from('models').select('id, name, brand_id');
      const modelMap = new Map(models?.map(m => [`${normalizeName(m.name)}|${m.brand_id}`, m.id]) || []);
      
      const modelsToCreate = [];
      const modelsToUpdate = [];
      const processedModels = new Set();
      for (const r of records as any[]) {
        const brandName = normalizeName(r.brand || r.vehicle_brand || 'OUTROS');
        const modelName = normalizeName(r.model || r.vehicle_model || 'OUTROS');
        const brandId = brandMap.get(brandName);
        const key = `${modelName}|${brandId}`;
        
        if (!modelMap.has(key) && !processedModels.has(key)) {
          modelsToCreate.push({ 
            name: modelName, 
            brand_id: brandId,
            target_consumption: r.target_consumption || null
          });
          processedModels.add(key);
        } else if (modelMap.has(key) && r.target_consumption && !processedModels.has(key)) {
          modelsToUpdate.push({
            id: modelMap.get(key),
            target_consumption: r.target_consumption
          });
          processedModels.add(key);
        }
      }
      
      if (modelsToCreate.length > 0) {
        console.log(`[IMPORT] Criando ${modelsToCreate.length} novos modelos...`);
        const { data: newModels } = await supabase.from('models').insert(modelsToCreate).select('id, name, brand_id');
        if (newModels) newModels.forEach(m => modelMap.set(`${normalizeName(m.name)}|${m.brand_id}`, m.id));
      }
      
      if (modelsToUpdate.length > 0) {
        console.log(`[IMPORT] Atualizando metas de consumo para ${modelsToUpdate.length} modelos...`);
        for (const m of modelsToUpdate) {
          await supabase.from('models').update({ target_consumption: m.target_consumption }).eq('id', m.id);
        }
      }

      // 3. Identify and batch-create missing vehicles
      const { data: vehicles } = await supabase.from('vehicles').select('id, plate, current_km, branch');
      const vehicleMap = new Map();
      vehicles?.forEach(v => {
        if (v.plate) {
          const cleanPlate = v.plate.toUpperCase().replace(/[^A-Z0-9]/g, '');
          vehicleMap.set(cleanPlate, v);
        }
      });

      const vehiclesToCreate = [];
      const processedPlatesForCreation = new Set();
      for (const r of records) {
        if (!r.plate || r.plate === 'Total') continue;
        let plate = r.plate.toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (confirmedMappings && confirmedMappings[plate]) {
          plate = confirmedMappings[plate].toUpperCase().replace(/[^A-Z0-9]/g, '');
        } else if (mappingMap.has(plate)) {
          plate = mappingMap.get(plate).toUpperCase().replace(/[^A-Z0-9]/g, '');
        }

        let vehicle = vehicleMap.get(plate);
        if (!vehicle) {
          const equivalent = getMercosulEquivalent(plate);
          if (equivalent && vehicleMap.has(equivalent)) {
            vehicle = vehicleMap.get(equivalent);
          }
        }

        if (!vehicle && !processedPlatesForCreation.has(plate)) {
          const brandId = brandMap.get(normalizeName(r.brand || r.vehicle_brand || 'OUTROS'));
          const modelId = modelMap.get(`${normalizeName(r.model || r.vehicle_model || 'OUTROS')}|${brandId}`);
          const catId = categoryMap.get(normalizeName(r.fleet_category || r.fleet_type || 'OUTROS'));
          const vtId = vTypeMap.get(normalizeName(r.vehicle_type || 'OUTROS'));

          vehiclesToCreate.push({
            plate: plate,
            brand_id: brandId,
            model_id: modelId,
            fleet_category_id: catId,
            vehicle_type_id: vtId,
            status: 'Ativo',
            current_km: parseFloat(r.odometer) || 0,
            branch: r.branch || null
          });
          processedPlatesForCreation.add(plate);
        }
      }

      if (vehiclesToCreate.length > 0) {
        console.log(`[IMPORT] Criando ${vehiclesToCreate.length} novos veículos...`);
        const { data: newVehicles, error: vError } = await supabase.from('vehicles').insert(vehiclesToCreate).select('id, plate, current_km, branch');
        if (vError) {
          console.error('[IMPORT] Erro ao criar veículos:', vError);
          throw vError;
        }
        if (newVehicles) {
          console.log(`[IMPORT] ${newVehicles.length} veículos criados com sucesso.`);
          newVehicles.forEach(v => {
            const cleanPlate = v.plate.toUpperCase().replace(/[^A-Z0-9]/g, '');
            vehicleMap.set(cleanPlate, v);
          });
        }
      }

      // 4. Process fuel records using the fully populated maps
      if (results.duplicateTransactions.length === 0) {
        const transactionIds = records.map(r => r.transaction_id).filter(Boolean);
        if (transactionIds.length > 0) {
          const chunkSize = 1000;
          // Process duplicate checks in smaller parallel batches to avoid 502
          const concurrency = 5;
          for (let i = 0; i < transactionIds.length; i += chunkSize * concurrency) {
            const batchPromises = [];
            for (let j = 0; j < concurrency && (i + j * chunkSize) < transactionIds.length; j++) {
              const start = i + j * chunkSize;
              const chunk = transactionIds.slice(start, start + chunkSize);
              batchPromises.push(
                supabase
                  .from('fuel_records')
                  .select('transaction_id')
                  .in('transaction_id', chunk)
              );
            }
            const batchResults = await Promise.all(batchPromises);
            batchResults.forEach(({ data }) => {
              if (data) results.duplicateTransactions.push(...data.map(e => e.transaction_id));
            });
          }
        }
      }

      const toInsert = [];
      const toUpdate = [];
      const vehicleUpdates = new Map();
      const driverUpdates = new Map();
      const helperUpdates = new Map();

      for (const row of records) {
        try {
          if (!row.plate || row.plate === 'Total') continue;
          let plate = row.plate.toUpperCase().replace(/[^A-Z0-9]/g, '');
          if (confirmedMappings && confirmedMappings[plate]) {
            plate = confirmedMappings[plate].toUpperCase().replace(/[^A-Z0-9]/g, '');
          } else if (mappingMap.has(plate)) {
            plate = mappingMap.get(plate).toUpperCase().replace(/[^A-Z0-9]/g, '');
          }

          let vehicle = vehicleMap.get(plate);
          if (!vehicle) {
            const equivalent = getMercosulEquivalent(plate);
            if (equivalent && vehicleMap.has(equivalent)) {
              vehicle = vehicleMap.get(equivalent);
            }
          }

          if (!vehicle) {
            console.log(`[IMPORT] Veículo não encontrado para a placa: ${plate}`);
            results.errors.push(`Veículo não encontrado para a placa: ${plate}`);
            continue;
          }

          const driverId = driverMap.get(normalizeName(row.driver)) || null;
          const helperId = helperMap.get(normalizeName(row.helper)) || null;
          const stationId = stationMap.get(normalizeName(row.station)) || null;

          const isDuplicate = results.duplicateTransactions.includes(row.transaction_id);
          if (isDuplicate && !updateExisting) continue;

          const fuelType = row.fuel_type ? row.fuel_type.trim().toUpperCase() : null;
          const service = row.service ? normalizeName(row.service) : null;

          const recordData = {
            transaction_id: row.transaction_id || null,
            vehicle_id: vehicle.id,
            driver_id: driverId,
            helper_id: helperId,
            station_id: stationId,
            date: row.date,
            odometer: parseFloat(row.odometer) || 0,
            liters: parseFloat(row.liters) || 0,
            total_cost: parseFloat(row.total_cost) || 0,
            fuel_type: fuelType,
            service: service,
            branch: row.branch || vehicle.branch || null
          };

          if (isDuplicate && updateExisting) {
            toUpdate.push(recordData);
          } else {
            toInsert.push(recordData);
          }

          // Track latest info based on date and transaction_id
          const recordDate = row.date ? new Date(row.date).getTime() : 0;
          const transactionId = parseInt(row.transaction_id) || 0;
          const fleetCategoryId = categoryMap.get(normalizeName(row.fleet_category || row.fleet_type || 'OUTROS'));
          const branch = row.branch || null;

          // For vehicles
          const existingVUpdate = vehicleUpdates.get(vehicle.id);
          const isVLatest = !existingVUpdate || 
                            recordDate > existingVUpdate.date || 
                            (recordDate === existingVUpdate.date && transactionId > existingVUpdate.transactionId);
          
          if (isVLatest) {
            vehicleUpdates.set(vehicle.id, { 
              km: recordData.odometer, 
              branch: branch,
              fleet_category_id: fleetCategoryId,
              date: recordDate,
              transactionId: transactionId
            });
          }

          // For drivers
          if (driverId) {
            const existingDUpdate = driverUpdates.get(driverId);
            const isDLatest = !existingDUpdate || 
                              recordDate > existingDUpdate.date || 
                              (recordDate === existingDUpdate.date && transactionId > existingDUpdate.transactionId);
            
            if (isDLatest) {
              driverUpdates.set(driverId, {
                branch: branch,
                fleet_category_id: fleetCategoryId,
                date: recordDate,
                transactionId: transactionId
              });
            }
          }

          if (helperId && branch) helperUpdates.set(helperId, branch);
        } catch (err: any) {
          results.errors.push(`Erro ao processar linha: ${err.message}`);
        }
      }

      console.log(`[IMPORT] Preparados para inserir: ${toInsert.length}, para atualizar: ${toUpdate.length}`);

      // 5. Execute batch operations for fuel records
      if (toInsert.length > 0) {
        const chunkSize = 500;
        for (let i = 0; i < toInsert.length; i += chunkSize) {
          const chunk = toInsert.slice(i, i + chunkSize);
          const { error: iError } = await supabase.from('fuel_records').insert(chunk);
          if (iError) throw iError;
        }
        results.imported = toInsert.length;
      }

      if (toUpdate.length > 0) {
        const chunkSize = 500;
        for (let i = 0; i < toUpdate.length; i += chunkSize) {
          const chunk = toUpdate.slice(i, i + chunkSize);
          const { error: uError } = await supabase.from('fuel_records').upsert(chunk, { onConflict: 'transaction_id' });
          if (uError) throw uError;
        }
        results.updated = toUpdate.length;
      }

      // 6. Update related entities in background (batched to avoid overloading)
      (async () => {
        // Pre-fetch maintenance data once for all updates
        const [mtRes, ptRes] = await Promise.all([
          supabase.from('maintenance_types').select('id, km_interval, time_interval_months'),
          supabase.from('maintenance_plan_types').select('plan_id, maintenance_types ( km_interval, time_interval_months )')
        ]);
        const mTypes = mtRes.data || [];
        const planTypes = ptRes.data || [];

        const vEntries = Array.from(vehicleUpdates.entries());
        const batchSize = 5; // Smaller batch size
        for (let i = 0; i < vEntries.length; i += batchSize) {
          const chunk = vEntries.slice(i, i + batchSize);
          await Promise.all(chunk.map(async ([vId, data]) => {
            await supabase.from('vehicles').update({ 
              current_km: data.km, 
              branch: data.branch,
              fleet_category_id: data.fleet_category_id
            }).eq('id', vId);
            await updateMaintenanceStatus(vId, data.km, { mTypes, planTypes }).catch(e => console.error(`[IMPORT] Error updating maintenance:`, e));
          }));
          // Small delay between batches to let Supabase breathe
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        const dEntries = Array.from(driverUpdates.entries());
        for (let i = 0; i < dEntries.length; i += batchSize) {
          const chunk = dEntries.slice(i, i + batchSize);
          await Promise.all(chunk.map(([dId, data]) => 
            supabase.from('drivers').update({ 
              branch: data.branch,
              fleet_category_id: data.fleet_category_id
            }).eq('id', dId)
          ));
          await new Promise(resolve => setTimeout(resolve, 50));
        }

        const hEntries = Array.from(helperUpdates.entries());
        for (let i = 0; i < hEntries.length; i += batchSize) {
          const chunk = hEntries.slice(i, i + batchSize);
          await Promise.all(chunk.map(([hId, branch]) => 
            supabase.from('helpers').update({ branch }).eq('id', hId)
          ));
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      })().catch(e => console.error('[IMPORT] Background updates error:', e));

      await supabase.from('settings').upsert({ 
        key: 'last_fuel_import', 
        value: new Date().toISOString() 
      }, { onConflict: 'key' });

      res.json(results);
    } catch (e: any) {
      console.error('Erro na importação:', e);
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/debug/fuel-count", async (req, res) => {
    try {
      const { count: total, error: totalError } = await supabase
        .from('fuel_records')
        .select('*', { count: 'exact', head: true });
      if (totalError) throw totalError;

      const { count: withVehicle, error: withVehicleError } = await supabase
        .from('fuel_records')
        .select('id', { count: 'exact', head: true })
        .not('vehicle_id', 'is', null);
      if (withVehicleError) throw withVehicleError;

      res.json({ total, withVehicle });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/dashboard/stats", checkPermission('dashboard', 'access'), async (req, res) => {
    try {
      const days = parseInt(req.query.days as string) || 30;
      const plate = (req.query.plate as string || "");
      const model = (req.query.model as string || "");
      const fuelType = (req.query.fuelType as string || "");
      const service = (req.query.service as string || "");
      const fleetCategoryId = req.query.fleetCategoryId as string || "";
      const branch = req.query.branch as string || "";
      const responsibleId = req.query.responsibleId as string || "";
      const consumptionStatus = req.query.consumptionStatus as string || "";

      const now = new Date();
      const startDate = new Date();
      if (days !== 9999) {
        startDate.setDate(now.getDate() - days);
      } else {
        startDate.setFullYear(2000); // Far past
      }
      
      const prevStartDate = new Date(startDate);
      if (days !== 9999) {
        prevStartDate.setDate(startDate.getDate() - days);
      }

      // Build base query for fuel records
      let query = supabase
        .from('fuel_records')
        .select(`
          id, date, odometer, liters, total_cost, vehicle_id, driver_id, station_id, fuel_type, service, branch,
          vehicles!inner (
            plate,
            fleet_category_id,
            responsible_company_id,
            models!inner (
              name,
              target_consumption,
              brands ( name )
            )
          ),
          drivers ( name ),
          fuel_stations ( name )
        `);

      if (days !== 9999) {
        query = query.gte('date', startDate.toISOString());
      }

      if (plate) {
        const plates = plate.split(',').map(p => p.trim().toUpperCase()).filter(Boolean);
        if (plates.length > 0) {
          query = query.in('vehicles.plate', plates);
        }
      }

      if (model) {
        const models = model.split(',').map(m => m.trim().toUpperCase()).filter(Boolean);
        if (models.length > 0) {
          query = query.in('vehicles.models.name', models);
        }
      }

      if (fleetCategoryId) {
        const ids = fleetCategoryId.split(',').map(id => id.trim()).filter(Boolean);
        if (ids.length > 0) {
          query = query.in('vehicles.fleet_category_id', ids);
        }
      }

      if (responsibleId) {
        const ids = responsibleId.split(',').map(id => id.trim()).filter(Boolean);
        if (ids.length > 0) {
          query = query.in('vehicles.responsible_company_id', ids);
        }
      }

      if (fuelType) {
        const types = fuelType.split(',').map(t => t.trim().toUpperCase()).filter(Boolean);
        if (types.length > 0) {
          query = query.in('fuel_type', types);
        }
      }

      if (service) {
        const services = service.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
        if (services.length > 0) {
          query = query.in('service', services);
        }
      }

      if (branch) {
        const branches = branch.split(',').map(b => b.trim()).filter(Boolean);
        if (branches.length > 0) {
          query = query.in('branch', branches);
        }
      }

      // Fetch previous period for trends
      let prevQuery = supabase
        .from('fuel_records')
        .select(`
          total_cost,
          liters,
          vehicles!inner (
            plate,
            fleet_category_id,
            responsible_company_id,
            models!inner (
              name
            )
          )
        `)
        .gte('date', prevStartDate.toISOString())
        .lt('date', startDate.toISOString());

      // Apply same filters to previous query
      if (plate) prevQuery = prevQuery.in('vehicles.plate', plate.split(',').map(p => p.trim().toUpperCase()));
      if (model) prevQuery = prevQuery.in('vehicles.models.name', model.split(',').map(m => m.trim().toUpperCase()));
      if (fleetCategoryId) prevQuery = prevQuery.in('vehicles.fleet_category_id', fleetCategoryId.split(','));
      if (responsibleId) prevQuery = prevQuery.in('vehicles.responsible_company_id', responsibleId.split(','));
      if (fuelType) prevQuery = prevQuery.in('fuel_type', fuelType.split(',').map(t => t.trim().toUpperCase()));
      if (service) prevQuery = prevQuery.in('service', service.split(',').map(s => s.trim().toUpperCase()));
      if (branch) prevQuery = prevQuery.in('branch', branch.split(','));

      const [ records, prevRecords ] = await Promise.all([
        fetchAllPages(query.order('date', { ascending: true })),
        fetchAllPages(prevQuery)
      ]);

      console.log(`[DASHBOARD] Registros encontrados: ${records.length}`);
      
      if (records.length === 0) {
        return res.json({
          totalVehicles: 0,
          totalFuelCost: 0,
          fuelCostTrend: 0,
          totalLiters: 0,
          litersTrend: 0,
          totalRecords: 0,
          consumption: [],
          alerts: [],
          fuelDistribution: [],
          costEvolution: [],
          modelConsumption: [],
          costByVehicle: [],
          costByDriver: [],
          driverConsumption: [],
          stationPriceStats: [],
          stationPriceEvolution: [],
          fuelPriceTrend: [],
          branchStats: [],
          availableFuelTypes: [],
          availableServices: [],
          branches: [],
          cheapestStation: null,
          expensiveStation: null
        });
      }

      // Aggregations
      const totalVehiclesSet = new Set(records.map(r => r.vehicle_id));
      const totalFuelCost = records.reduce((sum, r) => sum + (r.total_cost || 0), 0);
      const totalLiters = records.reduce((sum, r) => sum + (r.liters || 0), 0);
      const totalRecords = records.length;

      const prevFuelCost = prevRecords?.reduce((sum, r) => sum + (r.total_cost || 0), 0) || 0;
      const prevLiters = prevRecords?.reduce((sum, r) => sum + (r.liters || 0), 0) || 0;

      const calculateTrend = (current: number, previous: number) => {
        if (!previous || previous === 0) return current > 0 ? 100 : 0;
        return ((current - previous) / previous) * 100;
      };

      const fuelCostTrend = calculateTrend(totalFuelCost, prevFuelCost);
      const litersTrend = calculateTrend(totalLiters, prevLiters);

      // Consumption by vehicle
      const vehicleStats: { [id: string]: any } = {};
      records.forEach((r: any) => {
        if (!vehicleStats[r.vehicle_id]) {
          vehicleStats[r.vehicle_id] = {
            plate: r.vehicles.plate,
            target_consumption: r.vehicles.models.target_consumption,
            total_km: 0,
            total_liters: 0,
            last_odometer: null
          };
        }
        const stats = vehicleStats[r.vehicle_id];
        if (stats.last_odometer !== null && r.odometer > stats.last_odometer) {
          stats.total_km += (r.odometer - stats.last_odometer);
        }
        stats.last_odometer = r.odometer;
        stats.total_liters += (r.liters || 0);
      });

      const processedConsumption = Object.values(vehicleStats).map(c => {
        const kml = c.total_liters > 0 ? (c.total_km / c.total_liters) : 0;
        let status = 'sem-meta';
        if (c.target_consumption) {
          status = kml >= c.target_consumption ? 'no-alvo' : 'abaixo';
        }
        return { 
          plate: c.plate,
          target_consumption: c.target_consumption,
          total_km: c.total_km,
          total_liters: c.total_liters,
          kml, 
          status 
        };
      });

      const consumptionStatuses = consumptionStatus.split(',').map(s => s.trim()).filter(Boolean);
      const filteredConsumption = processedConsumption.filter(c => consumptionStatuses.length === 0 || consumptionStatuses.includes(c.status));

      // Alerts
      const alerts: any[] = [];
      
      // 1. Odometer inconsistencies
      const odometerIssues: any[] = [];
      const lastOdometers: { [id: string]: number } = {};
      records.forEach((r: any) => {
        if (lastOdometers[r.vehicle_id] !== undefined && r.odometer < lastOdometers[r.vehicle_id]) {
          odometerIssues.push({
            plate: r.vehicles.plate,
            current: r.odometer,
            previous: lastOdometers[r.vehicle_id]
          });
        }
        lastOdometers[r.vehicle_id] = r.odometer;
      });

      odometerIssues.forEach(issue => {
        alerts.push({
          type: 'FRAUDE',
          severity: 'HIGH',
          message: `KM regressivo detectado na placa ${issue.plate}: ${issue.current} < ${issue.previous}`
        });
      });

      // 2. Consumption alerts
      filteredConsumption.forEach(c => {
        if (c.kml > 0 && c.kml < 1.5) {
          alerts.push({
            type: 'CONSUMO',
            severity: 'MEDIUM',
            message: `Consumo muito baixo detectado na placa ${c.plate}: ${c.kml.toFixed(2)} KM/L`
          });
        }
      });

      // 3. Maintenance Alerts
      await updateAllMaintenancePlans();
      const { data: maintenanceAlerts } = await supabase
        .from('vehicle_maintenance_plans')
        .select(`
          status,
          next_service_km,
          next_service_date,
          vehicles ( plate ),
          maintenance_plan_types (
            maintenance_types ( name )
          )
        `)
        .in('status', ['AMARELO', 'VERMELHO']);

      maintenanceAlerts?.forEach((alert: any) => {
        const reason = alert.status === 'VERMELHO' ? 'VENCIDA' : 'PRÓXIMA';
        const detail = alert.next_service_km ? `${alert.next_service_km} KM` : alert.next_service_date;
        const services = alert.maintenance_plan_types?.map((mpt: any) => mpt.maintenance_types?.name).join(', ') || 'Geral';
        alerts.push({
          type: 'MANUTENÇÃO',
          severity: alert.status === 'VERMELHO' ? 'HIGH' : 'MEDIUM',
          message: `Manutenção ${reason} (${services}) para o veículo ${alert.vehicles?.plate}. Limite: ${detail}`
        });
      });

      // Fuel Distribution
      const fuelDistMap: { [type: string]: number } = {};
      records.forEach(r => {
        const type = r.fuel_type || 'NÃO INFORMADO';
        fuelDistMap[type] = (fuelDistMap[type] || 0) + (r.liters || 0);
      });
      const fuelDistribution = Object.entries(fuelDistMap).map(([name, value]) => ({ name, value }));

      // Cost Evolution
      const costEvolMap: { [month: string]: number } = {};
      records.forEach(r => {
        const date = new Date(r.date);
        const month = `${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
        costEvolMap[month] = (costEvolMap[month] || 0) + (r.total_cost || 0);
      });
      const costEvolution = Object.entries(costEvolMap).map(([name, cost]) => ({ name, cost }));

      // Model Consumption
      const modelStats: { [name: string]: any } = {};
      records.forEach((r: any) => {
        const mName = r.vehicles.models.name;
        if (!modelStats[mName]) {
          modelStats[mName] = {
            model_name: mName,
            target_consumption: r.vehicles.models.target_consumption,
            total_km: 0,
            total_liters: 0,
            last_odometer: {}
          };
        }
        const stats = modelStats[mName];
        if (stats.last_odometer[r.vehicle_id] !== undefined && r.odometer > stats.last_odometer[r.vehicle_id]) {
          stats.total_km += (r.odometer - stats.last_odometer[r.vehicle_id]);
        }
        stats.last_odometer[r.vehicle_id] = r.odometer;
        stats.total_liters += (r.liters || 0);
      });
      const modelConsumption = Object.values(modelStats)
        .filter((s: any) => s.total_liters > 0)
        .map((s: any) => {
          const kml = s.total_liters > 0 ? (s.total_km / s.total_liters) : 0;
          let status = 'sem-meta';
          if (s.target_consumption) {
            status = kml >= s.target_consumption ? 'no-alvo' : 'abaixo';
          }
          return {
            model: s.model_name,
            kml,
            target_consumption: s.target_consumption,
            status
          };
        })
        .sort((a, b) => b.kml - a.kml);

      // Additional Stats
      const costByVehicleMap: { [plate: string]: number } = {};
      const costByDriverMap: { [name: string]: number } = {};
      const driverConsMap: { [name: string]: any } = {};
      const stationPriceMap: { [name: string]: { total_price: number, total_liters: number, count: number } } = {};
      const stationPriceEvolMap: { [key: string]: { total_price: number, total_liters: number, count: number } } = {};
      const fuelPriceTrendMap: { [key: string]: { total_price: number, total_liters: number, count: number } } = {};
      const branchStatsMap: { [branch: string]: { total_cost: number, total_liters: number, count: number } } = {};
      const fuelTypesSet = new Set<string>();
      const servicesSet = new Set<string>();
      const branchesSet = new Set<string>();

      records.forEach((r: any) => {
        const plate = r.vehicles.plate;
        const driverName = r.drivers?.name || 'NÃO INFORMADO';
        const stationName = r.fuel_stations?.name || 'NÃO INFORMADO';
        if (stationName === 'NÃO INFORMADO') {
          console.warn(`[DASHBOARD] Registro ${r.id} sem posto (station_id: ${r.station_id})`);
        }
        const date = new Date(r.date);
        const dayMonth = `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}`;
        const monthYear = `${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
        const branchName = r.branch || 'NÃO INFORMADO';

        costByVehicleMap[plate] = (costByVehicleMap[plate] || 0) + (r.total_cost || 0);
        costByDriverMap[driverName] = (costByDriverMap[driverName] || 0) + (r.total_cost || 0);

        if (!driverConsMap[driverName]) {
          driverConsMap[driverName] = { total_km: 0, total_liters: 0, last_odometer: {} };
        }
        const dStats = driverConsMap[driverName];
        if (dStats.last_odometer[r.vehicle_id] !== undefined && r.odometer > dStats.last_odometer[r.vehicle_id]) {
          dStats.total_km += (r.odometer - dStats.last_odometer[r.vehicle_id]);
        }
        dStats.last_odometer[r.vehicle_id] = r.odometer;
        dStats.total_liters += (r.liters || 0);

        if (r.liters > 0) {
          if (!stationPriceMap[stationName]) stationPriceMap[stationName] = { total_price: 0, total_liters: 0, count: 0 };
          stationPriceMap[stationName].total_price += r.total_cost;
          stationPriceMap[stationName].total_liters += r.liters;
          stationPriceMap[stationName].count += 1;

          const evolKey = `${stationName}|${dayMonth}`;
          if (!stationPriceEvolMap[evolKey]) stationPriceEvolMap[evolKey] = { total_price: 0, total_liters: 0, count: 0 };
          stationPriceEvolMap[evolKey].total_price += r.total_cost;
          stationPriceEvolMap[evolKey].total_liters += r.liters;
          stationPriceEvolMap[evolKey].count += 1;

          const trendKey = `${r.fuel_type}|${monthYear}`;
          if (!fuelPriceTrendMap[trendKey]) fuelPriceTrendMap[trendKey] = { total_price: 0, total_liters: 0, count: 0 };
          fuelPriceTrendMap[trendKey].total_price += r.total_cost;
          fuelPriceTrendMap[trendKey].total_liters += r.liters;
          fuelPriceTrendMap[trendKey].count += 1;
        }

        if (!branchStatsMap[branchName]) branchStatsMap[branchName] = { total_cost: 0, total_liters: 0, count: 0 };
        branchStatsMap[branchName].total_cost += (r.total_cost || 0);
        branchStatsMap[branchName].total_liters += (r.liters || 0);
        branchStatsMap[branchName].count += 1;

        if (r.fuel_type) fuelTypesSet.add(r.fuel_type);
        if (r.service) servicesSet.add(r.service);
        if (r.branch) branchesSet.add(r.branch);
      });

      const costByVehicle = Object.entries(costByVehicleMap).map(([plate, total_cost]) => ({ plate, total_cost })).sort((a, b) => b.total_cost - a.total_cost);
      const costByDriver = Object.entries(costByDriverMap).map(([driver_name, total_cost]) => ({ driver_name, total_cost })).sort((a, b) => b.total_cost - a.total_cost);
      const driverConsumption = Object.entries(driverConsMap).map(([driver_name, s]: [string, any]) => ({
        driver: driver_name,
        total_km: s.total_km,
        total_liters: s.total_liters,
        kml: s.total_liters > 0 ? (s.total_km / s.total_liters) : 0
      })).sort((a, b) => b.kml - a.kml);

      const stationPriceStats = Object.entries(stationPriceMap)
        .map(([station_name, s]) => ({
          station_name,
          avg_price: s.total_liters > 0 ? s.total_price / s.total_liters : 0
        }))
        .filter(s => s.avg_price > 0)
        .sort((a, b) => a.avg_price - b.avg_price);

      const stationPriceEvolution = Object.entries(stationPriceEvolMap)
        .map(([key, s]) => {
          const [station_name, day] = key.split('|');
          return { station_name, day, price: s.total_liters > 0 ? s.total_price / s.total_liters : 0 };
        })
        .filter(s => s.price > 0);

      const fuelPriceTrend = Object.entries(fuelPriceTrendMap).map(([key, s]) => {
        const [fuel_type, month] = key.split('|');
        return { fuel_type, month, avg_price: s.total_liters > 0 ? s.total_price / s.total_liters : 0 };
      });

      const branchStats = Object.entries(branchStatsMap).map(([branch, s]) => ({
        branch,
        total_cost: s.total_cost,
        total_liters: s.total_liters,
        total_records: s.count
      })).sort((a, b) => b.total_cost - a.total_cost);

      res.json({
        totalVehicles: totalVehiclesSet.size,
        totalFuelCost,
        fuelCostTrend,
        totalLiters,
        litersTrend,
        totalRecords,
        consumption: filteredConsumption,
        alerts,
        fuelDistribution,
        costEvolution,
        modelConsumption,
        costByVehicle,
        costByDriver,
        driverConsumption,
        stationPriceStats,
        stationPriceEvolution,
        fuelPriceTrend,
        branchStats,
        availableFuelTypes: Array.from(fuelTypesSet).sort(),
        availableServices: Array.from(servicesSet).sort(),
        branches: Array.from(branchesSet).sort(),
        cheapestStation: stationPriceStats[0] || null,
        expensiveStation: stationPriceStats[stationPriceStats.length - 1] || null
      });

    } catch (e: any) {
      console.error('Dashboard stats error:', e);
      res.status(500).json({ error: e.message });
    }
  });

  // REMOVED ORPHANED CODE HERE

  app.get("/api/maintenance/plans", checkPermission('maintenance_plan', 'access'), async (req, res) => {
    try {
      console.log('[MAINTENANCE] Buscando planos de manutenção...');
      // Run update in background to avoid timeout
      updateAllMaintenancePlans().catch(e => console.error('[MAINTENANCE] Background update error:', e));
      
      console.log('[MAINTENANCE] Executando query de planos...');
      const { data: plans, error } = await supabase
        .from('vehicle_maintenance_plans')
        .select('*');

      if (error) {
        console.error("[MAINTENANCE] Supabase error (plans):", JSON.stringify(error, null, 2));
        throw error;
      }

      // Fetch all related data separately to avoid join issues
      const { data: vehicles, error: vError } = await supabase
        .from('vehicles')
        .select('id, plate, current_km, branch, responsible_company_id');
      
      if (vError) console.warn("[MAINTENANCE] Error fetching vehicles:", vError);

      const { data: respCompanies, error: rcError } = await supabase
        .from('responsible_companies')
        .select('id, name');
      
      if (rcError) console.warn("[MAINTENANCE] Error fetching responsible companies:", rcError);

      const { data: mTypes, error: mtError } = await supabase
        .from('maintenance_types')
        .select('id, name, km_interval');
      
      if (mtError) console.warn("[MAINTENANCE] Error fetching maintenance types:", mtError);

      const { data: planTypes, error: ptError } = await supabase
        .from('maintenance_plan_types')
        .select(`
          plan_id,
          maintenance_types ( id, name, km_interval )
        `);
      
      if (ptError) console.warn("[MAINTENANCE] Error fetching plan types:", ptError);

      const { data: orderPlans, error: opError } = await supabase
        .from('maintenance_order_plans')
        .select(`
          plan_id,
          maintenance_orders ( status )
        `);

      if (opError) console.warn("[MAINTENANCE] Error fetching order plans:", opError);

      const processedPlans = (plans || []).map((p: any) => {
        const vehicle = (vehicles || []).find((v: any) => v.id === p.vehicle_id);
        const respCompany = vehicle ? (respCompanies || []).find((rc: any) => rc.id === vehicle.responsible_company_id) : null;
        const directType = (mTypes || []).find((mt: any) => mt.id === p.maintenance_type_id);
        
        const relatedPlanTypes = (planTypes || []).filter((pt: any) => pt.plan_id === p.id);
        const relatedOrderPlans = (orderPlans || []).filter((op: any) => op.plan_id === p.id);

        const typeNames = relatedPlanTypes.length > 0 
          ? relatedPlanTypes.map((pt: any) => pt.maintenance_types?.name).filter(Boolean).join(', ')
          : directType?.name || 'Geral';
        
        const typeIds = relatedPlanTypes.length > 0
          ? relatedPlanTypes.map((pt: any) => pt.maintenance_types?.id).filter(Boolean).join(',')
          : p.maintenance_type_id?.toString() || '';

        const kmInterval = relatedPlanTypes.length > 0
          ? Math.min(...relatedPlanTypes.map((pt: any) => pt.maintenance_types?.km_interval || Infinity))
          : directType?.km_interval || 10000;

        const hasOpenOs = relatedOrderPlans.some((op: any) => op.maintenance_orders?.status === 'Aberta') ? 1 : 0;

        return {
          ...p,
          plate: vehicle?.plate,
          current_km: vehicle?.current_km,
          branch: vehicle?.branch,
          responsible_company_id: vehicle?.responsible_company_id,
          responsible_company_name: respCompany?.name,
          type_name: typeNames,
          maintenance_type_ids: typeIds,
          km_interval: kmInterval === Infinity ? 10000 : kmInterval,
          has_open_os: hasOpenOs
        };
      });

      // Sort in JS
      processedPlans.sort((a, b) => {
        const statusOrder: { [key: string]: number } = { 'VERMELHO': 0, 'AMARELO': 1, 'VERDE': 2 };
        const aOrder = statusOrder[a.status] ?? 3;
        const bOrder = statusOrder[b.status] ?? 3;
        if (aOrder !== bOrder) return aOrder - bOrder;
        return (a.next_service_km - a.current_km) - (b.next_service_km - b.current_km);
      });

      res.json(processedPlans);
    } catch (e: any) {
      console.error("Error fetching maintenance plans:", JSON.stringify(e, null, 2));
      res.status(500).json({ error: e.message || "Erro desconhecido ao buscar planos" });
    }
  });

  app.post("/api/maintenance/complete", checkPermission('maintenance_plan', 'create'), async (req, res) => {
    const { planId, completedKm, cost, notes, supplier, supplierId, serviceDate } = req.body;
    const km = parseFloat(completedKm) || 0;
    const val = parseFloat(cost) || 0;
    const date = serviceDate || new Date().toISOString();
    const sId = supplierId || null;

    try {
      const { data: plan, error: planError } = await supabase
        .from('vehicle_maintenance_plans')
        .select('*')
        .eq('id', planId)
        .single();
      
      if (planError || !plan) return res.status(404).json({ error: "Plano não encontrado" });

      const { data: planTypes } = await supabase
        .from('maintenance_plan_types')
        .select('maintenance_type_id')
        .eq('plan_id', planId);
      
      // Get last order to generate registration number
      const { data: lastOrder } = await supabase
        .from('maintenance_orders')
        .select('id')
        .order('id', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      const nextId = (lastOrder?.id || 0) + 1;
      const regNumber = `OS-${nextId.toString().padStart(4, '0')}`;

      // 1. Create maintenance order
      const { data: order, error: orderError } = await supabase
        .from('maintenance_orders')
        .insert({
          registration_number: regNumber,
          vehicle_id: plan.vehicle_id,
          supplier_id: sId,
          open_date: date,
          close_date: date,
          km: km,
          cost: val,
          notes: notes,
          supplier: supplier,
          maintenance_nature: 'Preventiva',
          status: 'Fechada'
        })
        .select()
        .single();
      
      if (orderError) throw orderError;

      const orderId = order.id;

      // Link maintenance types
      if (planTypes && planTypes.length > 0) {
        const typesToInsert = planTypes.map(pt => ({
          order_id: orderId,
          maintenance_type_id: pt.maintenance_type_id
        }));
        await supabase.from('maintenance_order_types').insert(typesToInsert);
      } else if (plan.maintenance_type_id) {
        await supabase.from('maintenance_order_types').insert({
          order_id: orderId,
          maintenance_type_id: plan.maintenance_type_id
        });
      }

      // 2. Delete plan
      await supabase.from('maintenance_plan_types').delete().eq('plan_id', planId);
      await supabase.from('maintenance_order_plans').delete().eq('plan_id', planId);
      await supabase.from('vehicle_maintenance_plans').delete().eq('id', planId);

      // 3. Update vehicle current KM
      const { data: vehicle } = await supabase.from('vehicles').select('current_km').eq('id', plan.vehicle_id).single();
      if (vehicle && km > (vehicle.current_km || 0)) {
        await supabase.from('vehicles').update({ current_km: km }).eq('id', plan.vehicle_id);
      }

      res.json({ success: true });
    } catch (e: any) {
      console.error("Error completing maintenance:", e);
      res.status(400).json({ error: e.message });
    }
  });

  app.post("/api/maintenance/bulk-complete", checkPermission('maintenance_plan', 'create'), async (req, res) => {
    const { planIds, completedKm, costPerService, notes, supplier, supplierId, serviceDate } = req.body;
    const km = parseFloat(completedKm);
    const val = parseFloat(costPerService) || 0;
    const date = serviceDate || new Date().toISOString();
    const sId = supplierId || null;

    if (isNaN(km)) {
      return res.status(400).json({ error: "Quilometragem de execução é obrigatória para baixa em lote." });
    }

    try {
      let vehicleId: number | null = null;

      for (const planId of planIds) {
        const { data: plan } = await supabase
          .from('vehicle_maintenance_plans')
          .select('*')
          .eq('id', planId)
          .single();
        
        if (!plan) continue;

        // Validate same vehicle
        if (vehicleId === null) {
          vehicleId = plan.vehicle_id;
        } else if (vehicleId !== plan.vehicle_id) {
          throw new Error("A baixa em lote só pode ser realizada para manutenções do mesmo veículo.");
        }

        // Create history
        const { data: order, error: orderError } = await supabase
          .from('maintenance_orders')
          .insert({
            vehicle_id: plan.vehicle_id,
            maintenance_type_id: plan.maintenance_type_id,
            supplier_id: sId,
            open_date: date,
            close_date: date,
            km: km,
            cost: val,
            notes: notes,
            supplier: supplier,
            status: 'Fechada'
          })
          .select()
          .single();
        
        if (orderError) throw orderError;

        await supabase.from('maintenance_order_types').insert({
          order_id: order.id,
          maintenance_type_id: plan.maintenance_type_id
        });

        // Delete plan
        await supabase.from('maintenance_plan_types').delete().eq('plan_id', planId);
        await supabase.from('maintenance_order_plans').delete().eq('plan_id', planId);
        await supabase.from('vehicle_maintenance_plans').delete().eq('id', planId);
      }

      // Update vehicle current_km
      if (vehicleId !== null) {
        const { data: vehicle } = await supabase.from('vehicles').select('current_km').eq('id', vehicleId).single();
        if (vehicle && km > (vehicle.current_km || 0)) {
          await supabase.from('vehicles').update({ current_km: km }).eq('id', vehicleId);
        }
      }

      res.json({ success: true });
    } catch (e: any) {
      console.error("Error bulk completing maintenance:", e);
      res.status(400).json({ error: e.message });
    }
  });

  app.delete("/api/maintenance/plans/:id", checkPermission('maintenance_plan', 'delete'), async (req, res) => {
    const { id } = req.params;
    try {
      // Check if there is an open maintenance order linked to this plan
      const { data: openOrder } = await supabase
        .from('maintenance_order_plans')
        .select(`
          maintenance_orders!inner ( registration_number, status )
        `)
        .eq('plan_id', id)
        .eq('maintenance_orders.status', 'Aberta')
        .maybeSingle();

      if (openOrder) {
        return res.status(400).json({ 
          error: `Não é possível excluir este plano pois ele possui uma OS aberta (${(openOrder as any).maintenance_orders.registration_number}). Exclua a OS primeiro.` 
        });
      }

      // Delete related records first to avoid foreign key constraints
      await supabase.from('maintenance_plan_types').delete().eq('plan_id', id);
      await supabase.from('maintenance_order_plans').delete().eq('plan_id', id);

      const { error } = await supabase.from('vehicle_maintenance_plans').delete().eq('id', id);
      if (error) throw error;
      
      res.json({ success: true });
    } catch (e: any) {
      console.error("Error deleting maintenance plan:", e);
      res.status(400).json({ error: e.message });
    }
  });

  app.post("/api/seed", checkAdmin, async (req, res) => {
    try {
      // 1. Create a few maintenance types
      const mTypes = [
        { name: 'Troca de Óleo', km_interval: 10000, time_interval_months: 6, category: 'Preventiva', nature: 'Preventiva' },
        { name: 'Revisão de Freios', km_interval: 20000, time_interval_months: 12, category: 'Preventiva', nature: 'Preventiva' },
        { name: 'Alinhamento e Balanceamento', km_interval: 5000, time_interval_months: 4, category: 'Preventiva', nature: 'Preventiva' },
        { name: 'Troca de Pneus', km_interval: 40000, time_interval_months: 24, category: 'Preventiva', nature: 'Preventiva' },
        { name: 'Reparo Motor', km_interval: null, time_interval_months: null, category: 'Corretiva', nature: 'Corretiva' },
        { name: 'Reparo Elétrico', km_interval: null, time_interval_months: null, category: 'Corretiva', nature: 'Corretiva' },
        { name: 'Análise de Vibração', km_interval: 15000, time_interval_months: 6, category: 'Preditiva', nature: 'Preditiva' }
      ];

      for (const mt of mTypes) {
        await supabase.from('maintenance_types').upsert(mt, { onConflict: 'name' });
      }

      const { data: types } = await supabase.from('maintenance_types').select('*');

      // 2. Create a few brands and models
      await supabase.from('brands').upsert([{ name: 'VOLKSWAGEN' }, { name: 'FIAT' }], { onConflict: 'name' });
      const { data: vw } = await supabase.from('brands').select('id').eq('name', 'VOLKSWAGEN').single();
      const { data: fiat } = await supabase.from('brands').select('id').eq('name', 'FIAT').single();

      if (vw) await supabase.from('models').upsert({ brand_id: vw.id, name: 'GOL' }, { onConflict: 'name' });
      if (fiat) await supabase.from('models').upsert({ brand_id: fiat.id, name: 'UNO' }, { onConflict: 'name' });
      
      const { data: gol } = await supabase.from('models').select('id').eq('name', 'GOL').single();
      const { data: uno } = await supabase.from('models').select('id').eq('name', 'UNO').single();

      // 3. Create vehicles
      const vData = [
        { plate: 'AAA-1111', model_id: gol?.id, brand_id: vw?.id, current_km: 10500, status: 'Ativo' },
        { plate: 'BBB-2222', model_id: uno?.id, brand_id: fiat?.id, current_km: 9200, status: 'Ativo' },
        { plate: 'CCC-3333', model_id: gol?.id, brand_id: vw?.id, current_km: 1000, status: 'Ativo' }
      ];

      for (const v of vData) {
        const { data: vehicle, error: vError } = await supabase.from('vehicles').upsert(v, { onConflict: 'plate' }).select().single();
        if (vError || !vehicle) continue;
        
        // Add a maintenance plan for each
        const type = types?.find(t => t.name === 'Troca de Óleo');
        if (type) {
          let status = 'VERDE';
          const nextKm = 10000;
          if (v.current_km >= nextKm) {
            status = 'VERMELHO';
          } else if (v.current_km >= nextKm * 0.8) {
            status = 'AMARELO';
          }

          await supabase.from('vehicle_maintenance_plans').upsert({
            vehicle_id: vehicle.id,
            maintenance_type_id: type.id,
            next_service_km: nextKm,
            status: status
          }, { onConflict: 'vehicle_id,maintenance_type_id' });
        }
      }

      res.json({ success: true });
    } catch (e: any) {
      console.error("Seed error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/maintenance/history", checkPermission('maintenance_board', 'access'), async (req, res) => {
    try {
      const { data, error } = await supabase
        .from('maintenance_orders')
        .select(`
          *,
          vehicles (
            plate,
            branch,
            responsible_company_id,
            responsible_companies:responsible_company_id ( name ),
            fleet_categories:fleet_category_id ( name )
          ),
          suppliers ( trade_name, name ),
          drivers ( name ),
          maintenance_order_types (
            maintenance_types ( name, id )
          ),
          maintenance_order_comments (
            id,
            comment,
            user_name,
            created_at,
            user_id
          )
        `)
        .order('open_date', { ascending: false });

      if (error) throw error;

      const formattedHistory = data.map(mo => {
        const v = mo.vehicles as any;
        const s = mo.suppliers as any;
        const d = mo.drivers as any;
        const mot = mo.maintenance_order_types as any[];
        const comments = (mo.maintenance_order_comments as any[]) || [];

        // Sort comments by date descending for the card
        const sortedComments = [...comments].sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );

        let type_name = '';
        let maintenance_type_ids = '';

        if (mot && mot.length > 0) {
          type_name = mot.map(m => m.maintenance_types?.name).filter(Boolean).join(', ');
          maintenance_type_ids = mot.map(m => m.maintenance_types?.id).filter(Boolean).join(',');
        }

        return {
          ...mo,
          service_date: mo.close_date,
          completed_km: mo.km,
          plate: v?.plate,
          branch: v?.branch,
          responsible_company_id: v?.responsible_company_id,
          responsible_company_name: v?.responsible_companies?.name,
          supplier_trade_name: s?.trade_name,
          supplier_name: s?.trade_name || s?.name,
          driver_name: d?.name,
          fleet_category_name: v?.fleet_categories?.name,
          type_name,
          maintenance_type_ids,
          comments: sortedComments
        };
      });

      res.json(formattedHistory);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/maintenance/open", checkPermission('maintenance_board', 'create'), async (req: any, res) => {
    const { vehicleId, maintenanceTypeIds, supplierId, supplier, openDate, estimatedCompletionDate, notes, driverId, maintenanceNature, planIds } = req.body;
    const date = openDate || new Date().toISOString();
    
    try {
      // 1. Check if vehicle already has an open maintenance order
      const { data: existingOrder } = await supabase
        .from('maintenance_orders')
        .select('id, registration_number')
        .eq('vehicle_id', vehicleId)
        .eq('status', 'Aberta')
        .maybeSingle();
      
      if (existingOrder) {
        return res.status(400).json({ 
          error: `Este veículo já possui uma ordem de manutenção aberta (${existingOrder.registration_number}). Não é permitido duplicar placas no quadro.` 
        });
      }

      const { data: lastOrder } = await supabase
        .from('maintenance_orders')
        .select('id')
        .order('id', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      const nextId = (lastOrder?.id || 0) + 1;
      const regNumber = `OS-${nextId.toString().padStart(4, '0')}`;

      const { data: order, error: orderError } = await supabase
        .from('maintenance_orders')
        .insert({
          registration_number: regNumber,
          vehicle_id: vehicleId,
          supplier_id: supplierId || null,
          supplier: supplier || null,
          open_date: date,
          estimated_completion_date: estimatedCompletionDate || null,
          notes: notes || null,
          driver_id: driverId || null,
          maintenance_nature: maintenanceNature || null,
          status: 'Aberta'
        })
        .select()
        .single();
      
      if (orderError) throw orderError;
      
      const orderId = order.id;
      
      // Audit Log
      await logAudit('maintenance_orders', orderId, 'CREATE', req.user, null, order);

      if (maintenanceTypeIds && Array.isArray(maintenanceTypeIds)) {
        const typesToInsert = maintenanceTypeIds.map(typeId => ({
          order_id: orderId,
          maintenance_type_id: typeId
        }));
        const { error: typesError } = await supabase
          .from('maintenance_order_types')
          .insert(typesToInsert);
        if (typesError) throw typesError;
      }

      if (planIds && Array.isArray(planIds)) {
        const plansToInsert = planIds.map(planId => ({
          order_id: orderId,
          plan_id: planId
        }));
        const { error: plansError } = await supabase
          .from('maintenance_order_plans')
          .insert(plansToInsert);
        if (plansError) throw plansError;
      }
      
      // Update vehicle status to 'Em Manutenção'
      const { error: vehicleError } = await supabase
        .from('vehicles')
        .update({ status: 'Em Manutenção' })
        .eq('id', vehicleId);
      if (vehicleError) throw vehicleError;

      res.json({ success: true, id: orderId });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.put("/api/maintenance/orders/:id", checkPermission('maintenance_board', 'edit'), async (req: any, res) => {
    const { id } = req.params;
    const { notes, estimatedCompletionDate, supplierId, supplier, maintenanceNature, maintenanceTypeIds } = req.body;
    
    try {
      const { data: oldOrder } = await supabase
        .from('maintenance_orders')
        .select('*')
        .eq('id', id)
        .single();

      const updateData: any = {
        estimated_completion_date: estimatedCompletionDate || null,
        supplier_id: supplierId || null,
        supplier: supplier || null,
        maintenance_nature: maintenanceNature || null,
        updated_at: new Date().toISOString()
      };

      const { error: updateError } = await supabase
        .from('maintenance_orders')
        .update(updateData)
        .eq('id', id);
      
      if (updateError) throw updateError;

      const { data: newOrder } = await supabase
        .from('maintenance_orders')
        .select('*')
        .eq('id', id)
        .single();
      
      // Check if supplier changed
      if (oldOrder.supplier_id != supplierId || oldOrder.supplier != supplier) {
        let oldSupplierName = oldOrder.supplier || 'Não informado';
        if (oldOrder.supplier_id) {
          const { data: oldSup } = await supabase.from('suppliers').select('trade_name, name').eq('id', oldOrder.supplier_id).single();
          if (oldSup) oldSupplierName = oldSup.trade_name || oldSup.name;
        }
        
        let newSupplierName = supplier || 'Não informado';
        if (supplierId) {
          const { data: newSup } = await supabase.from('suppliers').select('trade_name, name').eq('id', supplierId).single();
          if (newSup) newSupplierName = newSup.trade_name || newSup.name;
        }

        const commentText = `Veículo transferido de oficina: de "${oldSupplierName}" para "${newSupplierName}"`;
        
        await supabase.from('maintenance_order_comments').insert({
          order_id: id,
          comment: commentText,
          user_id: req.user?.id,
          user_name: req.user?.name || req.user?.email || 'Sistema'
        });
      }

      // Audit Log
      await logAudit('maintenance_orders', parseInt(id), 'UPDATE', req.user, oldOrder, newOrder);
      
      if (maintenanceTypeIds && Array.isArray(maintenanceTypeIds)) {
        await supabase.from('maintenance_order_types').delete().eq('order_id', id);
        const typesToInsert = maintenanceTypeIds.map(typeId => ({
          order_id: id,
          maintenance_type_id: typeId
        }));
        await supabase.from('maintenance_order_types').insert(typesToInsert);
      }

      res.json({ success: true });
    } catch (e: any) {
      console.error("Error updating maintenance order:", e);
      res.status(400).json({ error: e.message });
    }
  });

  app.delete("/api/maintenance/orders/:id", checkPermission('maintenance_board', 'delete'), async (req: any, res) => {
    const { id } = req.params;
    try {
      const { data: order } = await supabase
        .from('maintenance_orders')
        .select('*')
        .eq('id', id)
        .single();

      if (order) {
        // Audit Log
        await logAudit('maintenance_orders', parseInt(id), 'DELETE', req.user, order, null);

        await supabase.from('maintenance_order_types').delete().eq('order_id', id);
        await supabase.from('maintenance_order_plans').delete().eq('order_id', id);
        await supabase.from('maintenance_orders').delete().eq('id', id);
        
        // If the deleted order was open, check if we should set vehicle status back to 'Ativo'
        if (order.status === 'Aberta') {
          const { count } = await supabase
            .from('maintenance_orders')
            .select('*', { count: 'exact', head: true })
            .eq('vehicle_id', order.vehicle_id)
            .eq('status', 'Aberta');
          
          if (count === 0) {
            await supabase.from('vehicles').update({ status: 'Ativo' }).eq('id', order.vehicle_id);
          }
        }
      }
      res.json({ success: true });
    } catch (e: any) {
      console.error("Error deleting maintenance order:", e);
      res.status(400).json({ error: e.message });
    }
  });

  app.post("/api/maintenance/orders/:id/close", checkPermission('maintenance_board', 'edit'), async (req: any, res) => {
    const { id } = req.params;
    const { closeDate, km, cost, notes } = req.body;
    const date = closeDate || new Date().toISOString();
    
    // Parse numeric fields to avoid "invalid input syntax for type real: \"\""
    const parsedKm = km !== '' && km !== null ? parseFloat(km) : null;
    const parsedCost = cost !== '' && cost !== null ? parseFloat(cost) : 0;
    
    try {
      const { data: order, error: orderError } = await supabase
        .from('maintenance_orders')
        .select('*')
        .eq('id', id)
        .single();
      
      if (orderError || !order) return res.status(404).json({ error: "Ordem não encontrada" });

      const { data: updatedOrder, error: updateError } = await supabase
        .from('maintenance_orders')
        .update({
          close_date: date,
          km: parsedKm,
          cost: parsedCost,
          status: 'Fechada',
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();
      
      if (updateError) throw updateError;

      if (notes && notes.trim() !== '') {
        await supabase.from('maintenance_order_comments').insert({
          order_id: id,
          user_id: req.user.id,
          user_name: req.user.name,
          comment: `[BAIXA DE MANUTENÇÃO] ${notes}`
        });
      }

      // Audit Log
      await logAudit('maintenance_orders', parseInt(id), 'CLOSE', req.user, order, updatedOrder);
      
      // Update vehicle status back to 'Ativo' and update KM
      const { data: vehicle } = await supabase.from('vehicles').select('current_km').eq('id', order.vehicle_id).single();
      const newKm = Math.max(vehicle?.current_km || 0, parsedKm || 0);
      await supabase.from('vehicles').update({ status: 'Ativo', current_km: newKm }).eq('id', order.vehicle_id);

      // Handle linked plans
      const { data: linkedPlans } = await supabase.from('maintenance_order_plans').select('plan_id').eq('order_id', id);
      if (linkedPlans) {
        for (const lp of linkedPlans) {
          await supabase.from('maintenance_plan_types').delete().eq('plan_id', lp.plan_id);
          await supabase.from('vehicle_maintenance_plans').delete().eq('id', lp.plan_id);
        }
      }
      await supabase.from('maintenance_order_plans').delete().eq('order_id', id);

      // Fallback: If it was linked to a plan by type but not explicitly in maintenance_order_plans
      const { data: types } = await supabase.from('maintenance_order_types').select('maintenance_type_id').eq('order_id', id);
      if (types && types.length > 0) {
        for (const type of types) {
          const { data: plan } = await supabase
            .from('vehicle_maintenance_plans')
            .select('id')
            .eq('vehicle_id', order.vehicle_id)
            .eq('maintenance_type_id', type.maintenance_type_id)
            .maybeSingle();
          
          if (plan) {
            await supabase.from('maintenance_plan_types').delete().eq('plan_id', plan.id);
            await supabase.from('maintenance_order_plans').delete().eq('plan_id', plan.id);
            await supabase.from('vehicle_maintenance_plans').delete().eq('id', plan.id);
          }

          // Also check plans that contain this type in maintenance_plan_types
          const { data: plansWithType } = await supabase
            .from('maintenance_plan_types')
            .select('plan_id')
            .eq('maintenance_type_id', type.maintenance_type_id);
          
          if (plansWithType) {
            for (const pwt of plansWithType) {
              const { data: p } = await supabase
                .from('vehicle_maintenance_plans')
                .select('id')
                .eq('id', pwt.plan_id)
                .eq('vehicle_id', order.vehicle_id)
                .maybeSingle();
              
              if (p) {
                await supabase.from('maintenance_plan_types').delete().eq('plan_id', p.id);
                await supabase.from('maintenance_order_plans').delete().eq('plan_id', p.id);
                await supabase.from('vehicle_maintenance_plans').delete().eq('id', p.id);
              }
            }
          }
        }
      } else if (order.maintenance_type_id) {
        const { data: plan } = await supabase
          .from('vehicle_maintenance_plans')
          .select('id')
          .eq('vehicle_id', order.vehicle_id)
          .eq('maintenance_type_id', order.maintenance_type_id)
          .maybeSingle();
        
        if (plan) {
          await supabase.from('maintenance_plan_types').delete().eq('plan_id', plan.id);
          await supabase.from('maintenance_order_plans').delete().eq('plan_id', plan.id);
          await supabase.from('vehicle_maintenance_plans').delete().eq('id', plan.id);
        }
      }
      
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // Reports Endpoints
  app.get("/api/reports/fuel-consumption", checkPermission('reports', 'access'), async (req, res) => {
    const { startDate, endDate } = req.query;
    try {
      let query = supabase
        .from('fuel_records')
        .select(`
          liters,
          total_cost,
          odometer,
          vehicle_id,
          vehicles ( plate, fuel_type )
        `);
      
      if (startDate) query = query.gte('date', startDate as string);
      if (endDate) query = query.lte('date', endDate as string);

      const records = await fetchAllPages(query);

      const vehicleStats: { [key: number]: any } = {};

      records.forEach(r => {
        const vId = r.vehicle_id;
        if (!vehicleStats[vId]) {
          vehicleStats[vId] = {
            plate: (r.vehicles as any)?.plate,
            fuel_type: (r.vehicles as any)?.fuel_type,
            total_liters: 0,
            total_cost: 0,
            fueling_count: 0,
            start_km: Infinity,
            end_km: -Infinity
          };
        }
        const stats = vehicleStats[vId];
        stats.total_liters += r.liters || 0;
        stats.total_cost += r.total_cost || 0;
        stats.fueling_count += 1;
        stats.start_km = Math.min(stats.start_km, r.odometer || Infinity);
        stats.end_km = Math.max(stats.end_km, r.odometer || -Infinity);
      });

      const result = Object.values(vehicleStats).map(stats => {
        const totalKm = stats.end_km !== -Infinity && stats.start_km !== Infinity ? stats.end_km - stats.start_km : 0;
        const avgKml = stats.total_liters > 0 ? totalKm / stats.total_liters : 0;
        return {
          ...stats,
          total_km: totalKm,
          avg_kml: avgKml
        };
      });

      result.sort((a, b) => b.avg_kml - a.avg_kml);
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/reports/maintenance-costs", checkPermission('reports', 'access'), async (req, res) => {
    const { startDate, endDate } = req.query;
    try {
      let query = supabase
        .from('maintenance_orders')
        .select(`
          cost,
          vehicle_id,
          vehicles ( plate ),
          maintenance_order_types (
            maintenance_types ( name, id )
          )
        `)
        .eq('status', 'Fechada');
      
      if (startDate) query = query.gte('close_date', startDate as string);
      if (endDate) query = query.lte('close_date', endDate as string);

      const { data: orders, error } = await query;
      if (error) throw error;

      const statsMap: { [key: string]: any } = {};

      orders.forEach(o => {
        const mot = o.maintenance_order_types as any[];
        let typeNames = 'Geral';
        let typeIds = 'geral';
        
        if (mot && mot.length > 0) {
          typeNames = mot.map(m => m.maintenance_types?.name).filter(Boolean).join(', ');
          typeIds = mot.map(m => m.maintenance_types?.id).filter(Boolean).join(',');
        }

        const key = `${o.vehicle_id}-${typeIds}`;
        if (!statsMap[key]) {
          statsMap[key] = {
            plate: (o.vehicles as any)?.plate,
            service_type: typeNames,
            total_cost: 0,
            service_count: 0
          };
        }
        statsMap[key].total_cost += o.cost || 0;
        statsMap[key].service_count += 1;
      });

      const result = Object.values(statsMap);
      result.sort((a, b) => b.total_cost - a.total_cost);
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/reports/drivers", checkPermission('reports', 'access'), async (req, res) => {
    try {
      const { data, error } = await supabase
        .from('drivers')
        .select('name, cpf, license_category, license_expiry, status, created_at')
        .order('name', { ascending: true });
      
      if (error) throw error;

      const formatted = data.map(d => ({
        Nome: d.name,
        CPF: d.cpf,
        Categoria_CNH: d.license_category,
        Vencimento_CNH: d.license_expiry,
        Status: d.status,
        Data_Cadastro: d.created_at
      }));

      res.json(formatted);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/reports/vehicles", checkPermission('reports', 'access'), async (req, res) => {
    try {
      const { data, error } = await supabase
        .from('vehicles')
        .select(`
          plate, renavam, chassis, manufacture_year, model_year, fuel_type, current_km, status,
          brands ( name ),
          models ( name, target_consumption ),
          fleet_categories ( name ),
          vehicle_types ( name )
        `)
        .order('plate', { ascending: true });
      
      if (error) throw error;

      const formatted = data.map(v => ({
        Placa: v.plate,
        RENAVAM: v.renavam,
        Chassi: v.chassis,
        Marca: (v.brands as any)?.name,
        Modelo: (v.models as any)?.name,
        Ano_Fab: v.manufacture_year,
        Ano_Mod: v.model_year,
        Combustivel: v.fuel_type,
        KM_Atual: v.current_km,
        Status: v.status,
        Categoria_Frota: (v.fleet_categories as any)?.name,
        Tipo_Veiculo: (v.vehicle_types as any)?.name,
        Meta_Consumo: (v.models as any)?.target_consumption
      }));

      res.json(formatted);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/reports/fleet-summary", checkPermission('reports', 'access'), async (req, res) => {
    try {
      const { data: vehicles, error: vError } = await supabase
        .from('vehicles')
        .select('id, plate, status, current_km')
        .order('plate', { ascending: true });
      
      if (vError) throw vError;

      const result = [];
      for (const v of vehicles) {
        const { count: openOrders } = await supabase
          .from('maintenance_orders')
          .select('*', { count: 'exact', head: true })
          .eq('vehicle_id', v.id)
          .eq('status', 'Aberta');
        
        const { data: lastFueling } = await supabase
          .from('fuel_records')
          .select('date')
          .eq('vehicle_id', v.id)
          .order('date', { ascending: false })
          .limit(1)
          .maybeSingle();

        result.push({
          plate: v.plate,
          status: v.status,
          current_km: v.current_km,
          open_orders: openOrders || 0,
          last_fueling: lastFueling?.date || null
        });
      }

      res.json(result);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/reports/fuel-records", checkPermission('reports', 'access'), async (req, res) => {
    const { startDate, endDate } = req.query;
    try {
      let query = supabase
        .from('fuel_records')
        .select(`
          transaction_id,
          date,
          liters,
          total_cost,
          fuel_type,
          service,
          branch,
          vehicles ( plate ),
          drivers ( name ),
          fuel_stations ( name )
        `)
        .order('date', { ascending: false });
      
      if (startDate) query = query.gte('date', startDate as string);
      if (endDate) query = query.lte('date', endDate as string);

      const records = await fetchAllPages(query);

      const formatted = records.map(fr => ({
        transaction_id: fr.transaction_id,
        data: fr.date ? new Date(fr.date).toLocaleDateString('pt-BR') : '',
        placa: (fr.vehicles as any)?.plate,
        motorista: (fr.drivers as any)?.name,
        posto: (fr.fuel_stations as any)?.name,
        litros: fr.liters,
        valor_total: fr.total_cost,
        combustivel: fr.fuel_type,
        servico: fr.service,
        filial: fr.branch
      }));

      res.json(formatted);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // --- Fleet Documents Endpoints ---

  app.get("/api/fleet-documents/vehicles", checkPermission('fleet_documents', 'access'), async (req, res) => {
    try {
      const { data: docs, error } = await supabase
        .from('vehicle_documents')
        .select(`
          *,
          vehicles ( plate, branch, fleet_category_id, status ),
          document_types ( name )
        `)
        .order('expiration_date', { ascending: true });
      
      if (error) throw error;

      const now = new Date();
      now.setHours(0, 0, 0, 0);
      
      const allDocs = docs
        .filter((doc: any) => doc.vehicles?.status === 'Ativo')
        .map((doc: any) => {
          const expDate = new Date(doc.expiration_date);
          expDate.setHours(0, 0, 0, 0);
          const diffTime = expDate.getTime() - now.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          return { 
            ...doc, 
            entity_plate: doc.vehicles?.plate,
            branch: doc.vehicles?.branch,
            fleet_category_id: doc.vehicles?.fleet_category_id,
            type_name: doc.document_types?.name,
            entity_type: 'vehicle',
            days_until_expiration: diffDays 
          };
        });
      
      res.json(allDocs);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/fleet-documents/vehicles/:vehicleId", checkPermission('fleet_documents', 'access'), async (req, res) => {
    const { vehicleId } = req.params;
    try {
      const { data: docs, error } = await supabase
        .from('vehicle_documents')
        .select(`
          *,
          vehicles ( plate ),
          document_types ( name )
        `)
        .eq('vehicle_id', vehicleId)
        .order('expiration_date', { ascending: true });
      
      if (error) throw error;

      const now = new Date();
      now.setHours(0, 0, 0, 0);
      
      const allDocs = docs.map((doc: any) => {
        const expDate = new Date(doc.expiration_date);
        expDate.setHours(0, 0, 0, 0);
        const diffTime = expDate.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return { 
          ...doc, 
          entity_plate: doc.vehicles?.plate,
          type_name: doc.document_types?.name,
          days_until_expiration: diffDays 
        };
      });
      
      res.json(allDocs);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/fleet-documents/vehicles", checkPermission('fleet_documents', 'create'), async (req, res) => {
    const { vehicle_id, document_type_id, type, expiration_date, notes } = req.body;
    try {
      const { data, error } = await supabase
        .from('vehicle_documents')
        .insert([{ vehicle_id, document_type_id, type, expiration_date, notes }])
        .select()
        .single();
      
      if (error) throw error;
      res.json({ id: data.id });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.put("/api/fleet-documents/vehicles/:id", checkPermission('fleet_documents', 'edit'), async (req, res) => {
    const { id } = req.params;
    const { vehicle_id, document_type_id, type, expiration_date, notes } = req.body;
    try {
      const { error } = await supabase
        .from('vehicle_documents')
        .update({ vehicle_id, document_type_id, type, expiration_date, notes })
        .eq('id', id);
      
      if (error) throw error;
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.delete("/api/fleet-documents/vehicles/:id", checkPermission('fleet_documents', 'delete'), async (req, res) => {
    const { id } = req.params;
    try {
      const { error } = await supabase
        .from('vehicle_documents')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/fleet-documents/drivers", checkPermission('fleet_documents', 'access'), async (req, res) => {
    try {
      const { data: docs, error: dError } = await supabase
        .from('driver_documents')
        .select(`
          *,
          drivers ( name, branch, fleet_category_id, status ),
          document_types ( name )
        `)
        .order('expiration_date', { ascending: true });
      
      if (dError) throw dError;
      
      const { data: cnhType } = await supabase.from('document_types').select('id').eq('name', 'CNH').single();
      const cnhTypeId = cnhType?.id;

      const { data: drivers, error: drError } = await supabase
        .from('drivers')
        .select('id, name, branch, fleet_category_id, license_expiry, status')
        .eq('status', 'Ativo')
        .not('license_expiry', 'is', null);
      
      if (drError) throw drError;

      const cnhDocs = drivers.map(d => ({
        id: `cnh-${d.id}`,
        driver_id: d.id,
        entity_name: d.name,
        branch: d.branch,
        fleet_category_id: d.fleet_category_id,
        type: 'CNH',
        type_name: 'CNH',
        document_type_id: cnhTypeId,
        expiration_date: d.license_expiry,
        entity_type: 'driver',
        is_cnh: 1
      }));

      const now = new Date();
      now.setHours(0, 0, 0, 0);

      const allDocs = [
        ...docs
          .filter((d: any) => d.drivers?.status === 'Ativo')
          .map(d => ({
            ...d,
            entity_name: d.drivers?.name,
            branch: d.drivers?.branch,
            fleet_category_id: d.drivers?.fleet_category_id,
            type_name: d.document_types?.name,
            entity_type: 'driver'
          })), 
        ...cnhDocs
      ].map((doc: any) => {
        const expDate = new Date(doc.expiration_date);
        expDate.setHours(0, 0, 0, 0);
        const diffTime = expDate.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return { ...doc, days_until_expiration: diffDays };
      }).sort((a, b) => a.days_until_expiration - b.days_until_expiration);

      res.json(allDocs);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/fleet-documents/drivers/:driverId", checkPermission('fleet_documents', 'access'), async (req, res) => {
    const { driverId } = req.params;
    try {
      const { data: docs, error: dError } = await supabase
        .from('driver_documents')
        .select(`
          *,
          drivers ( name ),
          document_types ( name )
        `)
        .eq('driver_id', driverId)
        .order('expiration_date', { ascending: true });
      
      if (dError) throw dError;

      const { data: driver, error: drError } = await supabase
        .from('drivers')
        .select('name, license_expiry')
        .eq('id', driverId)
        .maybeSingle();
      
      if (drError) throw drError;

      const now = new Date();
      now.setHours(0, 0, 0, 0);

      const formattedDocs = docs.map(d => ({
        ...d,
        entity_name: d.drivers?.name,
        type_name: d.document_types?.name
      }));

      if (driver && driver.license_expiry) {
        const { data: cnhType } = await supabase.from('document_types').select('id').eq('name', 'CNH').single();
        const cnhTypeId = cnhType?.id;

        const expDate = new Date(driver.license_expiry);
        expDate.setHours(0, 0, 0, 0);
        const diffTime = expDate.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        formattedDocs.push({
          id: `cnh-${driverId}`,
          driver_id: parseInt(driverId),
          type: 'CNH',
          type_name: 'CNH',
          document_type_id: cnhTypeId,
          expiration_date: driver.license_expiry,
          entity_name: driver.name,
          days_until_expiration: diffDays,
          is_cnh: 1
        } as any);
      }

      const allDocs = formattedDocs.map((doc: any) => {
        if (doc.days_until_expiration !== undefined) return doc;
        const expDate = new Date(doc.expiration_date);
        expDate.setHours(0, 0, 0, 0);
        const diffTime = expDate.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return { ...doc, days_until_expiration: diffDays };
      }).sort((a: any, b: any) => a.days_until_expiration - b.days_until_expiration);

      res.json(allDocs);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/fleet-documents/drivers", checkPermission('fleet_documents', 'create'), async (req, res) => {
    const { driver_id, document_type_id, type, expiration_date, notes } = req.body;
    try {
      const { data, error } = await supabase
        .from('driver_documents')
        .insert([{ driver_id, document_type_id, type, expiration_date, notes }])
        .select()
        .single();
      
      if (error) throw error;
      res.json({ id: data.id });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.put("/api/fleet-documents/drivers/:id", checkPermission('fleet_documents', 'edit'), async (req, res) => {
    const { id } = req.params;
    const { driver_id, document_type_id, type, expiration_date, notes } = req.body;
    try {
      const { error } = await supabase
        .from('driver_documents')
        .update({ driver_id, document_type_id, type, expiration_date, notes })
        .eq('id', id);
      
      if (error) throw error;
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.delete("/api/fleet-documents/drivers/:id", checkPermission('fleet_documents', 'delete'), async (req, res) => {
    const { id } = req.params;
    try {
      const { error } = await supabase
        .from('driver_documents')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.put("/api/drivers/:id/cnh", checkPermission('fleet_documents', 'edit'), async (req, res) => {
    const { id } = req.params;
    const { expiration_date } = req.body;
    try {
      const { error } = await supabase
        .from('drivers')
        .update({ license_expiry: expiration_date })
        .eq('id', id);
      
      if (error) throw error;
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.delete("/api/drivers/:id/cnh", checkPermission('fleet_documents', 'delete'), async (req, res) => {
    const { id } = req.params;
    try {
      const { error } = await supabase
        .from('drivers')
        .update({ license_expiry: null })
        .eq('id', id);
      
      if (error) throw error;
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/fleet-documents/bulk-update", checkPermission('fleet_documents', 'edit'), async (req, res) => {
    const { updates, expiration_date } = req.body;
    if (!updates || !Array.isArray(updates) || !expiration_date) {
      return res.status(400).json({ error: "Dados para atualização em massa incompletos." });
    }

    try {
      for (const item of updates) {
        const { id, entity_type } = item;
        if (entity_type === 'vehicle') {
          await supabase.from('vehicle_documents').update({ expiration_date }).eq('id', id);
        } else if (entity_type === 'driver') {
          if (typeof id === 'string' && id.startsWith('cnh-')) {
            const driverId = id.replace('cnh-', '');
            await supabase.from('drivers').update({ license_expiry: expiration_date }).eq('id', driverId);
          } else {
            await supabase.from('driver_documents').update({ expiration_date }).eq('id', id);
          }
        }
      }
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/fleet-documents/expiring", checkPermission('fleet_documents', 'access'), async (req, res) => {
    const today = new Date();
    const thirtyDaysLater = new Date();
    thirtyDaysLater.setDate(today.getDate() + 30);
    
    const todayStr = today.toISOString().split('T')[0];
    const thirtyDaysLaterStr = thirtyDaysLater.toISOString().split('T')[0];
    
    try {
      const { data: vDocs, error: vError } = await supabase
        .from('vehicle_documents')
        .select(`
          *,
          vehicles ( plate, branch, fleet_category_id, status ),
          document_types ( name )
        `)
        .lte('expiration_date', thirtyDaysLaterStr);
      
      if (vError) throw vError;

      const { data: dDocs, error: dError } = await supabase
        .from('driver_documents')
        .select(`
          *,
          drivers ( name, branch, fleet_category_id, status ),
          document_types ( name )
        `)
        .lte('expiration_date', thirtyDaysLaterStr);
      
      if (dError) throw dError;

      const { data: cnhType } = await supabase.from('document_types').select('id').eq('name', 'CNH').single();
      const cnhTypeId = cnhType?.id;

      const { data: drivers, error: drError } = await supabase
        .from('drivers')
        .select('id, name, branch, fleet_category_id, license_expiry, status')
        .eq('status', 'Ativo')
        .not('license_expiry', 'is', null)
        .lte('license_expiry', thirtyDaysLaterStr);
      
      if (drError) throw drError;

      const vehicleDocs = vDocs
        .filter((vd: any) => vd.vehicles?.status === 'Ativo')
        .map(vd => ({
          ...vd,
          entity_plate: vd.vehicles?.plate,
          branch: vd.vehicles?.branch,
          fleet_category_id: vd.vehicles?.fleet_category_id,
          entity_type: 'vehicle',
          type_name: vd.document_types?.name
        }));

      const driverDocs = dDocs
        .filter((dd: any) => dd.drivers?.status === 'Ativo')
        .map(dd => ({
          ...dd,
          entity_name: dd.drivers?.name,
          branch: dd.drivers?.branch,
          fleet_category_id: dd.drivers?.fleet_category_id,
          entity_type: 'driver',
          type_name: dd.document_types?.name
        }));

      const cnhDocs = drivers.map(d => ({
        id: `cnh-${d.id}`,
        driver_id: d.id,
        entity_name: d.name,
        branch: d.branch,
        fleet_category_id: d.fleet_category_id,
        entity_type: 'driver',
        type: 'CNH',
        type_name: 'CNH',
        document_type_id: cnhTypeId,
        expiration_date: d.license_expiry,
        is_cnh: 1
      }));

      const now = new Date();
      now.setHours(0, 0, 0, 0);

      const allDocs = [...vehicleDocs, ...driverDocs, ...cnhDocs].map((doc: any) => {
        const expDate = new Date(doc.expiration_date);
        expDate.setHours(0, 0, 0, 0);
        const diffTime = expDate.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        let status: 'VERDE' | 'AMARELO' | 'VERMELHO' = 'VERDE';
        if (diffDays <= 0) status = 'VERMELHO';
        else if (diffDays <= 15) status = 'AMARELO';

        return {
          ...doc,
          status,
          days_until_expiration: diffDays
        };
      }).sort((a, b) => a.days_until_expiration - b.days_until_expiration);

      res.json(allDocs);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Audit Logs Endpoint
  app.get("/api/audit-logs/:table/:id", checkAnyPermission([
    { module: 'maintenance_board', action: 'access' },
    { module: 'registrations', action: 'access' },
    { module: 'fueling', action: 'access' }
  ]), async (req: any, res) => {
    const { table, id } = req.params;
    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('table_name', table)
        .eq('record_id', id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      res.json(data);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // Maintenance Order Comments Endpoints
  app.get("/api/maintenance/orders/:id/comments", checkPermission('maintenance_board', 'access'), async (req: any, res) => {
    const { id } = req.params;
    try {
      const { data, error } = await supabase
        .from('maintenance_order_comments')
        .select('*')
        .eq('order_id', parseInt(id))
        .order('created_at', { ascending: true });
      
      if (error) {
        console.error(`[COMMENTS] Error fetching comments for order ${id}:`, error);
        throw error;
      }
      res.json(data);
    } catch (e: any) {
      console.error(`[COMMENTS] Catch error fetching comments for order ${id}:`, e);
      res.status(400).json({ 
        error: e.message || "Erro desconhecido", 
        details: e.details, 
        hint: e.hint, 
        code: e.code 
      });
    }
  });

  app.post("/api/maintenance/orders/:id/comments", checkPermission('maintenance_board', 'edit'), async (req: any, res) => {
    const { id } = req.params;
    const { comment } = req.body;
    try {
      const { data, error } = await supabase
        .from('maintenance_order_comments')
        .insert({
          order_id: parseInt(id),
          user_id: req.user.id,
          user_name: req.user.name || req.user.email,
          comment: comment
        })
        .select()
        .single();
      
      if (error) {
        console.error(`[COMMENTS] Error inserting comment for order ${id}:`, error);
        throw error;
      }

      // Update maintenance order updated_at
      await supabase.from('maintenance_orders').update({ 
        updated_at: new Date().toISOString()
      }).eq('id', parseInt(id));

      res.json(data);
    } catch (e: any) {
      console.error(`[COMMENTS] Catch error inserting comment for order ${id}:`, e);
      res.status(400).json({ 
        error: e.message || "Erro desconhecido", 
        details: e.details, 
        hint: e.hint, 
        code: e.code 
      });
    }
  });

  app.put("/api/maintenance/comments/:id", checkPermission('maintenance_board', 'edit'), async (req: any, res) => {
    const { id } = req.params;
    const { comment } = req.body;
    try {
      const { data: existing, error: fetchError } = await supabase
        .from('maintenance_order_comments')
        .select('*')
        .eq('id', id)
        .single();
      
      if (fetchError || !existing) return res.status(404).json({ error: "Comentário não encontrado" });

      // Check if user is the author
      if (existing.user_id !== req.user.id && !req.user.is_admin) {
        return res.status(403).json({ error: "Você só pode editar seus próprios comentários" });
      }

      // Check 15-min window
      const createdAt = new Date(existing.created_at);
      const now = new Date();
      const diffMin = (now.getTime() - createdAt.getTime()) / (1000 * 60);
      
      if (diffMin > 15 && !req.user.is_admin) {
        return res.status(400).json({ error: "O tempo limite para edição (15 min) expirou" });
      }

      const { data, error } = await supabase
        .from('maintenance_order_comments')
        .update({
          comment: comment,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;

      // Update maintenance order updated_at
      await supabase.from('maintenance_orders').update({ 
        updated_at: new Date().toISOString()
      }).eq('id', existing.order_id);

      res.json(data);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.delete("/api/maintenance/comments/:id", checkPermission('maintenance_board', 'edit'), async (req: any, res) => {
    const { id } = req.params;
    try {
      const { data: existing, error: fetchError } = await supabase
        .from('maintenance_order_comments')
        .select('*')
        .eq('id', id)
        .single();
      
      if (fetchError || !existing) return res.status(404).json({ error: "Comentário não encontrado" });

      // Only admin can delete comments (as requested)
      if (!req.user.is_admin) {
        return res.status(403).json({ error: "Apenas administradores podem excluir mensagens" });
      }

      const { error: deleteError } = await supabase
        .from('maintenance_order_comments')
        .delete()
        .eq('id', id);
      
      if (deleteError) throw deleteError;

      // Update maintenance order updated_at
      await supabase.from('maintenance_orders').update({ 
        updated_at: new Date().toISOString()
      }).eq('id', existing.order_id);

      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // API 404 Handler - prevents returning index.html for missing API routes
  app.all("/api/*", (req, res) => {
    console.log(`[API 404] ${req.method} ${req.url}`);
    res.status(404).json({ 
      error: "Endpoint não encontrado", 
      message: `O endpoint ${req.originalUrl} não existe neste servidor.`,
      path: req.originalUrl
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  // Final Error Handler
  app.use((err: any, req: any, res: any, next: any) => {
    console.error("Server Error:", err);
    res.status(err.status || 500).json({ 
      error: "Erro interno do servidor", 
      message: err.message,
      path: req.path
    });
  });

  const PORT = 3000;
  app.listen(PORT, "0.0.0.0", async () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
    
    // One-time cleanup of vehicle plates to remove hyphens
    try {
      console.log("[CLEANUP] Starting vehicle plate cleanup...");
      const { data: vehicles } = await supabase.from('vehicles').select('id, plate');
      if (vehicles) {
        let count = 0;
        for (const v of vehicles) {
          const cleaned = v.plate.toUpperCase().replace(/[^A-Z0-9]/g, '');
          if (cleaned !== v.plate) {
            const { error } = await supabase.from('vehicles').update({ plate: cleaned }).eq('id', v.id);
            if (!error) count++;
          }
        }
        if (count > 0) console.log(`[CLEANUP] Cleaned ${count} vehicle plates.`);
      }
    } catch (e) {
      console.error("[CLEANUP] Error cleaning plates:", e);
    }
  });
}

startServer();
