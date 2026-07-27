export class D1Repository {
  constructor(db) { this.db = db; }

  async authenticate(request) {
    const email = request.headers.get("oai-authenticated-user-email");
    if (!email) return null;
    const row = await this.db.prepare(`
      SELECT u.id AS userId, u.display_name AS name, u.system_role AS role,
             e.id AS employeeId, e.assigned_station_id AS stationId, e.job_position AS jobPosition
      FROM users u LEFT JOIN employees e ON e.user_id = u.id
      WHERE u.email = ? AND u.active = 1
    `).bind(email).first();
    return row ?? null;
  }

  async getStation(id) {
    const row = await this.db.prepare("SELECT id, name, latitude, longitude, allowed_radius_meters AS allowedRadiusMeters FROM stations WHERE id = ? AND active = 1").bind(id).first();
    return row ?? null;
  }
  async getAttendanceForEmployee(employeeId) {
    if (!employeeId) return [];
    return this.db.prepare("SELECT * FROM attendance_records WHERE employee_id = ? ORDER BY server_timestamp DESC LIMIT 60").bind(employeeId).all().then(result => result.results);
  }
  async getAllAttendance() {
    return this.db.prepare("SELECT * FROM attendance_records ORDER BY server_timestamp DESC LIMIT 300").all().then(result => result.results);
  }
  async createAttendance(record) {
    await this.db.prepare(`
      INSERT INTO attendance_records
      (id, employee_id, station_id, action, server_timestamp, latitude, longitude, gps_accuracy, distance_meters, device_info, exceptional)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(record.id, record.employeeId, record.stationId, record.action, record.serverTimestamp, record.latitude, record.longitude, record.gpsAccuracy, record.distanceMeters, record.deviceInfo, record.exceptional ? 1 : 0).run();
    return record;
  }
  async createManualAttendance(body, adminUserId, timestamp) {
    const id = crypto.randomUUID();
    const record = { id, ...body, serverTimestamp: body.serverTimestamp ?? timestamp };
    await this.db.batch([
      this.db.prepare("INSERT INTO attendance_records (id, employee_id, station_id, action, server_timestamp, latitude, longitude, gps_accuracy, distance_meters, device_info, exceptional) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(id, body.employeeId, body.stationId, body.action, record.serverTimestamp, body.latitude ?? 0, body.longitude ?? 0, body.gpsAccuracy ?? null, body.distanceMeters ?? 0, "הזנה ידנית בידי מנהל", 1),
      this.db.prepare("INSERT INTO audit_logs (id, entity_type, entity_id, field_name, original_value, new_value, admin_user_id, reason, server_timestamp) VALUES (?, 'ATTENDANCE', ?, 'record', NULL, ?, ?, ?, ?)")
        .bind(crypto.randomUUID(), id, JSON.stringify(record), adminUserId, body.reason, timestamp),
    ]);
    return record;
  }
  async correctAttendance(id, changes, adminUserId, reason, timestamp) {
    const original = await this.db.prepare("SELECT * FROM attendance_records WHERE id = ?").bind(id).first();
    if (!original) return null;
    const allowed = { serverTimestamp: "server_timestamp", stationId: "station_id", action: "action", approvedByAdminId: "approved_by_admin_id", exceptional: "exceptional" };
    const audits = [];
    for (const [key, column] of Object.entries(allowed)) {
      if (!(key in changes)) continue;
      const oldValue = original[column];
      await this.db.prepare(`UPDATE attendance_records SET ${column} = ? WHERE id = ?`).bind(changes[key], id).run();
      audits.push(this.db.prepare("INSERT INTO audit_logs (id, entity_type, entity_id, field_name, original_value, new_value, admin_user_id, reason, server_timestamp) VALUES (?, 'ATTENDANCE', ?, ?, ?, ?, ?, ?, ?)")
        .bind(crypto.randomUUID(), id, key, String(oldValue ?? ""), String(changes[key]), adminUserId, reason, timestamp));
    }
    if (audits.length) await this.db.batch(audits);
    return this.db.prepare("SELECT * FROM attendance_records WHERE id = ?").bind(id).first();
  }
  async getInventory(stationId) {
    return this.db.prepare("SELECT i.station_id AS stationId, i.product_id AS productId, p.name, i.quantity, p.current_price_cents AS unitPriceCents FROM station_inventory i JOIN products p ON p.id = i.product_id WHERE i.station_id = ?").bind(stationId).all().then(result => result.results);
  }
  async createSaleAtomic(input) {
    const inventory = await this.db.prepare("SELECT i.quantity, p.current_price_cents AS unitPriceCents FROM station_inventory i JOIN products p ON p.id = i.product_id WHERE i.station_id = ? AND i.product_id = ?").bind(input.stationId, input.productId).first();
    if (!inventory || inventory.quantity < input.quantity) throw new Error("אין מספיק מלאי לביצוע המכירה");
    const next = inventory.quantity - input.quantity;
    const transactionId = crypto.randomUUID();
    await this.db.batch([
      this.db.prepare("UPDATE station_inventory SET quantity = ?, updated_at = ? WHERE station_id = ? AND product_id = ? AND quantity = ?").bind(next, input.serverTimestamp, input.stationId, input.productId, inventory.quantity),
      this.db.prepare("INSERT INTO sales (id, employee_id, station_id, product_id, quantity, unit_price_cents, total_amount_cents, server_timestamp, previous_inventory_quantity, new_inventory_quantity) VALUES (?, (SELECT CASE WHEN quantity = ? THEN ? ELSE NULL END FROM station_inventory WHERE station_id = ? AND product_id = ?), ?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(input.id, next, input.employeeId, input.stationId, input.productId, input.stationId, input.productId, input.quantity, inventory.unitPriceCents, inventory.unitPriceCents * input.quantity, input.serverTimestamp, inventory.quantity, next),
      this.db.prepare("INSERT INTO inventory_transactions (id, station_id, product_id, transaction_type, quantity_delta, previous_quantity, new_quantity, employee_id, sale_id, server_timestamp) VALUES (?, ?, ?, 'SALE', ?, ?, ?, ?, ?, ?)")
        .bind(transactionId, input.stationId, input.productId, -input.quantity, inventory.quantity, next, input.employeeId, input.id, input.serverTimestamp),
    ]);
    return { ...input, unitPriceCents: inventory.unitPriceCents, totalAmountCents: inventory.unitPriceCents * input.quantity, previousQuantity: inventory.quantity, newQuantity: next };
  }
  async adjustInventory(body, adminUserId, timestamp) {
    const inventory = await this.db.prepare("SELECT quantity FROM station_inventory WHERE station_id = ? AND product_id = ?").bind(body.stationId, body.productId).first();
    if (!inventory) throw new Error("המלאי לא נמצא");
    const next = Math.max(0, inventory.quantity + body.quantityDelta);
    const id = crypto.randomUUID();
    await this.db.batch([
      this.db.prepare("UPDATE station_inventory SET quantity = ?, updated_at = ? WHERE station_id = ? AND product_id = ?").bind(next, timestamp, body.stationId, body.productId),
      this.db.prepare("INSERT INTO inventory_transactions (id, station_id, product_id, transaction_type, quantity_delta, previous_quantity, new_quantity, admin_user_id, reason, server_timestamp) VALUES (?, ?, ?, 'MANUAL_ADJUSTMENT', ?, ?, ?, ?, ?, ?)")
        .bind(id, body.stationId, body.productId, body.quantityDelta, inventory.quantity, next, adminUserId, body.reason, timestamp),
      this.db.prepare("INSERT INTO audit_logs (id, entity_type, entity_id, field_name, original_value, new_value, admin_user_id, reason, server_timestamp) VALUES (?, 'INVENTORY', ?, 'quantity', ?, ?, ?, ?, ?)")
        .bind(crypto.randomUUID(), `${body.stationId}:${body.productId}`, String(inventory.quantity), String(next), adminUserId, body.reason, timestamp),
    ]);
    return { id, previousQuantity: inventory.quantity, newQuantity: next, ...body };
  }
}
