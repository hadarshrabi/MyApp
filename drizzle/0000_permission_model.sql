CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  system_role TEXT NOT NULL CHECK (system_role IN ('ADMIN', 'EMPLOYEE')),
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS employees (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id),
  job_position TEXT NOT NULL,
  hourly_rate_cents INTEGER NOT NULL DEFAULT 0,
  assigned_station_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS stations (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  allowed_radius_meters INTEGER NOT NULL DEFAULT 150,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  current_price_cents INTEGER NOT NULL,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS station_inventory (
  station_id INTEGER NOT NULL REFERENCES stations(id),
  product_id TEXT NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL CHECK (quantity >= 0),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (station_id, product_id)
);

CREATE TABLE IF NOT EXISTS attendance_records (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL REFERENCES employees(id),
  station_id INTEGER NOT NULL REFERENCES stations(id),
  action TEXT NOT NULL CHECK (action IN ('CLOCK_IN', 'CLOCK_OUT')),
  server_timestamp TEXT NOT NULL,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  gps_accuracy REAL,
  distance_meters REAL NOT NULL,
  device_info TEXT,
  exceptional INTEGER NOT NULL DEFAULT 0,
  approved_by_admin_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sales (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL REFERENCES employees(id),
  station_id INTEGER NOT NULL REFERENCES stations(id),
  product_id TEXT NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price_cents INTEGER NOT NULL,
  total_amount_cents INTEGER NOT NULL,
  server_timestamp TEXT NOT NULL,
  previous_inventory_quantity INTEGER NOT NULL,
  new_inventory_quantity INTEGER NOT NULL,
  payment_type TEXT
);

CREATE TABLE IF NOT EXISTS inventory_transactions (
  id TEXT PRIMARY KEY,
  station_id INTEGER NOT NULL REFERENCES stations(id),
  product_id TEXT NOT NULL REFERENCES products(id),
  transaction_type TEXT NOT NULL,
  quantity_delta INTEGER NOT NULL,
  previous_quantity INTEGER NOT NULL,
  new_quantity INTEGER NOT NULL,
  employee_id TEXT,
  admin_user_id TEXT,
  sale_id TEXT,
  reason TEXT,
  server_timestamp TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  field_name TEXT NOT NULL,
  original_value TEXT,
  new_value TEXT,
  admin_user_id TEXT NOT NULL REFERENCES users(id),
  reason TEXT NOT NULL,
  server_timestamp TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS attendance_employee_time_idx ON attendance_records(employee_id, server_timestamp);
CREATE INDEX IF NOT EXISTS attendance_station_time_idx ON attendance_records(station_id, server_timestamp);
CREATE INDEX IF NOT EXISTS audit_entity_idx ON audit_logs(entity_type, entity_id, server_timestamp);
