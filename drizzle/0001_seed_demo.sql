INSERT OR IGNORE INTO users (id, email, display_name, system_role) VALUES
  ('user-admin', 'owner@linoy-designs.example', 'לינוי רז', 'ADMIN'),
  ('user-employee-1', 'maya@linoy-designs.example', 'מיה אדרי', 'EMPLOYEE');

INSERT OR IGNORE INTO stations (id, name, address, latitude, longitude, allowed_radius_meters) VALUES
  (1, 'עמדת עזריאלי', 'דרך מנחם בגין 132, תל אביב', 32.0743, 34.7925, 150),
  (2, 'עמדת שרונה', 'אלוף קלמן מגן 3, תל אביב', 32.0717, 34.7876, 150),
  (3, 'עמדת דיזנגוף', 'דיזנגוף 50, תל אביב', 32.0754, 34.7741, 150),
  (4, 'עמדת רמת אביב', 'איינשטיין 40, תל אביב', 32.1120, 34.7956, 150);

INSERT OR IGNORE INTO employees (id, user_id, job_position, hourly_rate_cents, assigned_station_id) VALUES
  ('emp-1', 'user-employee-1', 'מוכרת', 4200, 1);

INSERT OR IGNORE INTO products (id, name, current_price_cents) VALUES
  ('product-white-roses', 'זר ורדים לבנים', 18900),
  ('product-pink', 'זר ורוד', 14900),
  ('product-small', 'זר קטן', 8900);

INSERT OR IGNORE INTO station_inventory (station_id, product_id, quantity) VALUES
  (1, 'product-white-roses', 20),
  (1, 'product-pink', 15),
  (1, 'product-small', 10);
