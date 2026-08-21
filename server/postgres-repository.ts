import prismaClient, { type AttendanceAction, type InventoryTransactionType, type Prisma as PrismaTypes, type UserRole } from "@prisma/client";
import { prisma as defaultPrisma } from "./prisma";
import { pairAttendanceShifts, summarizeAttendanceShifts } from "./attendance-shifts";

const { Prisma } = prismaClient;
type PrismaLike = typeof defaultPrisma;

export class PostgresRepository {
  constructor(private readonly prisma: PrismaLike = defaultPrisma) {}

  async healthCheck() {
    await this.prisma.$queryRawUnsafe("SELECT 1");
  }

  async findUserByEmail(email: string) {
    return this.prisma.user.findFirst({
      where: { email: email.toLowerCase(), active: true },
      include: { employee: true },
    });
  }

  async findUserById(id: string) {
    return this.prisma.user.findFirst({ where: { id, active: true }, include: { employee: true } });
  }

  async getStation(id: number) {
    return this.prisma.station.findFirst({ where: { id, active: true, archivedAt: null } });
  }

  async getStationsForUser(role: UserRole, stationId: number | null) {
    return this.prisma.station.findMany({
      where: role === "ADMIN" ? {} : { id: stationId ?? -1, active: true, archivedAt: null },
      include: { inventory: { where: role === "ADMIN" ? {} : { active: true, product: { active: true } }, include: { product: true } }, _count: { select: { employees: true } } },
      orderBy: { id: "asc" },
    });
  }

  async createStation(input: {
    name: string; address: string; locationDescription?: string | null; latitude: number; longitude: number;
    allowedRadiusMeters: number; active: boolean; startDate?: Date | null; endDate?: Date | null; internalNotes?: string | null;
    products: Array<{ productId: string; initialQuantity: number }>;
  }, adminUserId: string) {
    return this.prisma.$transaction(async tx => {
      const { products, ...stationInput } = input;
      if (products.length) {
        const activeProducts = await tx.product.count({ where: { id: { in: products.map(item => item.productId) }, active: true } });
        if (activeProducts !== products.length) throw new ConflictError("אחד המוצרים אינו פעיל או אינו קיים");
      }
      const station = await tx.station.create({ data: stationInput });
      for (const product of products) {
        await tx.stationInventory.create({ data: { stationId: station.id, productId: product.productId, quantity: product.initialQuantity } });
        await tx.inventoryTransaction.create({ data: {
          stationId: station.id, productId: product.productId, transactionType: "INITIAL_COUNT",
          quantityDelta: product.initialQuantity, previousQuantity: 0, newQuantity: product.initialQuantity,
          adminUserId, reason: "מלאי התחלתי בעת יצירת עמדה",
        } });
      }
      await tx.auditLog.create({ data: {
        entityType: "STATION", entityId: String(station.id), fieldName: "created",
        originalValue: Prisma.JsonNull, newValue: { ...station, products } as unknown as PrismaTypes.InputJsonValue,
        adminUserId, reason: "יצירת עמדה חדשה",
      } });
      return tx.station.findUniqueOrThrow({ where: { id: station.id }, include: { inventory: { include: { product: true } } } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async addStationProduct(stationId: number, input: { productId: string; initialQuantity: number; reason: string }, adminUserId: string) {
    return this.prisma.$transaction(async tx => {
      const [station, product, existing] = await Promise.all([
        tx.station.findUnique({ where: { id: stationId } }),
        tx.product.findUnique({ where: { id: input.productId } }),
        tx.stationInventory.findUnique({ where: { stationId_productId: { stationId, productId: input.productId } } }),
      ]);
      if (!station) throw new ConflictError("העמדה לא נמצאה");
      if (!product?.active) throw new ConflictError("לא ניתן להוסיף מוצר לא פעיל");
      if (existing?.active) throw new ConflictError("המוצר כבר משויך לעמדה");
      const previousQuantity = existing?.quantity ?? 0;
      const inventory = existing
        ? await tx.stationInventory.update({ where: { stationId_productId: { stationId, productId: input.productId } }, data: { active: true, quantity: input.initialQuantity, version: { increment: 1 } }, include: { product: true } })
        : await tx.stationInventory.create({ data: { stationId, productId: input.productId, quantity: input.initialQuantity }, include: { product: true } });
      await tx.inventoryTransaction.create({ data: {
        stationId, productId: input.productId, transactionType: "INITIAL_COUNT", quantityDelta: input.initialQuantity - previousQuantity,
        previousQuantity, newQuantity: input.initialQuantity, adminUserId, reason: input.reason,
      } });
      await tx.auditLog.create({ data: {
        entityType: "INVENTORY", entityId: `${stationId}:${input.productId}`, fieldName: "productAssignment",
        originalValue: existing ? { active: false, quantity: previousQuantity } : Prisma.JsonNull,
        newValue: { active: true, quantity: input.initialQuantity }, adminUserId, reason: input.reason,
      } });
      return inventory;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async removeStationProduct(stationId: number, productId: string, reason: string, adminUserId: string) {
    return this.prisma.$transaction(async tx => {
      const inventory = await tx.stationInventory.findUnique({ where: { stationId_productId: { stationId, productId } } });
      if (!inventory) throw new ConflictError("המוצר אינו משויך לעמדה");
      if (!inventory.active) throw new ConflictError("המוצר כבר מושבת בעמדה");
      await tx.stationInventory.update({ where: { stationId_productId: { stationId, productId } }, data: { active: false, version: { increment: 1 } } });
      await tx.auditLog.create({ data: {
        entityType: "INVENTORY", entityId: `${stationId}:${productId}`, fieldName: "productAssignment",
        originalValue: { active: true, quantity: inventory.quantity }, newValue: { active: false, quantity: inventory.quantity }, adminUserId, reason,
      } });
      return true;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async updateStationProductDetails(stationId: number, productId: string, input: { name: string; price: number; quantity: number; reason: string }, adminUserId: string) {
    return this.prisma.$transaction(async tx => {
      const inventory = await tx.stationInventory.findUnique({
        where: { stationId_productId: { stationId, productId } },
        include: { product: true },
      });
      if (!inventory) throw new ConflictError("המוצר אינו משויך לעמדה");
      const product = await tx.product.update({
        where: { id: productId },
        data: { name: input.name, currentPriceCents: Math.round(input.price * 100) },
      });
      const updatedInventory = await tx.stationInventory.update({
        where: { stationId_productId: { stationId, productId } },
        data: { quantity: input.quantity, version: { increment: 1 } },
      });
      if (inventory.quantity !== input.quantity) {
        await tx.inventoryTransaction.create({ data: {
          stationId, productId, transactionType: "MANUAL_ADJUSTMENT",
          quantityDelta: input.quantity - inventory.quantity, previousQuantity: inventory.quantity,
          newQuantity: input.quantity, adminUserId, reason: input.reason,
        } });
      }
      await tx.auditLog.createMany({ data: [
        {
          entityType: "PRODUCT", entityId: productId, fieldName: "stationProductDetails",
          originalValue: { name: inventory.product.name, price: inventory.product.currentPriceCents / 100 },
          newValue: { name: product.name, price: product.currentPriceCents / 100 },
          adminUserId, reason: input.reason,
        },
        {
          entityType: "INVENTORY", entityId: `${stationId}:${productId}`, fieldName: "quantity",
          originalValue: inventory.quantity, newValue: input.quantity, adminUserId, reason: input.reason,
        },
      ] });
      return { product, inventory: updatedInventory };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async updateStation(id: number, changes: Record<string, unknown>, adminUserId: string, reason: string) {
    return this.prisma.$transaction(async tx => {
      const original = await tx.station.findUnique({ where: { id } });
      if (!original) return null;
      if (original.archivedAt) throw new ConflictError("יש לשחזר את העמדה מהארכיון לפני עריכתה");
      const station = await tx.station.update({ where: { id }, data: changes });
      await tx.auditLog.create({ data: {
        entityType: "STATION", entityId: String(id), fieldName: "station",
        originalValue: original as unknown as PrismaTypes.InputJsonValue, newValue: station as unknown as PrismaTypes.InputJsonValue,
        adminUserId, reason,
      } });
      return station;
    });
  }

  async archiveStation(id: number, adminUserId: string, reason: string) {
    return this.prisma.$transaction(async tx => {
      const original = await tx.station.findUnique({ where: { id } });
      if (!original) return null;
      if (original.archivedAt) throw new ConflictError("העמדה כבר נמצאת בארכיון");
      const archivedAt = new Date();
      const station = await tx.station.update({
        where: { id },
        data: { active: false, archivedAt, archivedByAdminId: adminUserId, archiveReason: reason },
      });
      const detachedEmployees = await tx.employee.updateMany({
        where: { assignedStationId: id }, data: { assignedStationId: null },
      });
      await tx.auditLog.create({ data: {
        entityType: "STATION", entityId: String(id), fieldName: "archivedAt",
        originalValue: { archivedAt: null, active: original.active },
        newValue: { archivedAt: archivedAt.toISOString(), active: false, detachedEmployees: detachedEmployees.count },
        adminUserId, reason,
      } });
      return station;
    });
  }

  async restoreStation(id: number, adminUserId: string, reason: string, active = false) {
    return this.prisma.$transaction(async tx => {
      const original = await tx.station.findUnique({ where: { id } });
      if (!original) return null;
      if (!original.archivedAt) throw new ConflictError("העמדה אינה נמצאת בארכיון");
      const station = await tx.station.update({
        where: { id },
        data: { active, archivedAt: null, archivedByAdminId: null, archiveReason: null },
      });
      await tx.auditLog.create({ data: {
        entityType: "STATION", entityId: String(id), fieldName: "archivedAt",
        originalValue: { archivedAt: original.archivedAt.toISOString(), active: original.active },
        newValue: { archivedAt: null, active }, adminUserId, reason,
      } });
      return station;
    });
  }

  async permanentlyDeleteStation(id: number, confirmationName: string, adminUserId: string, reason: string) {
    return this.prisma.$transaction(async tx => {
      const station = await tx.station.findUnique({
        where: { id },
        include: { _count: { select: { attendanceRecords: true, sales: true, inventoryTransactions: true, employees: true } } },
      });
      if (!station) return null;
      if (!station.archivedAt) throw new ConflictError("ניתן למחוק לצמיתות רק עמדה שנמצאת בארכיון");
      if (station.name !== confirmationName) throw new ConflictError("שם העמדה שהוזן אינו תואם");
      const deletedCounts = {
        attendanceRecords: station._count.attendanceRecords,
        sales: station._count.sales,
        inventoryTransactions: station._count.inventoryTransactions,
        assignedEmployees: station._count.employees,
      };
      await tx.employee.updateMany({ where: { assignedStationId: id }, data: { assignedStationId: null } });
      await tx.inventoryTransaction.deleteMany({ where: { stationId: id } });
      await tx.sale.deleteMany({ where: { stationId: id } });
      await tx.attendanceRecord.deleteMany({ where: { stationId: id } });
      await tx.stationInventory.deleteMany({ where: { stationId: id } });
      await tx.auditLog.create({ data: {
        entityType: "STATION", entityId: String(id), fieldName: "permanentlyDeleted",
        originalValue: station as unknown as PrismaTypes.InputJsonValue,
        newValue: { deleted: true, deletedCounts } as PrismaTypes.InputJsonValue,
        adminUserId, reason,
      } });
      await tx.station.delete({ where: { id } });
      return { id, name: station.name, deletedCounts };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async duplicateStation(id: number, input: { name: string; latitude?: number; longitude?: number; copyInventory: boolean }, adminUserId: string) {
    return this.prisma.$transaction(async tx => {
      const source = await tx.station.findUnique({ where: { id }, include: { inventory: true } });
      if (!source) return null;
      const station = await tx.station.create({ data: {
        name: input.name, address: source.address, locationDescription: source.locationDescription,
        latitude: input.latitude ?? source.latitude, longitude: input.longitude ?? source.longitude,
        allowedRadiusMeters: source.allowedRadiusMeters, active: true, internalNotes: source.internalNotes,
      } });
      if (input.copyInventory && source.inventory.length) {
        await tx.stationInventory.createMany({ data: source.inventory.map(item => ({
          stationId: station.id, productId: item.productId, quantity: item.quantity,
        })) });
      }
      await tx.auditLog.create({ data: {
        entityType: "STATION", entityId: String(station.id), fieldName: "duplicatedFrom",
        originalValue: id, newValue: station.id, adminUserId, reason: `שכפול הגדרת עמדה ${source.name}`,
      } });
      return station;
    });
  }

  async getAdminBootstrap() {
    const [users, stations, products, attendance, audits, sales, attendanceShiftSummary] = await Promise.all([
      this.prisma.user.findMany({
        select: {
          id: true, email: true, displayName: true, systemRole: true, active: true,
          employee: { select: { id: true, jobPosition: true, hourlyRateCents: true, assignedStationId: true, assignedStation: { select: { name: true } } } },
        },
        orderBy: { displayName: "asc" },
      }),
      this.getStationsForUser("ADMIN", null),
      this.prisma.product.findMany({ include: { stationInventory: { select: { stationId: true, quantity: true, active: true, station: { select: { name: true } } } } }, orderBy: { name: "asc" } }),
      this.getAllAttendance(),
      this.prisma.auditLog.findMany({
        include: { adminUser: { select: { displayName: true } } },
        orderBy: { serverTimestamp: "desc" },
        take: 200,
      }),
      this.prisma.sale.findMany({ orderBy: { serverTimestamp: "desc" }, take: 200 }),
      this.getAttendanceShiftSummary(),
    ]);
    return { users, stations, products, attendance, audits, sales, attendanceShiftSummary };
  }

  async createManagedUser(input: {
    displayName: string;
    email: string;
    passwordHash: string;
    systemRole: UserRole;
    jobPosition?: string;
    hourlyRate?: number;
    assignedStationId?: number | null;
  }, adminUserId: string) {
    return this.prisma.$transaction(async tx => {
      const existing = await tx.user.findUnique({ where: { email: input.email } });
      if (existing) throw new ConflictError("כתובת הדוא״ל כבר משויכת למשתמש במערכת");

      if (input.systemRole === "EMPLOYEE" && input.assignedStationId) {
        const station = await tx.station.findFirst({ where: { id: input.assignedStationId, active: true, archivedAt: null } });
        if (!station) throw new ConflictError("ניתן לשייך עובד רק לעמדה פעילה שאינה בארכיון");
      }

      const user = await tx.user.create({
        data: {
          email: input.email,
          displayName: input.displayName,
          passwordHash: input.passwordHash,
          systemRole: input.systemRole,
          employee: input.systemRole === "EMPLOYEE" ? {
            create: {
              jobPosition: input.jobPosition ?? "עובד",
              hourlyRateCents: Math.round((input.hourlyRate ?? 0) * 100),
              assignedStationId: input.assignedStationId ?? null,
            },
          } : undefined,
        },
        select: {
          id: true, email: true, displayName: true, systemRole: true, active: true,
          employee: { select: { id: true, jobPosition: true, hourlyRateCents: true, assignedStationId: true, assignedStation: { select: { name: true } } } },
        },
      });
      await tx.auditLog.create({ data: {
        entityType: "USER", entityId: user.id, fieldName: "created", originalValue: Prisma.JsonNull,
        newValue: { id: user.id, email: user.email, displayName: user.displayName, systemRole: user.systemRole, active: user.active },
        adminUserId, reason: "יצירת משתמש חדש",
      } });
      return user;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async updateManagedUser(userId: string, input: {
    displayName?: string;
    email?: string;
    systemRole?: UserRole;
    jobPosition?: string;
    hourlyRate?: number;
    assignedStationId?: number | null;
    reason: string;
  }, adminUserId: string) {
    return this.prisma.$transaction(async tx => {
      const original = await tx.user.findUnique({
        where: { id: userId },
        include: { employee: { include: { assignedStation: { select: { id: true, name: true } } } } },
      });
      if (!original) return null;
      const nextRole = input.systemRole ?? original.systemRole;
      const roleChanges = nextRole !== original.systemRole;
      if (roleChanges && userId === adminUserId) throw new ForbiddenError("לא ניתן לשנות את תפקיד המערכת של המשתמש שמחובר כעת");
      if (roleChanges && original.systemRole === "ADMIN" && original.active) {
        const activeAdmins = await tx.user.count({ where: { systemRole: "ADMIN", active: true } });
        if (activeAdmins <= 1) throw new ConflictError("לא ניתן להסיר את הרשאת המנהל האחרון במערכת");
      }
      if (input.email && input.email !== original.email) {
        const duplicate = await tx.user.findUnique({ where: { email: input.email } });
        if (duplicate) throw new ConflictError("כתובת הדוא״ל כבר משויכת למשתמש במערכת");
      }
      if (nextRole === "EMPLOYEE" && input.assignedStationId) {
        const station = await tx.station.findFirst({ where: { id: input.assignedStationId, active: true, archivedAt: null } });
        if (!station) throw new ConflictError("ניתן לשייך עובד רק לעמדה פעילה שאינה בארכיון");
      }

      await tx.user.update({
        where: { id: userId },
        data: { displayName: input.displayName, email: input.email, systemRole: nextRole },
      });
      if (nextRole === "EMPLOYEE") {
        if (original.employee) {
          await tx.employee.update({
            where: { id: original.employee.id },
            data: {
              jobPosition: input.jobPosition,
              hourlyRateCents: input.hourlyRate === undefined ? undefined : Math.round(input.hourlyRate * 100),
              assignedStationId: input.assignedStationId,
            },
          });
        } else {
          await tx.employee.create({ data: {
            userId,
            jobPosition: input.jobPosition ?? "עובד",
            hourlyRateCents: Math.round((input.hourlyRate ?? 0) * 100),
            assignedStationId: input.assignedStationId ?? null,
          } });
        }
      } else if (roleChanges && original.employee?.assignedStationId) {
        await tx.employee.update({ where: { id: original.employee.id }, data: { assignedStationId: null } });
      }

      if (roleChanges) {
        await tx.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
      }
      const updated = await tx.user.findUniqueOrThrow({
        where: { id: userId },
        select: {
          id: true, email: true, displayName: true, systemRole: true, active: true,
          employee: { select: { id: true, jobPosition: true, hourlyRateCents: true, assignedStationId: true, assignedStation: { select: { name: true } } } },
        },
      });
      await tx.auditLog.create({ data: {
        entityType: "USER", entityId: userId, fieldName: "profileAndRole",
        originalValue: {
          email: original.email, displayName: original.displayName, systemRole: original.systemRole,
          jobPosition: original.employee?.jobPosition ?? null, hourlyRateCents: original.employee?.hourlyRateCents ?? null,
          assignedStationId: original.employee?.assignedStationId ?? null,
        },
        newValue: {
          email: updated.email, displayName: updated.displayName, systemRole: updated.systemRole,
          jobPosition: updated.employee?.jobPosition ?? null, hourlyRateCents: updated.employee?.hourlyRateCents ?? null,
          assignedStationId: updated.employee?.assignedStationId ?? null,
        },
        adminUserId, reason: input.reason,
      } });
      return updated;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async setManagedUserStatus(userId: string, active: boolean, adminUserId: string, reason: string) {
    return this.prisma.$transaction(async tx => {
      const original = await tx.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, displayName: true, systemRole: true, active: true },
      });
      if (!original) return null;
      if (original.active === active) throw new ConflictError(active ? "המשתמש כבר פעיל" : "המשתמש כבר אינו פעיל");
      if (!active && userId === adminUserId) throw new ForbiddenError("לא ניתן להשבית את המשתמש שמחובר כעת");
      if (!active && original.systemRole === "ADMIN") {
        const activeAdmins = await tx.user.count({ where: { systemRole: "ADMIN", active: true } });
        if (activeAdmins <= 1) throw new ConflictError("לא ניתן להשבית את המנהל האחרון במערכת");
      }
      const updated = await tx.user.update({
        where: { id: userId }, data: { active },
        select: {
          id: true, email: true, displayName: true, systemRole: true, active: true,
          employee: { select: { id: true, jobPosition: true, hourlyRateCents: true, assignedStationId: true, assignedStation: { select: { name: true } } } },
        },
      });
      if (!active) await tx.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
      await tx.auditLog.create({ data: {
        entityType: "USER", entityId: userId, fieldName: "active",
        originalValue: original.active, newValue: active, adminUserId, reason,
      } });
      return updated;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async resetManagedUserPassword(userId: string, passwordHash: string, adminUserId: string) {
    return this.prisma.$transaction(async tx => {
      const target = await tx.user.findUnique({ where: { id: userId }, select: { id: true } });
      if (!target) return null;
      await tx.user.update({ where: { id: userId }, data: { passwordHash } });
      await tx.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
      await tx.auditLog.create({ data: {
        entityType: "USER", entityId: userId, fieldName: "passwordReset",
        originalValue: Prisma.JsonNull, newValue: Prisma.JsonNull,
        adminUserId, reason: "איפוס סיסמה על ידי מנהל",
      } });
      return target;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async getEmployeeAssignment(employeeId: string) {
    return this.prisma.employee.findFirst({
      where: { id: employeeId, user: { active: true }, assignedStation: { active: true, archivedAt: null } },
      select: {
        id: true,
        assignedStationId: true,
        assignedStation: { select: { id: true, name: true, active: true, archivedAt: true } },
      },
    });
  }

  async assignEmployeeStation(employeeId: string, stationId: number | null, adminUserId: string, reason: string) {
    return this.prisma.$transaction(async tx => {
      const employee = await tx.employee.findUnique({
        where: { id: employeeId },
        include: { assignedStation: { select: { id: true, name: true } }, user: { select: { displayName: true } } },
      });
      if (!employee) return null;

      const latestAttendance = await tx.attendanceRecord.findFirst({
        where: { employeeId, deletedAt: null },
        orderBy: { serverTimestamp: "desc" },
        select: { action: true },
      });
      if (latestAttendance?.action === "CLOCK_IN") throw new ConflictError("לא ניתן לשנות עמדה בזמן שהעובד במשמרת פעילה");

      const nextStation = stationId === null ? null : await tx.station.findFirst({
        where: { id: stationId, active: true, archivedAt: null },
        select: { id: true, name: true },
      });
      if (stationId !== null && !nextStation) throw new ConflictError("ניתן לשייך עובד רק לעמדה פעילה שאינה בארכיון");
      if (employee.assignedStationId === stationId) throw new ConflictError("העובד כבר משויך לעמדה שנבחרה");

      const updated = await tx.employee.update({
        where: { id: employeeId },
        data: { assignedStationId: stationId },
        include: { assignedStation: { select: { id: true, name: true } }, user: { select: { displayName: true } } },
      });
      await tx.auditLog.create({ data: {
        entityType: "EMPLOYEE",
        entityId: employeeId,
        fieldName: "assignedStationId",
        originalValue: employee.assignedStation
          ? { id: employee.assignedStation.id, name: employee.assignedStation.name }
          : Prisma.JsonNull,
        newValue: nextStation ? { id: nextStation.id, name: nextStation.name } : Prisma.JsonNull,
        adminUserId,
        reason,
      } });
      return updated;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async getPayrollReport(input: { from: string; to: string; employeeId?: string; stationId?: number }) {
    const startProbe = new Date(`${input.from}T00:00:00.000Z`);
    const endProbe = new Date(`${input.to}T23:59:59.999Z`);
    const queryStart = new Date(startProbe.getTime() - 36 * 60 * 60 * 1000);
    const queryEnd = new Date(endProbe.getTime() + 36 * 60 * 60 * 1000);
    const employeeWhere = input.employeeId ? { id: input.employeeId } : {};
    const [employees, attendance, sales] = await Promise.all([
      this.prisma.employee.findMany({
        where: employeeWhere,
        include: { user: { select: { displayName: true, active: true } }, assignedStation: { select: { id: true, name: true } } },
        orderBy: { user: { displayName: "asc" } },
      }),
      this.prisma.attendanceRecord.findMany({
        where: {
          ...(input.employeeId ? { employeeId: input.employeeId } : {}),
          serverTimestamp: { gte: queryStart, lte: queryEnd }, deletedAt: null,
          exceptionStatus: { in: ["NONE", "APPROVED"] },
        },
        include: { station: { select: { id: true, name: true, address: true, locationDescription: true, latitude: true, longitude: true } } },
        orderBy: [{ employeeId: "asc" }, { serverTimestamp: "asc" }],
      }),
      this.prisma.sale.findMany({
        where: {
          ...(input.employeeId ? { employeeId: input.employeeId } : {}),
          ...(input.stationId ? { stationId: input.stationId } : {}),
          serverTimestamp: { gte: queryStart, lte: queryEnd },
        },
        include: { product: { select: { id: true, name: true } }, station: { select: { id: true, name: true } } },
        orderBy: { serverTimestamp: "asc" },
      }),
    ]);

    const employeeById = new Map(employees.map(employee => [employee.id, employee]));
    const recordsByEmployee = new Map<string, typeof attendance>();
    for (const record of attendance) {
      const records = recordsByEmployee.get(record.employeeId) ?? [];
      records.push(record);
      recordsByEmployee.set(record.employeeId, records);
    }
    const salesByEmployee = new Map<string, typeof sales>();
    for (const sale of sales) {
      if (!dateInReport(sale.serverTimestamp, input.from, input.to)) continue;
      const employeeSales = salesByEmployee.get(sale.employeeId) ?? [];
      employeeSales.push(sale);
      salesByEmployee.set(sale.employeeId, employeeSales);
    }

    const shifts: Array<{
      id: string; employeeId: string; employeeName: string; jobPosition: string; date: string;
      clockIn: string; clockOut: string; durationMinutes: number; hourlyRateCents: number; salaryCents: number;
      station: { id: number; name: string; address: string; locationDescription: string | null; latitude: number; longitude: number };
      salesQuantity: number; salesAmountCents: number; products: Array<{ productId: string; productName: string; quantity: number; amountCents: number }>;
    }> = [];

    for (const [employeeId, records] of recordsByEmployee) {
      const employee = employeeById.get(employeeId);
      if (!employee) continue;
      let clockIn: (typeof records)[number] | null = null;
      for (const record of records) {
        if (record.action === "CLOCK_IN") { clockIn = record; continue; }
        if (!clockIn || record.serverTimestamp <= clockIn.serverTimestamp) continue;
        const shiftDate = israelDateKey(clockIn.serverTimestamp);
        if (shiftDate >= input.from && shiftDate <= input.to && (!input.stationId || clockIn.stationId === input.stationId)) {
          const shiftSales = (salesByEmployee.get(employeeId) ?? []).filter(sale => sale.serverTimestamp >= clockIn!.serverTimestamp && sale.serverTimestamp <= record.serverTimestamp);
          const productMap = new Map<string, { productId: string; productName: string; quantity: number; amountCents: number }>();
          for (const sale of shiftSales) {
            const product = productMap.get(sale.productId) ?? { productId: sale.productId, productName: sale.product.name, quantity: 0, amountCents: 0 };
            product.quantity += sale.quantity;
            product.amountCents += sale.totalAmountCents;
            productMap.set(sale.productId, product);
          }
          const durationMinutes = Math.max(0, Math.round((record.serverTimestamp.getTime() - clockIn.serverTimestamp.getTime()) / 60000));
          shifts.push({
            id: `${clockIn.id}:${record.id}`, employeeId, employeeName: employee.user.displayName, jobPosition: employee.jobPosition,
            date: shiftDate, clockIn: clockIn.serverTimestamp.toISOString(), clockOut: record.serverTimestamp.toISOString(), durationMinutes,
            hourlyRateCents: clockIn.hourlyRateCentsAtClockIn ?? employee.hourlyRateCents,
            salaryCents: Math.round(durationMinutes / 60 * (clockIn.hourlyRateCentsAtClockIn ?? employee.hourlyRateCents)),
            station: { ...clockIn.station, address: clockIn.station.address ?? "", locationDescription: clockIn.station.locationDescription ?? null },
            salesQuantity: shiftSales.reduce((sum, sale) => sum + sale.quantity, 0),
            salesAmountCents: shiftSales.reduce((sum, sale) => sum + sale.totalAmountCents, 0),
            products: [...productMap.values()].sort((a, b) => a.productName.localeCompare(b.productName, "he")),
          });
        }
        clockIn = null;
      }
    }
    shifts.sort((a, b) => b.clockIn.localeCompare(a.clockIn));

    const employeeSummaries = employees.map(employee => {
      const employeeShifts = shifts.filter(shift => shift.employeeId === employee.id);
      const products = new Map<string, { productId: string; productName: string; quantity: number; amountCents: number }>();
      for (const shift of employeeShifts) for (const item of shift.products) {
        const product = products.get(item.productId) ?? { ...item, quantity: 0, amountCents: 0 };
        product.quantity += item.quantity; product.amountCents += item.amountCents; products.set(item.productId, product);
      }
      return {
        employeeId: employee.id, employeeName: employee.user.displayName, jobPosition: employee.jobPosition,
        assignedStation: employee.assignedStation?.name ?? "ללא עמדה", hourlyRateCents: employee.hourlyRateCents,
        workDays: new Set(employeeShifts.map(shift => shift.date)).size,
        totalMinutes: employeeShifts.reduce((sum, shift) => sum + shift.durationMinutes, 0),
        salaryCents: employeeShifts.reduce((sum, shift) => sum + shift.salaryCents, 0),
        salesQuantity: employeeShifts.reduce((sum, shift) => sum + shift.salesQuantity, 0),
        salesAmountCents: employeeShifts.reduce((sum, shift) => sum + shift.salesAmountCents, 0),
        products: [...products.values()].sort((a, b) => a.productName.localeCompare(b.productName, "he")),
      };
    }).filter(employee => !input.stationId || employee.workDays > 0 || employees.find(item => item.id === employee.employeeId)?.assignedStationId === input.stationId);

    const productSummary = new Map<string, { productId: string; productName: string; quantity: number; amountCents: number }>();
    for (const shift of shifts) for (const item of shift.products) {
      const product = productSummary.get(item.productId) ?? { ...item, quantity: 0, amountCents: 0 };
      product.quantity += item.quantity; product.amountCents += item.amountCents; productSummary.set(item.productId, product);
    }
    return {
      period: { from: input.from, to: input.to },
      summary: {
        employees: employeeSummaries.filter(employee => employee.workDays > 0).length,
        workDays: employeeSummaries.reduce((sum, employee) => sum + employee.workDays, 0),
        totalMinutes: shifts.reduce((sum, shift) => sum + shift.durationMinutes, 0),
        salaryCents: shifts.reduce((sum, shift) => sum + shift.salaryCents, 0),
        salesQuantity: shifts.reduce((sum, shift) => sum + shift.salesQuantity, 0),
        salesAmountCents: shifts.reduce((sum, shift) => sum + shift.salesAmountCents, 0),
      },
      employees: employeeSummaries,
      shifts,
      products: [...productSummary.values()].sort((a, b) => b.quantity - a.quantity || a.productName.localeCompare(b.productName, "he")),
    };
  }

  async getEmployeeHome(employeeId: string, stationId: number) {
    const [station, attendance, employee, nearbyStations] = await Promise.all([
      this.prisma.station.findUnique({
        where: { id: stationId },
        include: { inventory: { where: { active: true, product: { active: true } }, include: { product: true }, orderBy: { product: { name: "asc" } } } },
      }),
      this.getAttendanceForEmployee(employeeId),
      this.prisma.employee.findUnique({ where: { id: employeeId }, select: { hourlyRateCents: true, jobPosition: true } }),
      this.prisma.station.findMany({ where: { active: true, archivedAt: null }, select: { id: true, name: true, address: true, locationDescription: true, latitude: true, longitude: true, allowedRadiusMeters: true, active: true, startDate: true, endDate: true }, orderBy: { name: "asc" } }),
    ]);
    if (!station || !employee) return null;
    const attendanceShiftSummary = await this.getAttendanceShiftSummary(employeeId);
    return { station, nearbyStations: [station, ...nearbyStations.filter(item => item.id !== station.id)], attendance, attendanceShiftSummary, employeeProfile: { ...employee, totalMinutes: attendanceShiftSummary.summary.totalMinutes, estimatedPayCents: attendanceShiftSummary.summary.totalPayCents } };
  }

  async getAttendanceShiftSummary(employeeId?: string) {
    const records = await this.prisma.attendanceRecord.findMany({
      where: { ...(employeeId ? { employeeId } : {}), deletedAt: null, exceptionStatus: { not: "REJECTED" } },
      include: {
        station: { select: { id: true, name: true, address: true, locationDescription: true, latitude: true, longitude: true } },
        employee: { select: { jobPosition: true, hourlyRateCents: true, user: { select: { displayName: true } } } },
      },
      orderBy: [{ employeeId: "asc" }, { serverTimestamp: "asc" }],
    });
    const currentMonth = israelDateKey(new Date()).slice(0, 7);
    return summarizeAttendanceShifts(pairAttendanceShifts(records).filter(shift => shift.date.startsWith(currentMonth)));
  }

  async getAttendanceForEmployee(employeeId: string) {
    return this.prisma.attendanceRecord.findMany({
      where: { employeeId, deletedAt: null },
      include: { station: { select: { name: true } } },
      orderBy: { serverTimestamp: "desc" },
      take: 60,
    });
  }

  async getAllAttendance() {
    return this.prisma.attendanceRecord.findMany({
      where: { deletedAt: null },
      include: { employee: { include: { user: { select: { displayName: true } } } }, station: true },
      orderBy: { serverTimestamp: "desc" },
      take: 300,
    });
  }

  async createAttendance(input: {
    employeeId: string; stationId: number; action: AttendanceAction; latitude: number; longitude: number;
    gpsAccuracy: number | null; distanceMeters: number; deviceInfo: string | null; exceptional: boolean;
  }) {
    return this.prisma.$transaction(async tx => {
      const latest = await tx.attendanceRecord.findFirst({ where: { employeeId: input.employeeId, deletedAt: null }, orderBy: { serverTimestamp: "desc" } });
      if (input.action === "CLOCK_IN" && latest?.action === "CLOCK_IN") throw new ConflictError("כבר קיימת משמרת פעילה");
      if (input.action === "CLOCK_OUT" && latest?.action !== "CLOCK_IN") throw new ConflictError("אין משמרת פעילה לסגירה");
      const employee = input.action === "CLOCK_IN" ? await tx.employee.findUniqueOrThrow({ where: { id: input.employeeId }, select: { hourlyRateCents: true } }) : null;
      return tx.attendanceRecord.create({
        data: {
          ...input,
          hourlyRateCentsAtClockIn: employee?.hourlyRateCents ?? null,
          exceptionStatus: input.exceptional ? "PENDING" : "NONE",
          serverTimestamp: new Date(),
        },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async createManualAttendance(input: {
    employeeId: string; stationId: number; action: AttendanceAction; timestamp: Date; latitude: number;
    longitude: number; gpsAccuracy?: number | null; distanceMeters: number; reason: string;
  }, adminUserId: string) {
    return this.prisma.$transaction(async tx => {
      const employee = input.action === "CLOCK_IN" ? await tx.employee.findUniqueOrThrow({ where: { id: input.employeeId }, select: { hourlyRateCents: true } }) : null;
      const record = await tx.attendanceRecord.create({
        data: {
          employeeId: input.employeeId, stationId: input.stationId, action: input.action,
          serverTimestamp: input.timestamp, latitude: input.latitude, longitude: input.longitude,
          gpsAccuracy: input.gpsAccuracy ?? null, distanceMeters: input.distanceMeters,
          deviceInfo: "הזנה ידנית בידי מנהל", exceptional: true,
          exceptionStatus: "APPROVED", reviewedByAdminId: adminUserId, reviewedAt: new Date(),
          reviewReason: input.reason,
          hourlyRateCentsAtClockIn: employee?.hourlyRateCents ?? null,
        },
      });
      await tx.auditLog.create({ data: {
        entityType: "ATTENDANCE", entityId: record.id, fieldName: "record",
        originalValue: Prisma.JsonNull, newValue: JSON.parse(JSON.stringify(record)),
        adminUserId, reason: input.reason,
      } });
      return record;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async correctAttendance(id: string, changes: Record<string, unknown>, adminUserId: string, reason: string) {
    const allowed = ["serverTimestamp", "stationId", "action", "approvedByAdminId", "exceptional"] as const;
    return this.prisma.$transaction(async tx => {
      const original = await tx.attendanceRecord.findFirst({ where: { id, deletedAt: null } });
      if (!original) return null;
      const data: Record<string, unknown> = {};
      for (const field of allowed) if (field in changes) data[field] = changes[field];
      const updated = await tx.attendanceRecord.update({ where: { id }, data });
      await tx.auditLog.createMany({ data: Object.keys(data).map(field => ({
        entityType: "ATTENDANCE" as const, entityId: id, fieldName: field,
        originalValue: toJson((original as Record<string, unknown>)[field]),
        newValue: toJson(data[field]), adminUserId, reason,
      })) });
      return updated;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async updateAttendanceShift(clockInId: string, input: { clockInAt: Date; clockOutAt: Date | null; stationId: number; reason: string }, adminUserId: string) {
    return this.prisma.$transaction(async tx => {
      const clockIn = await tx.attendanceRecord.findFirst({
        where: { id: clockInId, deletedAt: null },
        include: { employee: { include: { user: { select: { displayName: true } } } }, station: { select: { name: true } } },
      });
      if (!clockIn) return null;
      if (clockIn.action !== "CLOCK_IN") throw new ConflictError("ניתן לערוך משמרת רק מרשומת הכניסה שלה");
      const station = await tx.station.findFirst({ where: { id: input.stationId, archivedAt: null }, select: { id: true, name: true } });
      if (!station) throw new ConflictError("העמדה שנבחרה אינה קיימת או נמצאת בארכיון");
      const futureLimit = Date.now() + 5 * 60 * 1000;
      if (input.clockInAt.getTime() > futureLimit || (input.clockOutAt && input.clockOutAt.getTime() > futureLimit)) throw new ConflictError("לא ניתן לשמור שעת נוכחות עתידית");
      if (input.clockOutAt && input.clockOutAt <= input.clockInAt) throw new ConflictError("שעת היציאה חייבת להיות מאוחרת משעת הכניסה");

      const employeeRecords = await tx.attendanceRecord.findMany({
        where: { employeeId: clockIn.employeeId, deletedAt: null }, orderBy: { serverTimestamp: "asc" },
      });
      const targetIndex = employeeRecords.findIndex(record => record.id === clockIn.id);
      const next = targetIndex >= 0 ? employeeRecords[targetIndex + 1] : undefined;
      const clockOut = next?.action === "CLOCK_OUT" ? next : null;
      if (clockOut && input.clockOutAt === null) throw new ConflictError("לא ניתן להסיר שעת יציאה קיימת דרך עריכת המשמרת");

      const excluded = new Set([clockIn.id, ...(clockOut ? [clockOut.id] : [])]);
      const remaining = employeeRecords.filter(record => !excluded.has(record.id));
      const proposedEnd = input.clockOutAt?.getTime() ?? Number.POSITIVE_INFINITY;
      let otherOpenStart: Date | null = null;
      for (const record of remaining) {
        if (record.action === "CLOCK_IN") { otherOpenStart = record.serverTimestamp; continue; }
        if (!otherOpenStart) continue;
        const overlaps = input.clockInAt.getTime() < record.serverTimestamp.getTime() && proposedEnd > otherOpenStart.getTime();
        if (overlaps) throw new ConflictError("השעות שנבחרו חופפות למשמרת קיימת של העובד");
        otherOpenStart = null;
      }
      if (otherOpenStart && proposedEnd > otherOpenStart.getTime()) throw new ConflictError("כבר קיימת משמרת פתוחה או חופפת לעובד");

      const changed = clockIn.serverTimestamp.getTime() !== input.clockInAt.getTime() || clockIn.stationId !== input.stationId ||
        (clockOut ? clockOut.serverTimestamp.getTime() !== input.clockOutAt!.getTime() || clockOut.stationId !== input.stationId : input.clockOutAt !== null);
      if (!changed) throw new ConflictError("לא בוצע שינוי בשעות או בעמדה");

      const before = { employeeName: clockIn.employee.user.displayName, clockIn: clockIn.serverTimestamp.toISOString(), clockOut: clockOut?.serverTimestamp.toISOString() ?? null, stationName: clockIn.station.name };
      await tx.attendanceRecord.update({ where: { id: clockIn.id }, data: { serverTimestamp: input.clockInAt, stationId: input.stationId } });
      let clockOutId = clockOut?.id ?? null;
      if (clockOut && input.clockOutAt) {
        await tx.attendanceRecord.update({ where: { id: clockOut.id }, data: { serverTimestamp: input.clockOutAt, stationId: input.stationId } });
      } else if (!clockOut && input.clockOutAt) {
        const created = await tx.attendanceRecord.create({ data: {
          employeeId: clockIn.employeeId, stationId: input.stationId, action: "CLOCK_OUT", serverTimestamp: input.clockOutAt,
          latitude: clockIn.latitude, longitude: clockIn.longitude, gpsAccuracy: clockIn.gpsAccuracy, distanceMeters: clockIn.distanceMeters,
          deviceInfo: "השלמת משמרת בידי מנהל", exceptional: false, exceptionStatus: "APPROVED",
          reviewedByAdminId: adminUserId, reviewedAt: new Date(), reviewReason: input.reason, approvedByAdminId: adminUserId,
        } });
        clockOutId = created.id;
      }
      const after = { employeeName: clockIn.employee.user.displayName, clockIn: input.clockInAt.toISOString(), clockOut: input.clockOutAt?.toISOString() ?? null, stationName: station.name };
      await tx.auditLog.create({ data: { entityType: "ATTENDANCE", entityId: clockIn.id, fieldName: "shiftCorrection", originalValue: before, newValue: after, adminUserId, reason: input.reason } });
      return { clockInId: clockIn.id, clockOutId };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async softDeleteAttendanceShift(clockInId: string, reason: string, adminUserId: string) {
    return this.prisma.$transaction(async tx => {
      const clockIn = await tx.attendanceRecord.findFirst({
        where: { id: clockInId, deletedAt: null },
        include: { employee: { include: { user: { select: { displayName: true } } } }, station: { select: { name: true } } },
      });
      if (!clockIn) return null;
      if (clockIn.action !== "CLOCK_IN") throw new ConflictError("ניתן למחוק משמרת רק מרשומת הכניסה שלה");
      const next = await tx.attendanceRecord.findFirst({
        where: { employeeId: clockIn.employeeId, deletedAt: null, serverTimestamp: { gt: clockIn.serverTimestamp } }, orderBy: { serverTimestamp: "asc" },
      });
      const clockOut = next?.action === "CLOCK_OUT" ? next : null;
      const deletedAt = new Date();
      await tx.attendanceRecord.updateMany({ where: { id: { in: [clockIn.id, ...(clockOut ? [clockOut.id] : [])] }, deletedAt: null }, data: { deletedAt } });
      const snapshot = { employeeName: clockIn.employee.user.displayName, clockIn: clockIn.serverTimestamp.toISOString(), clockOut: clockOut?.serverTimestamp.toISOString() ?? null, stationName: clockIn.station.name };
      await tx.auditLog.create({ data: { entityType: "ATTENDANCE", entityId: clockIn.id, fieldName: "softDeleted", originalValue: snapshot, newValue: { ...snapshot, deleted: true }, adminUserId, reason } });
      return { clockInId: clockIn.id, clockOutId: clockOut?.id ?? null, deletedAt };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async getInventory(stationId: number) {
    return this.prisma.stationInventory.findMany({ where: { stationId }, include: { product: true }, orderBy: { product: { name: "asc" } } });
  }

  async createProduct(input: { name: string; price: number; active: boolean }, adminUserId: string) {
    return this.prisma.$transaction(async tx => {
      const product = await tx.product.create({ data: { name: input.name, currentPriceCents: Math.round(input.price * 100), active: input.active } });
      await tx.auditLog.create({ data: {
        entityType: "PRODUCT", entityId: product.id, fieldName: "created", originalValue: Prisma.JsonNull,
        newValue: product as unknown as PrismaTypes.InputJsonValue, adminUserId, reason: "יצירת מוצר חדש",
      } });
      return product;
    });
  }

  async updateProduct(id: string, input: { name?: string; price?: number; active?: boolean; reason: string }, adminUserId: string) {
    return this.prisma.$transaction(async tx => {
      const original = await tx.product.findUnique({ where: { id } });
      if (!original) return null;
      const { reason, price, ...rest } = input;
      const product = await tx.product.update({ where: { id }, data: { ...rest, ...(price !== undefined ? { currentPriceCents: Math.round(price * 100) } : {}) } });
      await tx.auditLog.create({ data: {
        entityType: "PRODUCT", entityId: id, fieldName: "product",
        originalValue: original as unknown as PrismaTypes.InputJsonValue, newValue: product as unknown as PrismaTypes.InputJsonValue,
        adminUserId, reason,
      } });
      return product;
    });
  }

  async getAttendanceExceptions(status?: "PENDING" | "APPROVED" | "REJECTED") {
    return this.prisma.attendanceRecord.findMany({
      where: {
        exceptional: true, deletedAt: null,
        ...(status ? { exceptionStatus: status } : {}),
      },
      include: {
        employee: { include: { user: { select: { displayName: true } } } },
        station: true,
        reviewedByAdmin: { select: { id: true, displayName: true } },
      },
      orderBy: { serverTimestamp: "desc" },
      take: 300,
    });
  }

  async reviewAttendanceException(
    id: string,
    decision: "APPROVED" | "REJECTED",
    adminUserId: string,
    reason?: string,
  ) {
    return this.prisma.$transaction(async tx => {
      const original = await tx.attendanceRecord.findFirst({ where: { id, deletedAt: null } });
      if (!original) return null;
      if (!original.exceptional) throw new ConflictError("רשומת הנוכחות אינה חריגה");
      if (original.exceptionStatus !== "PENDING") throw new ConflictError("חריגת הנוכחות כבר נבדקה");
      const reviewedAt = new Date();
      const updated = await tx.attendanceRecord.update({
        where: { id },
        data: {
          exceptionStatus: decision,
          reviewedByAdminId: adminUserId,
          reviewedAt,
          reviewReason: reason ?? null,
          approvedByAdminId: decision === "APPROVED" ? adminUserId : null,
        },
      });
      await tx.auditLog.create({
        data: {
          entityType: "ATTENDANCE",
          entityId: id,
          fieldName: "exceptionStatus",
          originalValue: original.exceptionStatus,
          newValue: decision,
          adminUserId,
          reason: reason ?? "אישור חריגת נוכחות",
        },
      });
      return updated;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async createSaleAtomic(input: { employeeId: string; stationId: number; productId: string; quantity: number }) {
    return this.withSerializableRetry(async () => this.prisma.$transaction(async tx => {
      const employee = await tx.employee.findUnique({ where: { id: input.employeeId } });
      if (!employee || employee.assignedStationId !== input.stationId) throw new ForbiddenError("העובד אינו מורשה לפעול בעמדה");
      const inventory = await tx.stationInventory.findUnique({
        where: { stationId_productId: { stationId: input.stationId, productId: input.productId } },
        include: { product: true },
      });
      if (!inventory?.active || !inventory.product.active || inventory.quantity < input.quantity) throw new ConflictError("המוצר אינו זמין למכירה או שאין מספיק מלאי");
      const nextQuantity = inventory.quantity - input.quantity;
      const updated = await tx.stationInventory.updateMany({
        where: { stationId: input.stationId, productId: input.productId, version: inventory.version, quantity: { gte: input.quantity } },
        data: { quantity: { decrement: input.quantity }, version: { increment: 1 } },
      });
      if (updated.count !== 1) throw new RetryableConflictError();
      const sale = await tx.sale.create({ data: {
        employeeId: input.employeeId, stationId: input.stationId, productId: input.productId,
        quantity: input.quantity, unitPriceCents: inventory.product.currentPriceCents,
        totalAmountCents: inventory.product.currentPriceCents * input.quantity,
        previousInventoryQuantity: inventory.quantity, newInventoryQuantity: nextQuantity,
      } });
      await tx.inventoryTransaction.create({ data: {
        stationId: input.stationId, productId: input.productId, transactionType: "SALE",
        quantityDelta: -input.quantity, previousQuantity: inventory.quantity, newQuantity: nextQuantity,
        employeeId: input.employeeId, saleId: sale.id,
      } });
      return sale;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));
  }

  async adjustInventory(input: { stationId: number; productId: string; quantityDelta: number; transactionType: InventoryTransactionType; reason: string }, adminUserId: string) {
    return this.prisma.$transaction(async tx => {
      const inventory = await tx.stationInventory.findUnique({ where: { stationId_productId: { stationId: input.stationId, productId: input.productId } } });
      if (!inventory) throw new ConflictError("המלאי לא נמצא");
      const nextQuantity = inventory.quantity + input.quantityDelta;
      if (nextQuantity < 0) throw new ConflictError("לא ניתן להפחית מעבר לכמות הקיימת");
      await tx.stationInventory.update({ where: { stationId_productId: { stationId: input.stationId, productId: input.productId } }, data: { quantity: nextQuantity, version: { increment: 1 } } });
      const transaction = await tx.inventoryTransaction.create({ data: {
        ...input, previousQuantity: inventory.quantity, newQuantity: nextQuantity, adminUserId,
      } });
      await tx.auditLog.create({ data: {
        entityType: "INVENTORY", entityId: `${input.stationId}:${input.productId}`, fieldName: "quantity",
        originalValue: inventory.quantity, newValue: nextQuantity, adminUserId, reason: input.reason,
      } });
      return transaction;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async createRefreshToken(data: { userId: string; tokenHash: string; familyId: string; expiresAt: Date; userAgent?: string; ipAddress?: string }) {
    return this.prisma.refreshToken.create({ data });
  }
  async findRefreshToken(tokenHash: string) { return this.prisma.refreshToken.findUnique({ where: { tokenHash }, include: { user: { include: { employee: true } } } }); }
  async rotateRefreshToken(id: string, replacement: { tokenHash: string; expiresAt: Date; userAgent?: string; ipAddress?: string }) {
    return this.prisma.$transaction(async tx => {
      const current = await tx.refreshToken.findUnique({ where: { id } });
      if (!current || current.revokedAt) throw new ForbiddenError("אסימון הרענון בוטל");
      const next = await tx.refreshToken.create({ data: { ...replacement, userId: current.userId, familyId: current.familyId } });
      await tx.refreshToken.update({ where: { id }, data: { revokedAt: new Date(), replacedByTokenId: next.id } });
      return next;
    });
  }
  async revokeTokenFamily(familyId: string) { await this.prisma.refreshToken.updateMany({ where: { familyId, revokedAt: null }, data: { revokedAt: new Date() } }); }

  async consumeRateLimit(key: string, limit: number, windowMs: number) {
    const now = new Date();
    return this.prisma.$transaction(async tx => {
      const current = await tx.rateLimitBucket.findUnique({ where: { key } });
      if (!current || now.getTime() - current.windowStart.getTime() >= windowMs) {
        await tx.rateLimitBucket.upsert({ where: { key }, update: { attempts: 1, windowStart: now, blockedUntil: null }, create: { key, attempts: 1, windowStart: now } });
        return { allowed: true, remaining: limit - 1 };
      }
      const attempts = current.attempts + 1;
      const allowed = attempts <= limit && (!current.blockedUntil || current.blockedUntil <= now);
      await tx.rateLimitBucket.update({ where: { key }, data: { attempts, blockedUntil: allowed ? current.blockedUntil : new Date(current.windowStart.getTime() + windowMs) } });
      return { allowed, remaining: Math.max(0, limit - attempts) };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  private async withSerializableRetry<T>(operation: () => Promise<T>, attempts = 3): Promise<T> {
    for (let attempt = 1; attempt <= attempts; attempt++) {
      try { return await operation(); }
      catch (error) {
        if (!(error instanceof RetryableConflictError) && !isPrismaWriteConflict(error)) throw error;
        if (attempt === attempts) throw new ConflictError("המלאי השתנה במקביל. יש לנסות שוב");
      }
    }
    throw new ConflictError("הפעולה לא הושלמה");
  }
}

function toJson(value: unknown): PrismaTypes.InputJsonValue | typeof Prisma.JsonNull {
  if (value === null || value === undefined) return Prisma.JsonNull;
  if (value instanceof Date) return value.toISOString();
  return value as PrismaTypes.InputJsonValue;
}
const israelDateFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem", year: "numeric", month: "2-digit", day: "2-digit" });
function israelDateKey(value: Date) {
  const parts = israelDateFormatter.formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(item => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}
function dateInReport(value: Date, from: string, to: string) {
  const key = israelDateKey(value);
  return key >= from && key <= to;
}
function isPrismaWriteConflict(error: unknown) { return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034"; }
class RetryableConflictError extends Error {}
export class ConflictError extends Error {}
export class ForbiddenError extends Error {}
