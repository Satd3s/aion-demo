// Generado por scripts/build-demo-web.mjs — no editar a mano.
(function () {
'use strict';
const __BRAND = {"productName":"Aion","productTagline":"Control de asistencia · de Aesip","vendorName":"Aesip","accentColor":"#FFB000"};
const { AppError, formatApiResponse, formatApiError, validateEmployeeInput, validateShiftInput, validateHolidayInput, validateLeaveInput } = (function () {

// shared/contracts.mjs
// Single source of truth for schemas, API contracts, and standard error formatting (GEMINI v4.2)

class AppError extends Error {
  constructor(code, message, details = {}, status = 400) {
    super(message);
    this.name = code;
    this.code = code;
    this.details = details;
    this.status = status;
  }
}

function formatApiResponse(data, requestId, cursor = null) {
  return {
    data,
    error: null,
    meta: {
      requestId: requestId || crypto.randomUUID(),
      cursor
    }
  };
}

function formatApiError(code, message, details = {}, traceId = null) {
  return {
    data: null,
    error: {
      code: String(code || 'INTERNAL_ERROR'),
      message: String(message || 'Unexpected error'),
      details: details || {},
      traceId: traceId || crypto.randomUUID()
    }
  };
}

function validateEmployeeInput(payload = {}) {
  const zkUserId = String(payload.zkUserId ?? '').trim();
  const name = String(payload.name ?? '').trim();
  const department = String(payload.department ?? 'General').trim() || 'General';
  const position = String(payload.position ?? 'Operativo').trim() || 'Operativo';
  const shiftId = String(payload.shiftId ?? 'shift-default').trim() || 'shift-default';
  const cardNumber = String(payload.cardNumber ?? '').trim();
  const privilege = Number(payload.privilege ?? 0);
  const active = payload.active !== undefined ? Boolean(payload.active) : true;
  const hireDate = String(payload.hireDate ?? new Date().toISOString().slice(0, 10)).trim();

  if (!zkUserId || !/^\d+$/.test(zkUserId)) {
    throw new AppError('INVALID_EMPLOYEE', 'El ID de reloj (PIN ZKTeco) es obligatorio y debe ser numérico.', { field: 'zkUserId' });
  }
  if (!name || name.length < 2) {
    throw new AppError('INVALID_EMPLOYEE', 'El nombre completo del empleado es obligatorio.', { field: 'name' });
  }

  return {
    id: payload.id || `emp-${zkUserId}`,
    zkUserId,
    name,
    department,
    position,
    shiftId,
    cardNumber,
    privilege,
    active,
    hireDate
  };
}

function validateShiftInput(payload = {}) {
  const name = String(payload.name ?? '').trim();
  const entryTime = String(payload.entryTime ?? '08:00').trim();
  const exitTime = String(payload.exitTime ?? '18:00').trim();
  const lateToleranceMinutes = Number(payload.lateToleranceMinutes ?? 10);
  const absenceThresholdMinutes = Number(payload.absenceThresholdMinutes ?? 120);
  const workDays = Array.isArray(payload.workDays)
    ? payload.workDays.map(Number)
    : [1, 2, 3, 4, 5, 6];

  if (!name) {
    throw new AppError('INVALID_SHIFT', 'El nombre del horario/turno es obligatorio.');
  }
  if (!/^\d{2}:\d{2}$/.test(entryTime) || !/^\d{2}:\d{2}$/.test(exitTime)) {
    throw new AppError('INVALID_SHIFT', 'Formato de hora inválido (use HH:MM).');
  }

  return {
    id: payload.id || `shift-${Date.now()}`,
    name,
    entryTime,
    exitTime,
    lateToleranceMinutes: Math.max(0, lateToleranceMinutes),
    absenceThresholdMinutes: Math.max(0, absenceThresholdMinutes),
    workDays
  };
}

function validateHolidayInput(payload = {}) {
  const date = String(payload.date ?? '').trim();
  const name = String(payload.name ?? '').trim();
  const isOfficial = payload.isOfficial !== undefined ? Boolean(payload.isOfficial) : true;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !name) {
    throw new AppError('INVALID_HOLIDAY', 'La fecha (YYYY-MM-DD) y el nombre del día festivo son obligatorios.');
  }

  return {
    id: payload.id || `hol-${date}`,
    date,
    name,
    isOfficial
  };
}

function validateLeaveInput(payload = {}) {
  const employeeId = String(payload.employeeId ?? '').trim();
  const type = String(payload.type ?? 'VACACIONES').trim().toUpperCase();
  const startDate = String(payload.startDate ?? '').trim();
  const endDate = String(payload.endDate ?? '').trim();
  const notes = String(payload.notes ?? '').trim();

  const allowedTypes = ['VACACIONES', 'PERMISO', 'INCAPACIDAD', 'COMISION'];
  if (!employeeId) {
    throw new AppError('INVALID_LEAVE', 'Debe seleccionar un empleado.');
  }
  if (!allowedTypes.includes(type)) {
    throw new AppError('INVALID_LEAVE', `Tipo de incidencia inválido. Permitidos: ${allowedTypes.join(', ')}`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate) || startDate > endDate) {
    throw new AppError('INVALID_LEAVE', 'Rango de fechas inválido para vacaciones/permiso.');
  }

  return {
    id: payload.id || `leave-${crypto.randomUUID()}`,
    employeeId,
    type,
    startDate,
    endDate,
    notes
  };
}

return { AppError, formatApiResponse, formatApiError, validateEmployeeInput, validateShiftInput, validateHolidayInput, validateLeaveInput };
})();
const { LFT_WEEKLY_LIMITS_BY_YEAR, getLegalMaxWeeklyHours, evaluateAttendanceReport } = (function () {

const crypto = { createHash: () => { let s = ''; return { update(v) { s += v; return this; }, digest() { return __sha256(s); } }; } };
function __sha256(str) {
  const K = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
  const bytes = new TextEncoder().encode(str);
  const len = bytes.length, bitLen = len * 8;
  const total = ((len + 9 + 63) >> 6) << 6;
  const m = new Uint8Array(total); m.set(bytes); m[len] = 0x80;
  const dv = new DataView(m.buffer);
  dv.setUint32(total - 8, Math.floor(bitLen / 4294967296)); dv.setUint32(total - 4, bitLen >>> 0);
  let h = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
  const w = new Uint32Array(64), rr = (x, n) => (x >>> n) | (x << (32 - n));
  for (let o = 0; o < total; o += 64) {
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(o + i * 4);
    for (let i = 16; i < 64; i++) { const s0 = rr(w[i-15],7) ^ rr(w[i-15],18) ^ (w[i-15] >>> 3); const s1 = rr(w[i-2],17) ^ rr(w[i-2],19) ^ (w[i-2] >>> 10); w[i] = (w[i-16] + s0 + w[i-7] + s1) >>> 0; }
    let [a,b,c,d,e,f,g,hh] = h;
    for (let i = 0; i < 64; i++) {
      const t1 = (hh + (rr(e,6) ^ rr(e,11) ^ rr(e,25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) >>> 0;
      const t2 = ((rr(a,2) ^ rr(a,13) ^ rr(a,22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
      hh = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    h = h.map((v, i) => (v + [a,b,c,d,e,f,g,hh][i]) >>> 0);
  }
  return h.map((v) => v.toString(16).padStart(8, '0')).join('');
}
// src/domain/attendance-engine.mjs
// Pure Domain Layer: Attendance calculation, late rules, holidays, vacations, and LFT / STPS Enero 2027 Compliance
// (Art. 132 Fracc. XXXIV Registro Electrónico Obligatorio, Jornada Máxima 46h y Tope Horas Extra Art. 66/68).

const LFT_WEEKLY_LIMITS_BY_YEAR = {
  2026: 48,
  2027: 46, // Entrada en vigor 1 de Enero 2027
  2028: 44,
  2029: 42,
  2030: 40
};

function getLegalMaxWeeklyHours(regimeYear = 2027) {
  const y = Number(regimeYear) || 2027;
  if (y >= 2030) return 40;
  return LFT_WEEKLY_LIMITS_BY_YEAR[y] || 46;
}

function timeToMinutes(hhmm) {
  const [h, m] = String(hhmm || '08:00').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function extractTimeHHMM(timestampStr) {
  const parts = String(timestampStr).trim().split(/\s+|T/);
  if (parts.length < 2) return '00:00';
  return parts[1].slice(0, 5);
}

function extractDateYYYYMMDD(timestampStr) {
  return String(timestampStr).trim().slice(0, 10);
}

function getDateRangeArray(startDateStr, endDateStr) {
  const dates = [];
  const curr = new Date(`${startDateStr}T12:00:00`);
  const end = new Date(`${endDateStr}T12:00:00`);
  while (curr <= end) {
    const y = curr.getFullYear();
    const m = String(curr.getMonth() + 1).padStart(2, '0');
    const d = String(curr.getDate()).padStart(2, '0');
    dates.push({
      date: `${y}-${m}-${d}`,
      dayOfWeek: curr.getDay() // 0 = Domingo, 1 = Lunes ... 6 = Sábado
    });
    curr.setDate(curr.getDate() + 1);
  }
  return dates;
}

const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

function evaluateAttendanceReport({
  startDate,
  endDate,
  employees = [],
  shifts = [],
  holidays = [],
  leaves = [],
  logs = [],
  customToleranceMinutes = null,
  lftRegimeYear = 2027,
  mealBreakMinutes = 60
}) {
  const dateRange = getDateRangeArray(startDate, endDate);
  const legalMaxWeeklyHours = getLegalMaxWeeklyHours(lftRegimeYear);
  const maxDailyOvertimeHours = 4; // Art. 66 LFT
  const maxWeeklyOvertimeHours = 12; // Límite semanal horas extra LFT

  const shiftMap = new Map(shifts.map((s) => [s.id, s]));
  const defaultShift = shifts[0] || {
    id: 'shift-default',
    name: 'Horario General',
    entryTime: '08:00',
    exitTime: '18:00',
    lateToleranceMinutes: 10,
    absenceThresholdMinutes: 120,
    workDays: [1, 2, 3, 4, 5, 6]
  };

  const holidayMap = new Map(holidays.map((h) => [h.date, h]));

  const logsByUserAndDate = new Map();
  for (const log of logs) {
    const d = extractDateYYYYMMDD(log.timestamp);
    const key = `${log.zkUserId}::${d}`;
    if (!logsByUserAndDate.has(key)) {
      logsByUserAndDate.set(key, []);
    }
    logsByUserAndDate.get(key).push(log);
  }

  let presentCount = 0;
  let lateCount = 0;
  let absenceCount = 0;
  let holidayCount = 0;
  let vacationCount = 0;
  let restCount = 0;
  let totalOrdinaryHoursAll = 0;
  let totalOvertimeHoursAll = 0;
  let totalWorkedHoursAll = 0;
  let lftAlertsCount = 0;

  const employeeSummaries = [];
  const dailyRows = [];

  // Number of weeks spanned by range (minimum 1 week for weekly cap scaling)
  const weeksFactor = Math.max(1, dateRange.length / 7);
  const periodMaxOrdinaryHours = Number((legalMaxWeeklyHours * weeksFactor).toFixed(2));

  for (const emp of employees) {
    const shift = shiftMap.get(emp.shiftId) || defaultShift;
    const tolerance =
      customToleranceMinutes !== null && customToleranceMinutes !== undefined && customToleranceMinutes !== ''
        ? Number(customToleranceMinutes)
        : Number(shift.lateToleranceMinutes ?? 10);

    const entryMinutes = timeToMinutes(shift.entryTime);
    const exitMinutes = timeToMinutes(shift.exitTime);
    const scheduledGrossMinutes = Math.max(0, exitMinutes - entryMinutes);
    const effectiveMealMinutes = scheduledGrossMinutes >= 360 ? Number(mealBreakMinutes) : 0;
    const dailyMaxOrdinaryHours = Number(
      Math.min(8, Math.max(1, (scheduledGrossMinutes - effectiveMealMinutes) / 60)).toFixed(2)
    );

    const workDays = Array.isArray(shift.workDays) ? shift.workDays : [1, 2, 3, 4, 5, 6];
    const empLeaves = leaves.filter((l) => l.employeeId === emp.id || l.employeeId === emp.zkUserId);

    let empPresent = 0;
    let empLate = 0;
    let empAbsences = 0;
    let empVacations = 0;
    let empHolidays = 0;
    let empLateMinutes = 0;
    let empOrdinaryHours = 0;
    let empOvertimeHours = 0;
    let empWorkedHours = 0;
    const empDays = [];

    for (const dayObj of dateRange) {
      const { date, dayOfWeek } = dayObj;
      const key = `${emp.zkUserId}::${date}`;
      const dayLogs = (logsByUserAndDate.get(key) || [])
        .slice()
        .sort((a, b) => String(a.timestamp).localeCompare(String(b.timestamp)));

      const firstPunch = dayLogs.length > 0 ? extractTimeHHMM(dayLogs[0].timestamp) : null;
      const lastPunch =
        dayLogs.length > 1 ? extractTimeHHMM(dayLogs[dayLogs.length - 1].timestamp) : null;

      let workedHours = 0;
      let ordinaryHours = 0;
      let overtimeHours = 0;

      if (firstPunch && lastPunch) {
        const grossDiffMin = timeToMinutes(lastPunch) - timeToMinutes(firstPunch);
        if (grossDiffMin > 0) {
          // Deduct meal break if shift is >= 6.5 hours so effective net hours comply with LFT Art. 63-64
          const netMin = grossDiffMin > 390 ? grossDiffMin - effectiveMealMinutes : grossDiffMin;
          workedHours = Number(Math.max(0, netMin / 60).toFixed(2));
          ordinaryHours = Number(Math.min(workedHours, dailyMaxOrdinaryHours).toFixed(2));
          overtimeHours = Number(Math.max(0, workedHours - ordinaryHours).toFixed(2));
        }
      }

      const holiday = holidayMap.get(date);
      const activeLeave = empLeaves.find((l) => date >= l.startDate && date <= l.endDate);
      const isWorkDay = workDays.includes(dayOfWeek);

      let status = 'ASISTENCIA';
      let statusLabel = 'Asistencia Puntual';
      let lateMinutes = 0;
      let notes = '';

      if (holiday) {
        status = 'FESTIVO';
        statusLabel = `Festivo: ${holiday.name}`;
        notes = holiday.name;
        holidayCount++;
        empHolidays++;
      } else if (activeLeave) {
        status = activeLeave.type || 'VACACIONES';
        statusLabel = activeLeave.type === 'VACACIONES' ? 'Vacaciones' : activeLeave.type;
        notes = activeLeave.notes || activeLeave.type;
        vacationCount++;
        empVacations++;
      } else if (!isWorkDay) {
        if (firstPunch) {
          status = 'ASISTENCIA';
          statusLabel = 'Laborado en Descanso (Extra)';
          overtimeHours = workedHours;
          ordinaryHours = 0;
          presentCount++;
          empPresent++;
        } else {
          status = 'DESCANSO';
          statusLabel = 'Día de Descanso (LFT Art. 69)';
          restCount++;
        }
      } else {
        if (!firstPunch) {
          status = 'FALTA';
          statusLabel = 'Falta Injustificada';
          absenceCount++;
          empAbsences++;
        } else {
          const punchMinutes = timeToMinutes(firstPunch);
          const diffFromEntry = punchMinutes - entryMinutes;
          if (diffFromEntry > tolerance) {
            status = 'RETARDO';
            lateMinutes = diffFromEntry;
            statusLabel = `Retardo (+${lateMinutes} min)`;
            lateCount++;
            empLate++;
            empLateMinutes += lateMinutes;
          } else {
            status = 'ASISTENCIA';
            statusLabel = 'Asistencia Puntual';
            presentCount++;
            empPresent++;
          }
        }
      }

      empOrdinaryHours = Number((empOrdinaryHours + ordinaryHours).toFixed(2));
      empOvertimeHours = Number((empOvertimeHours + overtimeHours).toFixed(2));
      empWorkedHours = Number((empWorkedHours + workedHours).toFixed(2));

      totalOrdinaryHoursAll = Number((totalOrdinaryHoursAll + ordinaryHours).toFixed(2));
      totalOvertimeHoursAll = Number((totalOvertimeHoursAll + overtimeHours).toFixed(2));
      totalWorkedHoursAll = Number((totalWorkedHoursAll + workedHours).toFixed(2));

      const lftDailyWarning =
        overtimeHours > maxDailyOvertimeHours
          ? `Excede tope diario de 4h extra (Art. 66 LFT)`
          : workedHours > 12
          ? `Excede jornada máxima acumulada de 12h diarias`
          : '';

      const dayRecord = {
        date,
        dayName: DAY_NAMES[dayOfWeek],
        employeeId: emp.id,
        zkUserId: emp.zkUserId,
        employeeName: emp.name,
        department: emp.department,
        position: emp.position,
        shiftName: shift.name,
        scheduledEntry: shift.entryTime,
        scheduledExit: shift.exitTime,
        checkIn: firstPunch,
        checkOut: lastPunch,
        totalPunches: dayLogs.length,
        ordinaryHours,
        overtimeHours,
        workedHours,
        status,
        statusLabel,
        lateMinutes,
        lftDailyWarning,
        notes
      };

      empDays.push(dayRecord);
      dailyRows.push(dayRecord);
    }

    // Reclassify any excess ordinary hours above the LFT weekly limit (e.g. 46h in Jan 2027) as overtime
    if (empOrdinaryHours > periodMaxOrdinaryHours) {
      const excess = Number((empOrdinaryHours - periodMaxOrdinaryHours).toFixed(2));
      empOrdinaryHours = periodMaxOrdinaryHours;
      empOvertimeHours = Number((empOvertimeHours + excess).toFixed(2));
    }

    const doubleOvertimeHours = Number(Math.min(empOvertimeHours, 9 * weeksFactor).toFixed(2));
    const tripleOvertimeHours = Number(Math.max(0, empOvertimeHours - doubleOvertimeHours).toFixed(2));

    let lftStatus = 'CUMPLE LFT';
    if (empOvertimeHours > maxWeeklyOvertimeHours * weeksFactor) {
      lftStatus = 'ALERTA TOPE EXTRA (ART. 68)';
      lftAlertsCount++;
    } else if (empOvertimeHours > 0) {
      lftStatus = `DENTRO DE LÍMITE (${empOvertimeHours}h extra)`;
    }

    employeeSummaries.push({
      employeeId: emp.id,
      zkUserId: emp.zkUserId,
      name: emp.name,
      department: emp.department,
      position: emp.position,
      shiftName: shift.name,
      presentDays: empPresent,
      lateDays: empLate,
      absenceDays: empAbsences,
      vacationDays: empVacations,
      holidayDays: empHolidays,
      totalLateMinutes: empLateMinutes,
      ordinaryHours: empOrdinaryHours,
      overtimeHours: empOvertimeHours,
      doubleOvertimeHours,
      tripleOvertimeHours,
      totalWorkedHours: empWorkedHours,
      legalMaxWeeklyHours,
      lftStatus,
      days: empDays
    });
  }

  // Generate cryptographic STPS electronic record seal (Art. 132 Fracc. XXXIV LFT)
  const hashPayload = JSON.stringify({
    startDate,
    endDate,
    lftRegimeYear,
    legalMaxWeeklyHours,
    totalEmployees: employees.length,
    totalWorkedHoursAll,
    rowsCount: dailyRows.length
  });
  const integrityHash = crypto.createHash('sha256').update(hashPayload).digest('hex').slice(0, 24).toUpperCase();

  return {
    range: { startDate, endDate, totalDays: dateRange.length },
    lftCompliance: {
      article: 'Art. 132 Fracción XXXIV y Art. 123 Constitucional (Reforma Vigente Enero)',
      regimeYear: Number(lftRegimeYear),
      legalMaxWeeklyHours,
      maxDailyOvertimeHours,
      maxWeeklyOvertimeHours,
      mealBreakMinutes: Number(mealBreakMinutes),
      lftAlertsCount,
      integrityHash: `STPS-LFT-${integrityHash}`
    },
    summary: {
      totalEmployees: employees.length,
      presentCount,
      lateCount,
      absenceCount,
      holidayCount,
      vacationCount,
      restCount,
      totalOrdinaryHours: totalOrdinaryHoursAll,
      totalOvertimeHours: totalOvertimeHoursAll,
      totalWorkedHours: totalWorkedHoursAll
    },
    employeeSummaries,
    dailyRows
  };
}

return { LFT_WEEKLY_LIMITS_BY_YEAR, getLegalMaxWeeklyHours, evaluateAttendanceReport };
})();
const { ZK_COMMANDS, computeZkChecksum, createZkHeader, encodeZkTime, decodeZkTime, parseUsbAttLogContent, formatEmployeesToUsbDat } = (function () {

// src/infrastructure/zkteco/zk-protocol.mjs
// Utilidades ZKTeco: encabezados/fechas del protocolo y archivos USB (_attlog.dat / user.dat)

const ZK_COMMANDS = {
  CMD_CONNECT: 1000,
  CMD_EXIT: 1001,
  CMD_ENABLEDEVICE: 1002,
  CMD_DISABLEDEVICE: 1003,
  CMD_ACK_OK: 2000,
  CMD_ACK_ERROR: 2001,
  CMD_ACK_DATA: 2002,
  CMD_PREPARE_DATA: 1500,
  CMD_DATA: 1501,
  CMD_FREE_DATA: 1502,
  CMD_USER_WRQ: 8,
  CMD_USERTEMP_RRQ: 9,
  CMD_ATTLOG_RRQ: 13,
  CMD_CLEAR_ATTLOG: 15,
  CMD_DELETE_USER: 18,
  CMD_GET_TIME: 201
};

function computeZkChecksum(buf) {
  let sum = 0;
  for (let i = 0; i < buf.length; i += 2) {
    if (i === 2) continue; // skip checksum field itself
    if (i + 1 < buf.length) {
      sum += buf.readUInt16LE(i);
    } else {
      sum += buf[i];
    }
    while (sum > 0xffff) {
      sum = (sum & 0xffff) + (sum >> 16);
    }
  }
  return (~sum) & 0xffff;
}

function createZkHeader(command, sessionId = 0, replyId = 0, payload = Buffer.alloc(0)) {
  const buf = Buffer.alloc(8 + payload.length);
  buf.writeUInt16LE(command, 0);
  buf.writeUInt16LE(0, 2);
  buf.writeUInt16LE(sessionId, 4);
  buf.writeUInt16LE(replyId, 6);
  if (payload.length > 0) {
    payload.copy(buf, 8);
  }
  const chksum = computeZkChecksum(buf);
  buf.writeUInt16LE(chksum, 2);
  return buf;
}

function encodeZkTime(dateObj) {
  const d = dateObj instanceof Date ? dateObj : new Date(dateObj);
  const year = d.getFullYear() - 2000;
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const hour = d.getHours();
  const minute = d.getMinutes();
  const second = d.getSeconds();

  return (
    ((year * 12 * 31 + (month - 1) * 31 + (day - 1)) * (24 * 60 * 60)) +
    (hour * 60 + minute) * 60 +
    second
  );
}

function decodeZkTime(timeInt) {
  let t = Number(timeInt) >>> 0;
  const second = t % 60;
  t = Math.floor(t / 60);
  const minute = t % 60;
  t = Math.floor(t / 60);
  const hour = t % 24;
  t = Math.floor(t / 24);
  const day = (t % 31) + 1;
  t = Math.floor(t / 31);
  const month = (t % 12) + 1;
  t = Math.floor(t / 12);
  const year = t + 2000;

  const pad = (n) => String(n).padStart(2, '0');
  return `${year}-${pad(month)}-${pad(day)} ${pad(hour)}:${pad(minute)}:${pad(second)}`;
}

/**
 * Parses standard ZKTeco USB attendance files (`*_attlog.dat` or CSV/TXT exports)
 * Format: `\tPIN\tYYYY-MM-DD HH:MM:SS\tDeviceID\tInOutState\tVerifyMode\tWorkCode`
 */
function parseUsbAttLogContent(rawContent = '') {
  const lines = String(rawContent)
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const records = [];
  for (const line of lines) {
    // Support tab-separated or comma/semicolon-separated lines
    const parts = line.split(/\t|,|;/).map((p) => p.trim()).filter((p) => p !== '');
    if (parts.length < 2) continue;

    const zkUserId = String(parts[0]).replace(/^0+/, '') || parts[0];
    const rawTime = parts[1];
    if (!/^\d+$/.test(zkUserId)) continue;
    if (!/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}(:\d{2})?$/.test(rawTime)) continue;

    const timestamp = rawTime.length === 16 ? `${rawTime}:00` : rawTime;
    const inOutState = Number(parts[3] ?? parts[2] ?? 0) || 0;
    const verifyMode = Number(parts[4] ?? 1) || 1;

    records.push({
      zkUserId,
      timestamp,
      inOutState,
      verifyMode,
      source: 'USB'
    });
  }
  return records;
}

/**
 * Formats employees into ZKTeco USB `.dat` / `.txt` format for USB backup/import
 */
function formatEmployeesToUsbDat(employees = []) {
  return employees
    .map((e) => `${e.zkUserId}\t${e.name}\t${e.department}\t${e.cardNumber || '0'}\t${e.privilege || 0}\t${e.active ? 1 : 0}`)
    .join('\r\n');
}

// La comunicación real con el reloj (red TCP/UDP) vive en ./zk-client.mjs

return { ZK_COMMANDS, computeZkChecksum, createZkHeader, encodeZkTime, decodeZkTime, parseUsbAttLogContent, formatEmployeesToUsbDat };
})();
const { generateMicrosipAttendanceText, generateMicrosipIncidentsText } = (function () {

// src/infrastructure/reports/microsip-generator.mjs
// Generador de archivos de importación para Microsip Nómina
// Compatible con el formato de "Importar archivos de asistencia" e "Importar incidencias"

function formatDate(isoDate, format = 'DD/MM/YYYY') {
  if (!isoDate || typeof isoDate !== 'string') return '';
  const parts = isoDate.split('-');
  if (parts.length !== 3) return isoDate;
  const [year, month, day] = parts;

  if (format === 'DD/MM/YYYY') {
    return `${day}/${month}/${year}`;
  }
  if (format === 'MM/DD/YYYY') {
    return `${month}/${day}/${year}`;
  }
  return isoDate; // YYYY-MM-DD
}

/**
 * Genera el archivo plano de asistencias (checadas de reloj) para Microsip Nómina.
 * Layout estándar:
 * ClaveEmpleado [delimitador] Fecha [delimitador] Hora [delimitador] Tipo (E/S)
 */
function generateMicrosipAttendanceText({
  report,
  delimiter = ',',
  dateFormat = 'DD/MM/YYYY',
  includeHeader = false
}) {
  const lines = [];
  if (includeHeader) {
    lines.push(['Clave', 'Fecha', 'Hora', 'Tipo'].join(delimiter));
  }

  const summaries = report.employeeSummaries || [];
  for (const emp of summaries) {
    const clave = String(emp.zkUserId || '').trim();
    if (!clave) continue;

    for (const d of emp.days || []) {
      const formattedDate = formatDate(d.date, dateFormat);

      if (d.checkIn) {
        lines.push([clave, formattedDate, d.checkIn, 'E'].join(delimiter));
      }
      if (d.checkOut && d.checkOut !== d.checkIn) {
        lines.push([clave, formattedDate, d.checkOut, 'S'].join(delimiter));
      }
    }
  }

  return lines.join('\r\n');
}

/**
 * Genera el archivo plano de incidencias pre-calculadas (Faltas, Retardos, Horas Extra, Vacaciones) para Microsip Nómina.
 * Layout estándar:
 * ClaveEmpleado [delimitador] Fecha [delimitador] TipoIncidencia [delimitador] Valor/Horas [delimitador] Concepto/Observación
 */
function generateMicrosipIncidentsText({
  report,
  delimiter = ',',
  dateFormat = 'DD/MM/YYYY',
  includeHeader = false
}) {
  const lines = [];
  if (includeHeader) {
    lines.push(['Clave', 'Fecha', 'Incidencia', 'Valor', 'Observaciones'].join(delimiter));
  }

  const summaries = report.employeeSummaries || [];
  for (const emp of summaries) {
    const clave = String(emp.zkUserId || '').trim();
    if (!clave) continue;

    for (const d of emp.days || []) {
      const formattedDate = formatDate(d.date, dateFormat);

      // 1. Faltas injustificadas
      if (d.status === 'FALTA') {
        lines.push([clave, formattedDate, 'FALTA', '1', 'Falta injustificada'].join(delimiter));
      }

      // 2. Retardos con minutos acumulados
      if (d.status === 'RETARDO' && d.lateMinutes > 0) {
        lines.push([clave, formattedDate, 'RETARDO', String(d.lateMinutes), `Retardo de ${d.lateMinutes} minutos`].join(delimiter));
      }

      // 3. Horas extras calculadas
      if (d.overtimeHours && d.overtimeHours > 0) {
        lines.push([clave, formattedDate, 'HEXTRA', String(d.overtimeHours), 'Horas extras autorizadas'].join(delimiter));
      }

      // 4. Vacaciones
      if (d.status === 'VACACIONES') {
        lines.push([clave, formattedDate, 'VACACIONES', '1', d.notes || 'Vacaciones'].join(delimiter));
      }

      // 5. Festivos trabajados / oficiales
      if (d.status === 'FESTIVO') {
        lines.push([clave, formattedDate, 'FESTIVO', '1', d.notes || 'Día Festivo'].join(delimiter));
      }
    }
  }

  return lines.join('\r\n');
}


return { generateMicrosipAttendanceText, generateMicrosipIncidentsText };
})();
const { generateStyledAttendanceExcel } = (function () {
const BRAND = __BRAND;
// src/infrastructure/reports/excel-generator.mjs






async function generateStyledAttendanceExcel({ report, company }) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = BRAND.productName;
  workbook.lastModifiedBy = company?.companyName || BRAND.productName;
  workbook.created = new Date();
  workbook.modified = new Date();

  const companyName = (company?.companyName || 'EMPRESA').toUpperCase();
  const branchName = (company?.branchName || '').toUpperCase();
  const startDate = report.range.startDate;
  const endDate = report.range.endDate;

  // Extraer las fechas únicas del periodo a partir de los resúmenes de empleados
  const sampleDays = report.employeeSummaries[0]?.days || [];
  const periodDates = sampleDays.map((d) => ({
    date: d.date,
    dayName: d.dayName,
    status: d.status,
    notes: d.notes
  }));

  // =========================================================================
  // HOJA 1: DETALLE DÍA POR DÍA (FORMATO MATRIZ TIPO PRESIDENCIA)
  // Cada empleado en un renglón; en las columnas salen todos los días del periodo
  // =========================================================================
  const sheetDaily = workbook.addWorksheet('Detalle Día por Día', {
    views: [{ showGridLines: true, state: 'frozen', xSplit: 3, ySplit: 2 }]
  });

  const totalCols = 3 + periodDates.length + 6; // ID, Nombre, Depto + fechas + Asist, Ret, Fal, Ext, Tot, LFT

  // Fila 1: Título institucional
  sheetDaily.getRow(1).height = 34;
  sheetDaily.mergeCells(1, 1, 1, totalCols);
  const title1 = sheetDaily.getCell(1, 1);
  title1.value = `AUDITORÍA DE ASISTENCIA Y CONTROL DE JORNADA - ${companyName} (${startDate} AL ${endDate})`;
  title1.font = { name: 'Arial', size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
  title1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } };
  title1.alignment = { vertical: 'middle', horizontal: 'center' };

  // Fila 2: Cabeceras
  sheetDaily.getRow(2).height = 32;

  const headerDefs = [
    { text: 'ID', width: 12, align: 'center' },
    { text: 'Nombre', width: 38, align: 'left' },
    { text: 'Departamento', width: 28, align: 'left' }
  ];

  // Columnas para cada día
  periodDates.forEach((d) => {
    let headerText = d.date;
    if (d.status === 'FESTIVO') {
      headerText += `\n(FESTIVO)`;
    } else if (d.status === 'DESCANSO') {
      headerText += `\n(DESCANSO)`;
    } else {
      headerText += `\n(${d.dayName})`;
    }
    headerDefs.push({ text: headerText, width: 24, align: 'center' });
  });

  // Columnas finales de totales
  headerDefs.push(
    { text: 'Asistencias', width: 14, align: 'center' },
    { text: 'Retardos', width: 12, align: 'center' },
    { text: 'Faltas', width: 12, align: 'center' },
    { text: 'Hrs Extra', width: 14, align: 'center' },
    { text: 'Horas Totales', width: 15, align: 'center' },
    { text: 'Estatus', width: 18, align: 'center' }
  );

  // Asignar anchos y valores a fila de cabecera
  headerDefs.forEach((def, colIdx) => {
    const colNum = colIdx + 1;
    sheetDaily.getColumn(colNum).width = def.width;
    const cell = sheetDaily.getCell(2, colNum);
    cell.value = def.text;
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFE0E0E0' } },
      bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } },
      left: { style: 'thin', color: { argb: 'FFE0E0E0' } },
      right: { style: 'thin', color: { argb: 'FFE0E0E0' } }
    };
  });

  // Filas de datos (un renglón por empleado)
  let currentDailyRow = 3;
  report.employeeSummaries.forEach((emp, empIdx) => {
    const row = sheetDaily.getRow(currentDailyRow);
    row.height = 30;
    const bgZebra = empIdx % 2 === 0 ? 'FFFFFFFF' : 'FFF8FAFC';

    // Celda 1: ID
    const cellId = row.getCell(1);
    cellId.value = emp.zkUserId;
    cellId.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF0F172A' } };
    cellId.alignment = { vertical: 'middle', horizontal: 'center' };

    // Celda 2: Nombre
    const cellName = row.getCell(2);
    cellName.value = emp.name;
    cellName.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF0F172A' } };
    cellName.alignment = { vertical: 'middle', horizontal: 'left' };

    // Celda 3: Departamento
    const cellDept = row.getCell(3);
    cellDept.value = emp.department;
    cellDept.font = { name: 'Arial', size: 9, color: { argb: 'FF334155' } };
    cellDept.alignment = { vertical: 'middle', horizontal: 'left' };

    // Celdas de cada día
    let colCursor = 4;
    emp.days.forEach((d) => {
      const cellDay = row.getCell(colCursor);
      cellDay.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };

      if (d.status === 'FESTIVO') {
        cellDay.value = d.notes ? `FESTIVO\n(${d.notes})` : 'FESTIVO';
        cellDay.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF276A3C' } };
        cellDay.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2EFDA' } };
      } else if (d.status === 'VACACIONES') {
        cellDay.value = 'VACACIONES';
        cellDay.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF0369A1' } };
        cellDay.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0F2FE' } };
      } else if (d.status === 'DESCANSO') {
        cellDay.value = 'DESCANSO';
        cellDay.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF276A3C' } };
        cellDay.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2EFDA' } };
      } else if (d.status === 'FALTA') {
        cellDay.value = 'FALTA';
        cellDay.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFDC2626' } };
        cellDay.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF2F2' } };
      } else if (d.status === 'RETARDO') {
        let punch = d.checkIn || '--:--';
        if (d.checkOut) punch += ` - ${d.checkOut}`;
        else punch += ` (S/SALIDA)`;
        cellDay.value = `RETARDO\n(${punch})`;
        cellDay.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFD97706' } };
        cellDay.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } };
      } else {
        // PUNTUAL / ASISTENCIA NORMAL
        let punch = d.checkIn || '--:--';
        if (d.checkOut) punch += ` - ${d.checkOut}`;
        else punch += ` (S/SALIDA)`;
        cellDay.value = punch;
        cellDay.font = { name: 'Arial', size: 9, color: { argb: 'FF0F172A' } };
        cellDay.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgZebra } };
      }

      colCursor++;
    });

    // Columnas de totales finales
    const cellPres = row.getCell(colCursor++);
    cellPres.value = emp.presentDays;
    cellPres.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF059669' } };
    cellPres.alignment = { vertical: 'middle', horizontal: 'center' };

    const cellLate = row.getCell(colCursor++);
    cellLate.value = emp.lateDays;
    cellLate.font = { name: 'Arial', size: 9.5, bold: emp.lateDays > 0, color: { argb: emp.lateDays > 0 ? 'FFD97706' : 'FF64748B' } };
    cellLate.alignment = { vertical: 'middle', horizontal: 'center' };
    if (emp.lateDays > 0) {
      cellLate.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFBEB' } };
    }

    const cellAbs = row.getCell(colCursor++);
    cellAbs.value = emp.absenceDays;
    cellAbs.font = { name: 'Arial', size: 9.5, bold: emp.absenceDays > 0, color: { argb: emp.absenceDays > 0 ? 'FFDC2626' : 'FF64748B' } };
    cellAbs.alignment = { vertical: 'middle', horizontal: 'center' };
    if (emp.absenceDays > 0) {
      cellAbs.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF2F2' } };
    }

    const cellOt = row.getCell(colCursor++);
    cellOt.value = emp.overtimeHours > 0 ? `${emp.overtimeHours} hrs` : '0 hrs';
    cellOt.font = { name: 'Arial', size: 9, color: { argb: emp.overtimeHours > 0 ? 'FFB45309' : 'FF64748B' } };
    cellOt.alignment = { vertical: 'middle', horizontal: 'center' };

    const cellTot = row.getCell(colCursor++);
    cellTot.value = `${emp.totalWorkedHours} hrs`;
    cellTot.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF0F172A' } };
    cellTot.alignment = { vertical: 'middle', horizontal: 'center' };

    const cellLft = row.getCell(colCursor++);
    const isExcess = emp.lftStatus?.startsWith('ALERTA');
    cellLft.value = isExcess ? 'Exceso Hrs Extra' : 'Normal';
    cellLft.font = { name: 'Arial', size: 9, bold: true, color: { argb: isExcess ? 'FFDC2626' : 'FF059669' } };
    cellLft.alignment = { vertical: 'middle', horizontal: 'center' };
    cellLft.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isExcess ? 'FFFEF2F2' : 'FFECFDF5' } };

    // Bordes para toda la fila
    for (let c = 1; c <= totalCols; c++) {
      const cCell = row.getCell(c);
      cCell.border = {
        top: { style: 'thin', color: { argb: 'FFE0E0E0' } },
        bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } },
        left: { style: 'thin', color: { argb: 'FFE0E0E0' } },
        right: { style: 'thin', color: { argb: 'FFE0E0E0' } }
      };
      if (!cCell.fill) {
        cCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgZebra } };
      }
    }

    currentDailyRow++;
  });

  // =========================================================================
  // HOJA 2: RESUMEN GENERAL (FORMATO PRESIDENCIA CON ESPECIFICACIÓN)
  // ID | Nombre | Departamento | Asistencias | Retardos | Faltas | Horas | Especificación
  // =========================================================================
  const sheetSummary = workbook.addWorksheet('Resumen General', {
    views: [{ showGridLines: true, state: 'frozen', ySplit: 2 }]
  });

  sheetSummary.columns = [
    { header: 'ID', key: 'zkUserId', width: 12 },
    { header: 'Nombre', key: 'name', width: 38 },
    { header: 'Dependencia / Departamento', key: 'department', width: 34 },
    { header: 'Asistencias', key: 'presentDays', width: 14 },
    { header: 'Retardos', key: 'lateDays', width: 12 },
    { header: 'Faltas', key: 'absenceDays', width: 12 },
    { header: 'Horas Totales', key: 'totalHours', width: 15 },
    { header: 'Especificación', key: 'specification', width: 70 }
  ];

  // Fila 1: Título institucional
  sheetSummary.getRow(1).height = 32;
  sheetSummary.mergeCells('A1:H1');
  const sumTitle = sheetSummary.getCell('A1');
  sumTitle.value = `RESUMEN GENERAL - ${companyName} (${startDate} AL ${endDate})`;
  sumTitle.font = { name: 'Arial', size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
  sumTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } };
  sumTitle.alignment = { vertical: 'middle', horizontal: 'center' };

  // Fila 2: Cabecera
  sheetSummary.getRow(2).height = 28;
  const sumHeaders = [
    'ID',
    'Nombre',
    'Dependencia / Departamento',
    'Asistencias',
    'Retardos',
    'Faltas',
    'Horas Totales',
    'Especificación'
  ];
  sumHeaders.forEach((text, colIdx) => {
    const hCell = sheetSummary.getRow(2).getCell(colIdx + 1);
    hCell.value = text;
    hCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    hCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
    hCell.alignment = { vertical: 'middle', horizontal: colIdx + 1 >= 4 && colIdx + 1 <= 7 ? 'center' : 'left' };
    hCell.border = {
      top: { style: 'thin', color: { argb: 'FFE0E0E0' } },
      bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } },
      left: { style: 'thin', color: { argb: 'FFE0E0E0' } },
      right: { style: 'thin', color: { argb: 'FFE0E0E0' } }
    };
  });

  // Filas de Resumen General
  let sumRowIdx = 3;
  report.employeeSummaries.forEach((emp, idx) => {
    const row = sheetSummary.getRow(sumRowIdx);
    row.height = 26;
    const bgZebra = idx % 2 === 0 ? 'FFFFFFFF' : 'FFF8FAFC';

    // Generar Especificación idéntica a Presidencia
    const faltasDates = emp.days.filter((d) => d.status === 'FALTA').map((d) => d.date);
    const retardosDates = emp.days
      .filter((d) => d.status === 'RETARDO')
      .map((d) => `${d.date}(${d.checkIn || '00:00'})`);

    const specParts = [];
    if (faltasDates.length > 0) {
      specParts.push(`FALTAS: ${faltasDates.join(', ')}`);
    }
    if (retardosDates.length > 0) {
      specParts.push(`RETARDOS: ${retardosDates.join(', ')}`);
    }
    const specification = specParts.join(' | ');

    row.getCell(1).value = emp.zkUserId;
    row.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell(1).font = { name: 'Arial', size: 9.5, bold: true };

    row.getCell(2).value = emp.name;
    row.getCell(2).alignment = { vertical: 'middle', horizontal: 'left' };
    row.getCell(2).font = { name: 'Arial', size: 9.5, bold: true };

    row.getCell(3).value = `${companyName} - ${emp.department}`;
    row.getCell(3).alignment = { vertical: 'middle', horizontal: 'left' };
    row.getCell(3).font = { name: 'Arial', size: 9 };

    row.getCell(4).value = emp.presentDays;
    row.getCell(4).alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell(4).font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF059669' } };

    row.getCell(5).value = emp.lateDays;
    row.getCell(5).alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell(5).font = { name: 'Arial', size: 9.5, bold: emp.lateDays > 0, color: { argb: emp.lateDays > 0 ? 'FFD97706' : 'FF64748B' } };

    row.getCell(6).value = emp.absenceDays;
    row.getCell(6).alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell(6).font = { name: 'Arial', size: 9.5, bold: emp.absenceDays > 0, color: { argb: emp.absenceDays > 0 ? 'FFDC2626' : 'FF64748B' } };

    row.getCell(7).value = `${emp.totalWorkedHours} hrs`;
    row.getCell(7).alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell(7).font = { name: 'Arial', size: 9.5, bold: true };

    row.getCell(8).value = specification;
    row.getCell(8).alignment = { vertical: 'middle', horizontal: 'left' };
    row.getCell(8).font = { name: 'Arial', size: 8.5, color: { argb: 'FF334155' } };

    for (let c = 1; c <= 8; c++) {
      const cCell = row.getCell(c);
      cCell.border = {
        top: { style: 'thin', color: { argb: 'FFE0E0E0' } },
        bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } },
        left: { style: 'thin', color: { argb: 'FFE0E0E0' } },
        right: { style: 'thin', color: { argb: 'FFE0E0E0' } }
      };
      cCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgZebra } };
    }

    sumRowIdx++;
  });

  // Cláusula legal STPS y firmas al final de la Hoja 2
  sumRowIdx += 2;
  sheetSummary.mergeCells(`A${sumRowIdx}:H${sumRowIdx}`);
  const legalCell = sheetSummary.getCell(`A${sumRowIdx}`);
  legalCell.value = 'CONTROL DE ASISTENCIA: Este documento contiene el resumen validado de jornada laboral, asistencias y tiempo extraordinario del sistema biométrico.';
  legalCell.font = { name: 'Arial', size: 8, italic: true, color: { argb: 'FF64748B' } };
  legalCell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };

  sumRowIdx += 3;
  sheetSummary.mergeCells(`B${sumRowIdx}:D${sumRowIdx}`);
  sheetSummary.mergeCells(`F${sumRowIdx}:H${sumRowIdx}`);
  const sigPatron = sheetSummary.getCell(`B${sumRowIdx}`);
  const sigTrab = sheetSummary.getCell(`F${sumRowIdx}`);
  sigPatron.value = '________________________________________\nREPRESENTANTE PATRONAL / RRHH';
  sigTrab.value = '________________________________________\nCONFORMIDAD DEL TRABAJADOR / COMISIÓN';
  sigPatron.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF334155' } };
  sigTrab.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF334155' } };
  sigPatron.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  sigTrab.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };

  // Retornar buffer Excel
  return workbook.xlsx.writeBuffer();
}

return { generateStyledAttendanceExcel };
})();
// scripts/demo-web/mock-server.js
// "Servidor" de la demostración web: responde a /api/v1/* dentro del navegador.
// Usa los mismos módulos del producto (contratos, motor de asistencia, Excel, Microsip, USB)
// que el build inserta antes de este archivo. Los datos son ficticios y se generan
// alrededor de la fecha de hoy, así la demo siempre se ve "viva".
//
// Disponibles desde el build: __BRAND, AppError, formatApiResponse, formatApiError,
// validateEmployeeInput, validateShiftInput, validateHolidayInput, validateLeaveInput,
// evaluateAttendanceReport, parseUsbAttLogContent, formatEmployeesToUsbDat,
// generateMicrosipAttendanceText, generateMicrosipIncidentsText, generateStyledAttendanceExcel

const STORE_KEY = 'aion_demo_state_v1';
const AUTH_KEY = 'app_auth_token'; // mismo que public/app.js
const DEMO_PASSWORD = 'demo';
const MAX_COMPANIES = 3;

// ---------------------------------------------------------------------------
// Utilidades de fecha (hora local del visitante)
// ---------------------------------------------------------------------------
const pad = (n) => String(n).padStart(2, '0');
const isoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const toMin = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
const minToHms = (min, sec = 0) => `${pad(Math.floor(min / 60))}:${pad(min % 60)}:${pad(sec)}`;
const nowStamp = () => { const d = new Date(); return `${isoDate(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`; };

function nthMonday(year, month, n) {
  const d = new Date(year, month, 1);
  while (d.getDay() !== 1) d.setDate(d.getDate() + 1);
  d.setDate(d.getDate() + 7 * (n - 1));
  return isoDate(d);
}

function officialHolidays(year) {
  return [
    [`${year}-01-01`, 'Año Nuevo'],
    [nthMonday(year, 1, 1), 'Día de la Constitución'],
    [nthMonday(year, 2, 3), 'Natalicio de Benito Juárez'],
    [`${year}-05-01`, 'Día del Trabajo'],
    [`${year}-09-16`, 'Día de la Independencia'],
    [nthMonday(year, 10, 3), 'Revolución Mexicana'],
    [`${year}-12-25`, 'Navidad']
  ].map(([date, name]) => ({ id: `hol-${date}`, date, name, isOfficial: true }));
}

// Generador pseudoaleatorio con semilla: la demo se ve igual cada vez que se abre
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const between = (r, lo, hi) => lo + Math.floor(r() * (hi - lo + 1));

// ---------------------------------------------------------------------------
// Datos de ejemplo
// ---------------------------------------------------------------------------
const SHIFTS = [
  { id: 'shift-default', name: 'Turno Operativo (08:00 - 18:00)', entryTime: '08:00', exitTime: '18:00', lateToleranceMinutes: 10, absenceThresholdMinutes: 120, workDays: [1, 2, 3, 4, 5, 6] },
  { id: 'shift-admin', name: 'Turno Administrativo (08:30 - 17:30)', entryTime: '08:30', exitTime: '17:30', lateToleranceMinutes: 10, absenceThresholdMinutes: 120, workDays: [1, 2, 3, 4, 5] }
];

// perfil: late = probabilidad de retardo, abs = de falta, extra = de quedarse tiempo extra
const COMPANIES = [
  {
    id: 'c-ferreteria', name: 'Ferretería Central', branchName: 'Matriz', rfc: 'FCE120315KD4', accentColor: '#111113',
    device: { deviceName: 'Checador Principal', ipAddress: '192.168.1.201', model: 'ZKTeco MB160', serialNumber: 'DEMO8255000001', location: 'Acceso Principal' },
    people: [
      ['101', 'Alejandro Villalobos', 'Administración', 'Gerente General', 'shift-admin', { late: 0.02, abs: 0, extra: 0.3 }, 14],
      ['102', 'Marco Antonio Lozoya', 'Taller', 'Técnico Especialista', 'shift-default', { late: 0.35, abs: 0.02, extra: 0.2 }],
      ['103', 'Valeria Quiñónez', 'Recursos Humanos', 'Coordinadora Administrativa', 'shift-admin', { late: 0.03, abs: 0, extra: 0.05 }],
      ['104', 'Héctor Manuel Duarte', 'Almacén', 'Encargado de Almacén', 'shift-default', { late: 0.08, abs: 0.02, extra: 0.75 }],
      ['105', 'Sergio Iván Corral', 'Ventas y Servicio', 'Ejecutivo de Servicio', 'shift-default', { late: 0.1, abs: 0.02, extra: 0.1 }],
      ['106', 'Marisol Rentería', 'Caja', 'Cajera', 'shift-default', { late: 0.05, abs: 0, extra: 0.05 }],
      ['107', 'Jesús Armendáriz', 'Taller', 'Mecánico', 'shift-default', { late: 0.12, abs: 0.1, extra: 0.2 }],
      ['108', 'Diana Chávez', 'Ventas y Servicio', 'Asesora de Ventas', 'shift-default', { late: 0.06, abs: 0.02, extra: 0.1 }],
      ['109', 'Ramón Holguín', 'Taller', 'Ayudante General', 'shift-default', { late: 0.25, abs: 0.04, extra: 0.15 }],
      ['110', 'Luis Fernando Prieto', 'Almacén', 'Montacarguista', 'shift-default', { late: 0.1, abs: 0.03, extra: 0.35 }],
      ['111', 'Karla Olivas', 'Administración', 'Auxiliar Contable', 'shift-admin', { late: 0.04, abs: 0, extra: 0.05 }],
      ['112', 'Rubén Domínguez', 'Almacén', 'Chofer Repartidor', 'shift-default', { late: 0.08, abs: 0.03, extra: 0.4 }]
    ],
    inactive: [['113', 'Patricia Meraz', 'Caja', 'Cajera', 'shift-default']],
    leaves: [
      ['105', 'VACACIONES', -9, -5, 'Periodo vacacional autorizado por Gerencia'],
      ['111', 'INCAPACIDAD', -16, -14, 'Incapacidad IMSS por enfermedad general'],
      ['107', 'PERMISO', -20, -20, 'Permiso con goce: trámite personal']
    ]
  },
  {
    id: 'c-refaccionaria', name: 'Refaccionaria del Norte', branchName: 'Sucursal Centro', rfc: 'RNO090812QT7', accentColor: '#0E7C66',
    device: { deviceName: 'Checador Mostrador', ipAddress: '192.168.10.50', model: 'ZKTeco K40', serialNumber: 'BJ2D19330112', location: 'Mostrador' },
    people: [
      ['201', 'Gabriela Ochoa', 'Mostrador', 'Encargada de Sucursal', 'shift-default', { late: 0.04, abs: 0, extra: 0.3 }],
      ['202', 'Francisco Javier Loya', 'Mostrador', 'Vendedor', 'shift-default', { late: 0.2, abs: 0.03, extra: 0.1 }],
      ['203', 'Adriana Baeza', 'Administración', 'Auxiliar Administrativa', 'shift-admin', { late: 0.05, abs: 0.02, extra: 0.05 }],
      ['204', 'Óscar Gutiérrez', 'Almacén', 'Almacenista', 'shift-default', { late: 0.1, abs: 0.05, extra: 0.3 }],
      ['205', 'Iván Sotelo', 'Reparto', 'Repartidor', 'shift-default', { late: 0.15, abs: 0.04, extra: 0.25 }]
    ],
    inactive: [],
    leaves: [['203', 'VACACIONES', -4, -2, 'Vacaciones de fin de año adelantadas']]
  }
];

function buildTenant(def, seed) {
  const r = rng(seed);
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const year = today.getFullYear();
  const holidays = [...officialHolidays(year - 1), ...officialHolidays(year)];
  const holidaySet = new Set(holidays.map((h) => h.date));
  const shiftMap = new Map(SHIFTS.map((s) => [s.id, s]));

  const employees = def.people.map(([pin, name, department, position, shiftId, , privilege]) => ({
    id: `emp-${pin}`, zkUserId: pin, name, department, position, shiftId,
    cardNumber: `00${pin}${between(r, 100, 999)}`, privilege: privilege || 0, active: true,
    hireDate: isoDate(addDays(today, -between(r, 200, 2400)))
  }));
  for (const [pin, name, department, position, shiftId] of def.inactive) {
    employees.push({ id: `emp-${pin}`, zkUserId: pin, name, department, position, shiftId, cardNumber: '', privilege: 0, active: false, hireDate: isoDate(addDays(today, -900)) });
  }

  const leaves = def.leaves.map(([pin, type, from, to, notes], i) => ({
    id: `leave-demo-${def.id}-${i}`, employeeId: `emp-${pin}`, type,
    startDate: isoDate(addDays(today, from)), endDate: isoDate(addDays(today, to)), notes
  }));
  const onLeave = (pin, date) => leaves.some((l) => l.employeeId === `emp-${pin}` && date >= l.startDate && date <= l.endDate);

  const logs = [];
  const pending = []; // checadas de hoy que "todavía no ocurren": llegan al descargar del reloj
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();

  for (let back = 42; back >= 0; back--) {
    const day = addDays(today, -back);
    const date = isoDate(day);
    const dow = day.getDay();
    if (holidaySet.has(date)) continue;
    for (const [pin, , , , shiftId, prof] of def.people) {
      const shift = shiftMap.get(shiftId);
      const works = shift.workDays.includes(dow);
      if (!works) continue;
      if (onLeave(pin, date)) continue;
      if (r() < prof.abs) continue;
      const entry = toMin(shift.entryTime);
      const exit = dow === 6 ? toMin('14:00') : toMin(shift.exitTime);
      const inMin = r() < prof.late ? entry + between(r, 11, 38) : entry - between(r, 0, 16) + between(r, 0, 6);
      const outMin = r() < prof.extra ? exit + between(r, 55, 170) : exit + between(r, 0, 22);
      const punches = [[inMin, 0], [outMin, 1]];
      for (const [m, state] of punches) {
        const rec = { zkUserId: pin, timestamp: `${date} ${minToHms(m, between(r, 0, 59))}`, verifyMode: between(r, 0, 9) < 8 ? 1 : 15, inOutState: state, source: 'NETWORK' };
        if (back === 0 && m > nowMin - 20) pending.push(rec); // lo más reciente de hoy, al descargar
        else if (back > 0 || m <= nowMin) logs.push(rec);
      }
    }
  }
  // De hoy, una parte ya se descargó del reloj y otra queda pendiente para la demostración
  for (const rec of logs.filter((l) => l.timestamp.startsWith(isoDate(today))).slice(-3)) {
    logs.splice(logs.indexOf(rec), 1);
    pending.push(rec);
  }
  for (const l of logs) l.id = logId(l);

  const nowIso = new Date().toISOString();
  return {
    company: {
      id: def.id, name: def.name, branchName: def.branchName, rfc: def.rfc, logoUrl: '', accentColor: def.accentColor,
      weeklyMaxHours: 46, mealBreakMinutes: 60, active: true, createdAt: nowIso, updatedAt: nowIso
    },
    employees,
    shifts: SHIFTS.map((s) => ({ ...s, workDays: [...s.workDays] })),
    holidays,
    leaves,
    devices: [{ id: 'zk-primary', ...def.device, port: 4370, commKey: 0, connectionMode: 'HYBRID', updatedAt: nowIso }],
    logs,
    pending
  };
}

const logId = (l) => `att-${l.zkUserId}-${l.timestamp.replace(/\D/g, '')}`;

function freshState() {
  const tenants = {};
  COMPANIES.forEach((def, i) => { tenants[def.id] = buildTenant(def, 20261123 + i * 7919); });
  const created = new Date().toISOString();
  return {
    version: 1,
    generatedOn: isoDate(new Date()),
    tenants,
    companyOrder: COMPANIES.map((c) => c.id),
    users: [
      { id: 'u-admin', username: 'admin', fullName: 'Administrador General', globalRole: 'SUPERADMIN', active: true, createdAt: created, access: [{ companyId: 'c-ferreteria', role: 'ADMIN' }] },
      { id: 'u-rh', username: 'rh.lopez', fullName: 'Laura López (Recursos Humanos)', globalRole: 'USER', active: true, createdAt: created, access: [{ companyId: 'c-ferreteria', role: 'OPERATOR' }] },
      { id: 'u-contador', username: 'contador', fullName: 'Despacho Contable Hernández', globalRole: 'USER', active: true, createdAt: created, access: [{ companyId: 'c-ferreteria', role: 'VIEWER' }, { companyId: 'c-refaccionaria', role: 'VIEWER' }] }
    ],
    sessions: {},
    backups: [1, 2, 3, 4, 5].map((n) => {
      const d = addDays(new Date(), -n);
      return { name: `respaldo-${isoDate(d).replace(/-/g, '')}-090000.sqlite`, sizeBytes: 180224 + n * 4096, createdAt: new Date(d.setHours(9, 0, 0, 0)).toISOString(), automatic: true };
    })
  };
}

// ---------------------------------------------------------------------------
// Estado de la sesión del visitante (se reinicia al cerrar la pestaña)
// ---------------------------------------------------------------------------
let DB;
function load() {
  try {
    const raw = sessionStorage.getItem(STORE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.version === 1 && parsed.generatedOn === isoDate(new Date())) return parsed;
    }
  } catch {}
  return freshState();
}
function save() {
  try { sessionStorage.setItem(STORE_KEY, JSON.stringify(DB)); } catch {}
}
DB = load();

// Entrar directo como Superadministrador la primera vez (el botón "Salir" lleva al inicio de sesión)
try {
  if (!sessionStorage.getItem('aion_demo_started')) {
    sessionStorage.setItem('aion_demo_started', '1');
    DB.sessions['demo-admin'] = 'u-admin';
    sessionStorage.setItem(AUTH_KEY, 'demo-admin');
    save();
  }
} catch {}

window.AionDemo = {
  reset() {
    try {
      sessionStorage.removeItem(STORE_KEY);
      sessionStorage.removeItem('aion_demo_started');
      sessionStorage.removeItem(AUTH_KEY);
      sessionStorage.removeItem('app_current_tenant');
    } catch {}
    location.reload();
  }
};

// ---------------------------------------------------------------------------
// Lógica de la API (equivalente a src/server.mjs + app-service.mjs)
// ---------------------------------------------------------------------------
const ROLE_RANK = { VIEWER: 1, OPERATOR: 2, ADMIN: 3 };
const summarizeUser = (u) => ({ id: u.id, username: u.username, fullName: u.fullName, globalRole: u.globalRole, isSuperAdmin: u.globalRole === 'SUPERADMIN', active: u.active });
const publicBrand = () => ({ ..._BRAND_PUBLIC });
const _BRAND_PUBLIC = (() => { const { productName, productTagline, vendorName, accentColor } = __BRAND; return { productName, productTagline, vendorName, accentColor, logoUrl: 'assets/brand-logo.svg' }; })();

function userFromToken(token) {
  const id = token && DB.sessions[token];
  const u = id && DB.users.find((x) => x.id === id);
  return u && u.active ? u : null;
}

function companiesOrdered() {
  return DB.companyOrder.map((id) => DB.tenants[id].company);
}

function licensedIds() {
  return new Set(companiesOrdered().filter((c) => c.active).slice(0, MAX_COMPANIES).map((c) => c.id));
}

function licenseStatus() {
  const issued = addDays(new Date(), -40);
  const expires = addDays(issued, 365);
  const activeCompanies = companiesOrdered().filter((c) => c.active).length;
  return {
    machineCode: 'DEMO-7F3A-91C2', customer: 'Demostración Aion', plan: 'ANUAL', maxCompanies: MAX_COMPANIES,
    planLabel: `Anual · hasta ${MAX_COMPANIES} empresas`, issuedAt: isoDate(issued), expiresAt: isoDate(expires),
    daysLeft: Math.round((expires - new Date()) / 86400000), state: 'ACTIVE', readOnly: false,
    activeCompanies, overLimit: activeCompanies > MAX_COMPANIES
  };
}

function listCompaniesForUser(user) {
  const lic = licensedIds();
  const summary = (c, role) => ({
    licensed: !c.active || lic.has(c.id), id: c.id, name: c.name, branchName: c.branchName, rfc: c.rfc, logoUrl: c.logoUrl,
    accentColor: c.accentColor, weeklyMaxHours: c.weeklyMaxHours, mealBreakMinutes: c.mealBreakMinutes, active: c.active, role,
    activeEmployees: DB.tenants[c.id].employees.filter((e) => e.active).length
  });
  if (user.globalRole === 'SUPERADMIN') return companiesOrdered().map((c) => summary(c, 'ADMIN'));
  return user.access
    .map((a) => ({ c: DB.tenants[a.companyId]?.company, role: a.role }))
    .filter((x) => x.c && x.c.active)
    .map((x) => summary(x.c, x.role))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));
}

function requireSuperAdmin(user) {
  if (user.globalRole !== 'SUPERADMIN') throw new AppError('FORBIDDEN', 'Sólo el Superadministrador puede realizar esta acción.', {}, 403);
}

function requiredRoleFor(method, pathname) {
  if (method === 'GET') return 'VIEWER';
  if (pathname === '/api/v1/company' || pathname.startsWith('/api/v1/shifts') || pathname.startsWith('/api/v1/devices') || pathname.startsWith('/api/v1/device/')) return 'ADMIN';
  return 'OPERATOR';
}

function authorize(user, tenantId, minRole) {
  const c = DB.tenants[tenantId]?.company;
  if (!c) throw new AppError('NO_COMPANY_ACCESS', 'La empresa no existe o no tiene acceso a ella.', {}, 403);
  let role = null;
  if (user.globalRole === 'SUPERADMIN') role = 'ADMIN';
  else {
    const a = user.access.find((x) => x.companyId === tenantId);
    if (a && c.active) role = a.role;
  }
  if (!role) throw new AppError('NO_COMPANY_ACCESS', 'No tiene acceso a esta empresa.', {}, 403);
  if ((ROLE_RANK[role] || 0) < (ROLE_RANK[minRole] || 99)) {
    const what = minRole === 'ADMIN' ? 'Administrador' : 'Capturista';
    throw new AppError('FORBIDDEN', `Su rol en esta empresa no permite esta acción (se requiere ${what}).`, {}, 403);
  }
  return role;
}

function sanitizeCompanyFields(payload = {}, current = {}) {
  const pick = (k, fallback) => (payload[k] !== undefined ? payload[k] : fallback);
  const name = String(pick('name', pick('companyName', current.name ?? ''))).trim();
  if (!name) throw new AppError('INVALID_COMPANY', 'El nombre de la empresa es obligatorio.', { field: 'name' });
  const rfc = String(pick('rfc', current.rfc ?? '')).trim().toUpperCase();
  if (rfc && !/^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/.test(rfc)) throw new AppError('INVALID_COMPANY', 'El RFC no tiene un formato válido (12 o 13 caracteres).', { field: 'rfc' });
  const accentColor = String(pick('accentColor', current.accentColor ?? '')).trim();
  if (accentColor && !/^#[0-9a-fA-F]{6}$/.test(accentColor)) throw new AppError('INVALID_COMPANY', 'El color debe tener formato #RRGGBB.', { field: 'accentColor' });
  const logoUrl = String(pick('logoUrl', current.logoUrl ?? '')).trim();
  if (logoUrl.length > 700000) throw new AppError('INVALID_COMPANY', 'El logotipo es demasiado grande (máximo 500 KB).', { field: 'logoUrl' });
  const weeklyMaxHours = Number(pick('weeklyMaxHours', current.weeklyMaxHours ?? 46));
  if (![40, 42, 44, 46, 48].includes(weeklyMaxHours)) throw new AppError('INVALID_COMPANY', 'La jornada semanal debe ser 40, 42, 44, 46 o 48 horas.', { field: 'weeklyMaxHours' });
  const mealBreakMinutes = Number(pick('mealBreakMinutes', current.mealBreakMinutes ?? 60));
  if (!Number.isFinite(mealBreakMinutes) || mealBreakMinutes < 0 || mealBreakMinutes > 120) throw new AppError('INVALID_COMPANY', 'El tiempo de comida debe estar entre 0 y 120 minutos.', { field: 'mealBreakMinutes' });
  return { name, rfc, branchName: String(pick('branchName', current.branchName ?? '')).trim().slice(0, 120), accentColor, logoUrl, weeklyMaxHours, mealBreakMinutes };
}

const companySettings = (c) => ({ id: c.id, companyName: c.name, branchName: c.branchName, rfc: c.rfc, logoUrl: c.logoUrl, accentColor: c.accentColor, weeklyMaxHours: c.weeklyMaxHours, mealBreakMinutes: c.mealBreakMinutes, updatedAt: c.updatedAt });

function insertLog(t, rec) {
  const id = logId(rec);
  if (t.logs.some((l) => l.id === id)) return { inserted: false };
  t.logs.push({ id, ...rec });
  return { inserted: true };
}

function recentLogs(t, limit) {
  const byPin = new Map(t.employees.map((e) => [String(e.zkUserId), e]));
  return t.logs
    .slice()
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, limit)
    .map((l) => ({ ...l, employeeName: byPin.get(String(l.zkUserId))?.name || `PIN #${l.zkUserId} (No registrado)`, department: byPin.get(String(l.zkUserId))?.department || 'Sin asignar' }));
}

function report(t, q) {
  const startDate = q.get('startDate');
  const endDate = q.get('endDate');
  if (!startDate || !endDate || startDate > endDate) throw new AppError('INVALID_DATE_RANGE', 'Seleccione un rango de fechas válido (Fecha Inicio <= Fecha Fin).');
  const department = q.get('department') || '';
  const employeeId = q.get('employeeId') || '';
  const employees = t.employees.filter((e) => e.active && (!department || e.department === department) && (!employeeId || e.id === employeeId));
  return evaluateAttendanceReport({
    startDate, endDate, employees,
    shifts: t.shifts,
    holidays: t.holidays.filter((h) => h.date >= startDate && h.date <= endDate),
    leaves: t.leaves,
    logs: t.logs.filter((l) => l.timestamp >= `${startDate} 00:00:00` && l.timestamp <= `${endDate} 23:59:59`),
    customToleranceMinutes: q.get('tolerance'),
    lftRegimeYear: q.get('lftRegimeYear') || 2027,
    mealBreakMinutes: q.get('mealBreakMinutes') ?? 60
  });
}

function deviceInfo(t, dev) {
  const tenantUsers = t.employees.filter((e) => e.active).length + 1;
  return {
    reachable: true, protocol: 'TCP',
    info: { deviceName: dev.model, serialNumber: dev.serialNumber, protocol: 'TCP', users: tenantUsers, records: t.logs.length + t.pending.length },
    message: `Conectado a ${dev.model} (serie ${dev.serialNumber}) por TCP. En el reloj: ${tenantUsers} usuario(s) y ${t.logs.length + t.pending.length} checada(s).`
  };
}

const fileResponse = (body, type, name) => ({ __file: true, body, type, name });

async function handle(method, url, headers, body) {
  const pathname = url.pathname.replace(/^.*?(\/api\/v1\/)/, '/api/v1/');
  const token = (headers.get('authorization') || '').replace(/^Bearer\s+/, '');
  const headerTenant = headers.get('x-tenant-id');

  // ---- públicas ----
  if (method === 'GET' && pathname === '/api/v1/auth/status') {
    const u = userFromToken(token);
    return { initialized: true, authenticated: Boolean(u), user: u ? summarizeUser(u) : null, companies: u ? listCompaniesForUser(u) : [], license: u ? licenseStatus() : null, brand: publicBrand() };
  }
  if (method === 'POST' && pathname === '/api/v1/auth/setup') throw new AppError('ALREADY_INITIALIZED', 'El sistema ya se encuentra configurado con un administrador.');
  if (method === 'POST' && pathname === '/api/v1/auth/login') {
    const u = DB.users.find((x) => x.username === String(body.username || '').trim().toLowerCase());
    if (!u || String(body.password || '').trim() !== DEMO_PASSWORD) throw new AppError('CREDENCIALES_INVALIDAS', 'Usuario o contraseña incorrectos. En la demostración la contraseña es "demo".', {}, 401);
    if (!u.active) throw new AppError('USUARIO_INACTIVO', 'Este usuario está desactivado. Consulte al administrador.', {}, 401);
    const t = `demo-${Math.random().toString(36).slice(2)}`;
    DB.sessions[t] = u.id;
    return { token: t, user: summarizeUser(u), companies: listCompaniesForUser(u) };
  }
  if (method === 'POST' && pathname === '/api/v1/auth/logout') {
    delete DB.sessions[token];
    return { success: true };
  }
  if (method === 'GET' && pathname === '/api/v1/bootstrap' && !userFromToken(token)) {
    return { auth: { initialized: true, authenticated: false, user: null }, company: null, brand: publicBrand() };
  }

  // ---- con sesión ----
  const user = userFromToken(token);
  if (!user) throw new AppError('UNAUTHORIZED', 'Debe iniciar sesión.', {}, 401);
  const license = licenseStatus();

  if (method === 'GET' && pathname === '/api/v1/license') return license;
  if (method === 'POST' && pathname === '/api/v1/license') throw new AppError('LICENSE_DEMO', 'En la demostración la licencia ya está activa. En su equipo se activa pegando la clave que le enviamos, sin internet.');

  if (pathname === '/api/v1/backups' || pathname.startsWith('/api/v1/backups/')) {
    requireSuperAdmin(user);
    if (method === 'GET' && pathname === '/api/v1/backups') return { enabled: true, backups: DB.backups, pendingRestore: null };
    if (method === 'POST' && pathname === '/api/v1/backups') {
      const d = new Date();
      const b = { name: `respaldo-${isoDate(d).replace(/-/g, '')}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}-manual.sqlite`, sizeBytes: 196608, createdAt: d.toISOString(), automatic: false };
      DB.backups.push(b);
      return b;
    }
    if (/\/download$/.test(pathname)) throw new AppError('DEMO_ONLY', 'En la demostración los respaldos no se descargan. En su equipo se guarda una copia diaria en la carpeta de Aion.', {}, 400);
    if (/\/restore$/.test(pathname)) throw new AppError('DEMO_ONLY', 'En la demostración no se restauran respaldos. En su equipo el respaldo elegido se aplica al reiniciar Aion.', {}, 400);
    throw new AppError('NOT_FOUND', `Ruta no encontrada: ${pathname}`, {}, 404);
  }

  if (method === 'POST' && pathname === '/api/v1/auth/change-password') {
    throw new AppError('DEMO_ONLY', 'En la demostración no se cambian contraseñas (todas son "demo").');
  }
  if (method === 'GET' && pathname === '/api/v1/companies') return listCompaniesForUser(user);
  if (method === 'POST' && pathname === '/api/v1/companies') {
    requireSuperAdmin(user);
    if (body.id) {
      const t = DB.tenants[body.id];
      if (!t) throw new AppError('COMPANY_NOT_FOUND', 'La empresa no existe.', {}, 404);
      Object.assign(t.company, sanitizeCompanyFields(body, t.company), { updatedAt: new Date().toISOString() });
      return t.company;
    }
    if (license.activeCompanies >= MAX_COMPANIES) throw new AppError('LICENSE_LIMIT', `Su licencia permite hasta ${MAX_COMPANIES} empresas activas. Desactive una o amplíe su plan.`, {}, 403);
    const fields = sanitizeCompanyFields(body);
    const id = `c-${Math.random().toString(16).slice(2, 12)}`;
    const nowIso = new Date().toISOString();
    DB.tenants[id] = {
      company: { id, ...fields, active: true, createdAt: nowIso, updatedAt: nowIso },
      employees: [], shifts: SHIFTS.map((s) => ({ ...s, workDays: [...s.workDays] })),
      holidays: [...officialHolidays(new Date().getFullYear())], leaves: [],
      devices: [{ id: 'zk-primary', deviceName: 'Checador Principal', ipAddress: String(body.deviceIp || '192.168.1.201'), port: 4370, commKey: 0, location: 'Acceso Principal', model: 'ZKTeco MB360 / iClock', serialNumber: '', connectionMode: 'HYBRID', updatedAt: nowIso }],
      logs: [], pending: []
    };
    DB.companyOrder.push(id);
    return DB.tenants[id].company;
  }
  const companyStatus = pathname.match(/^\/api\/v1\/companies\/([^/]+)\/status$/);
  if (method === 'PATCH' && companyStatus) {
    requireSuperAdmin(user);
    const t = DB.tenants[decodeURIComponent(companyStatus[1])];
    if (!t) throw new AppError('COMPANY_NOT_FOUND', 'La empresa no existe.', {}, 404);
    if (body.active && !t.company.active && license.activeCompanies >= MAX_COMPANIES) throw new AppError('LICENSE_LIMIT', `Su licencia permite hasta ${MAX_COMPANIES} empresas activas.`, {}, 403);
    t.company.active = Boolean(body.active);
    return t.company;
  }
  if (method === 'GET' && pathname === '/api/v1/users') {
    requireSuperAdmin(user);
    return DB.users.map((u) => ({ ...summarizeUser(u), createdAt: u.createdAt, access: u.access.map((a) => ({ ...a })) }));
  }
  if (method === 'POST' && pathname === '/api/v1/users') {
    requireSuperAdmin(user);
    const existing = body.id ? DB.users.find((u) => u.id === body.id) : null;
    if (body.id && !existing) throw new AppError('USER_NOT_FOUND', 'El usuario no existe.', {}, 404);
    const username = existing ? existing.username : String(body.username || '').trim().toLowerCase();
    if (!existing) {
      if (!/^[a-z0-9._-]{3,40}$/.test(username)) throw new AppError('INVALID_USER', 'El usuario debe tener de 3 a 40 caracteres (letras, números, punto, guion).', { field: 'username' });
      if (DB.users.some((u) => u.username === username)) throw new AppError('USERNAME_TAKEN', 'Ese nombre de usuario ya existe.', { field: 'username' });
    }
    const fullName = String(body.fullName ?? existing?.fullName ?? '').trim();
    if (!fullName) throw new AppError('INVALID_USER', 'El nombre completo es obligatorio.', { field: 'fullName' });
    const globalRole = body.globalRole === 'SUPERADMIN' ? 'SUPERADMIN' : 'USER';
    const active = body.active === undefined ? existing?.active ?? true : Boolean(body.active);
    if (existing && existing.globalRole === 'SUPERADMIN' && (globalRole !== 'SUPERADMIN' || !active) && !DB.users.some((u) => u.id !== existing.id && u.globalRole === 'SUPERADMIN' && u.active)) {
      throw new AppError('LAST_SUPERADMIN', 'Debe existir al menos un Superadministrador activo.', {}, 400);
    }
    const access = Array.isArray(body.access) ? body.access.map((a) => ({ companyId: a.companyId, role: a.role })) : existing?.access || [];
    if (globalRole !== 'SUPERADMIN' && access.length === 0) throw new AppError('INVALID_USER', 'Asigne al menos una empresa al usuario.', { field: 'access' });
    if (!existing && String(body.password || '').trim().length < 4) throw new AppError('INVALID_USER', 'La contraseña debe tener al menos 4 caracteres.', { field: 'password' });
    const saved = existing || { id: `u-${Math.random().toString(16).slice(2, 12)}`, createdAt: new Date().toISOString() };
    Object.assign(saved, { username, fullName, globalRole, active, access });
    if (!existing) DB.users.push(saved);
    return { ...summarizeUser(saved), access: saved.access };
  }

  // ---- empresa activa ----
  const tenantId = headerTenant || listCompaniesForUser(user).filter((c) => c.active)[0]?.id;
  if (!tenantId) throw new AppError('NO_COMPANY_ACCESS', 'Su usuario no tiene empresas asignadas.', {}, 403);
  const role = authorize(user, tenantId, requiredRoleFor(method, pathname));
  const t = DB.tenants[tenantId];
  if (method !== 'GET' && !licensedIds().has(tenantId)) throw new AppError('LICENSE_LIMIT', 'Esta empresa excede las empresas cubiertas por la licencia: sólo lectura.', {}, 403);

  if (method === 'GET' && pathname === '/api/v1/bootstrap') {
    const company = companySettings(t.company);
    return {
      tenantId, auth: { initialized: true, authenticated: true, user: summarizeUser(user), role },
      companies: listCompaniesForUser(user), license, company,
      branchName: `${company.companyName} — ${company.branchName}`, brand: publicBrand(),
      employees: t.employees, shifts: t.shifts, holidays: t.holidays,
      leaves: t.leaves.map((l) => { const e = t.employees.find((x) => x.id === l.employeeId); return { ...l, employeeName: e?.name || l.employeeId, zkUserId: e?.zkUserId || '' }; }),
      devices: t.devices, device: t.devices[0] || null, recentLogs: recentLogs(t, 120)
    };
  }
  if (method === 'GET' && pathname === '/api/v1/company') return companySettings(t.company);
  if (method === 'POST' && pathname === '/api/v1/company') {
    Object.assign(t.company, sanitizeCompanyFields(body, t.company), { updatedAt: new Date().toISOString() });
    return companySettings(t.company);
  }
  if (method === 'GET' && pathname === '/api/v1/employees') {
    const includeInactive = url.searchParams.get('includeInactive') !== 'false';
    const department = url.searchParams.get('department') || '';
    const search = (url.searchParams.get('search') || '').toLowerCase();
    return t.employees.filter((e) => (includeInactive || e.active) && (!department || e.department === department) &&
      (!search || [e.name, e.zkUserId, e.department, e.position].some((v) => String(v).toLowerCase().includes(search))));
  }
  if (method === 'POST' && pathname === '/api/v1/employees') {
    const emp = validateEmployeeInput(body);
    const i = t.employees.findIndex((e) => e.id === emp.id);
    if (i >= 0) t.employees[i] = emp; else t.employees.push(emp);
    const deviceSync = body.syncWithDevice ? { synced: true, created: i < 0, message: `Empleado #${emp.zkUserId} ${i < 0 ? 'dado de alta' : 'actualizado'} en el reloj.` } : null;
    return { employee: emp, deviceSync };
  }
  const statusMatch = pathname.match(/^\/api\/v1\/employees\/([^/]+)\/status$/);
  if (method === 'PATCH' && statusMatch) {
    const emp = t.employees.find((e) => e.id === decodeURIComponent(statusMatch[1]));
    if (!emp) throw new AppError('NOT_FOUND', 'Empleado no encontrado en el padrón.', {}, 404);
    emp.active = Boolean(body.active);
    return emp;
  }
  if (method === 'POST' && pathname === '/api/v1/employees/push-device') {
    const total = t.employees.filter((e) => e.active).length;
    return { total, created: 0, updated: total, errors: [] };
  }
  if (method === 'GET' && pathname === '/api/v1/employees/export-usb') {
    return fileResponse(formatEmployeesToUsbDat(t.employees), 'text/plain; charset=utf-8', 'empleados_user.dat');
  }
  const delEmp = pathname.match(/^\/api\/v1\/employees\/([^/]+)$/);
  if (method === 'DELETE' && delEmp) {
    const id = decodeURIComponent(delEmp[1]);
    const emp = t.employees.find((e) => e.id === id);
    if (!emp) throw new AppError('NOT_FOUND', 'Empleado no encontrado.', {}, 404);
    t.employees = t.employees.filter((e) => e.id !== id);
    const out = { deletedId: id, employee: emp };
    if (url.searchParams.get('fromDevice') === '1') out.deviceSync = { synced: true, message: `Empleado #${emp.zkUserId} borrado del reloj.` };
    return out;
  }
  if (method === 'POST' && pathname === '/api/v1/shifts') {
    const s = validateShiftInput(body);
    const i = t.shifts.findIndex((x) => x.id === s.id);
    if (i >= 0) t.shifts[i] = s; else t.shifts.push(s);
    return s;
  }
  const delShift = pathname.match(/^\/api\/v1\/shifts\/([^/]+)$/);
  if (method === 'DELETE' && delShift) { const id = decodeURIComponent(delShift[1]); t.shifts = t.shifts.filter((s) => s.id !== id); return { deletedId: id }; }
  if (method === 'POST' && pathname === '/api/v1/holidays') {
    const h = validateHolidayInput(body);
    t.holidays = t.holidays.filter((x) => x.id !== h.id).concat(h).sort((a, b) => a.date.localeCompare(b.date));
    return h;
  }
  const delHol = pathname.match(/^\/api\/v1\/holidays\/([^/]+)$/);
  if (method === 'DELETE' && delHol) { const id = decodeURIComponent(delHol[1]); t.holidays = t.holidays.filter((h) => h.id !== id); return { deletedId: id }; }
  if (method === 'POST' && pathname === '/api/v1/leaves') {
    const l = validateLeaveInput(body);
    t.leaves = t.leaves.filter((x) => x.id !== l.id).concat(l);
    return l;
  }
  const delLeave = pathname.match(/^\/api\/v1\/leaves\/([^/]+)$/);
  if (method === 'DELETE' && delLeave) { const id = decodeURIComponent(delLeave[1]); t.leaves = t.leaves.filter((l) => l.id !== id); return { deletedId: id }; }
  if (method === 'GET' && pathname === '/api/v1/devices') return t.devices;
  if (method === 'POST' && (pathname === '/api/v1/devices' || pathname === '/api/v1/device/settings')) {
    const dev = { ...body, id: body.id || `zk-${Date.now()}`, port: Number(body.port) || 4370, commKey: Number(body.commKey) || 0, updatedAt: new Date().toISOString() };
    const i = t.devices.findIndex((d) => d.id === dev.id);
    if (i >= 0) t.devices[i] = { ...t.devices[i], ...dev }; else t.devices.push(dev);
    return dev;
  }
  const delDev = pathname.match(/^\/api\/v1\/devices\/([^/]+)$/);
  if (method === 'DELETE' && delDev) { const id = decodeURIComponent(delDev[1]); t.devices = t.devices.filter((d) => d.id !== id); return { deletedId: id }; }
  if (method === 'POST' && pathname === '/api/v1/device/test') {
    const dev = t.devices.find((d) => d.ipAddress === body.ipAddress) || t.devices[0];
    if (!dev) return { reachable: false, code: 'NO_DEVICE', message: 'No hay un reloj checador configurado.' };
    if (!dev.serialNumber) return { reachable: false, code: 'OFFLINE', message: `No se pudo conectar al reloj ${body.ipAddress || dev.ipAddress}:${body.port || dev.port}. En la demostración sólo responde el checador de ejemplo.` };
    return deviceInfo(t, dev);
  }
  if (method === 'POST' && pathname === '/api/v1/attendance/download-device') {
    const dev = t.devices.find((d) => d.id === body.deviceId) || t.devices[0];
    if (!dev) throw new AppError('NO_DEVICE', 'No hay un reloj checador configurado. Agréguelo en Opciones de Checador.');
    const stamp = nowStamp();
    const due = t.pending.filter((p) => p.timestamp <= stamp);
    t.pending = t.pending.filter((p) => p.timestamp > stamp);
    let importedCount = 0;
    for (const rec of due) if (insertLog(t, rec).inserted) importedCount++;
    const totalParsed = t.logs.length;
    return { totalParsed, importedCount, duplicateCount: totalParsed - importedCount, unknownPins: [], device: dev.deviceName || dev.ipAddress };
  }
  if (method === 'POST' && pathname === '/api/v1/attendance/import-usb') {
    const records = parseUsbAttLogContent(body.content || '');
    let importedCount = 0, duplicateCount = 0;
    for (const rec of records) (insertLog(t, rec).inserted ? importedCount++ : duplicateCount++);
    return { totalParsed: records.length, importedCount, duplicateCount };
  }
  if (method === 'POST' && pathname === '/api/v1/attendance/manual') {
    if (!body.zkUserId || !body.timestamp) throw new AppError('INVALID_PUNCH', 'Debe indicar el ID del empleado y la fecha/hora de la checada.');
    const clean = String(body.timestamp).replace('T', ' ');
    const ts = clean.length === 16 ? `${clean}:00` : clean;
    const res = insertLog(t, { zkUserId: String(body.zkUserId), timestamp: ts, inOutState: Number(body.inOutState || 0), verifyMode: 1, source: 'MANUAL' });
    return { inserted: res.inserted, timestamp: ts, zkUserId: body.zkUserId };
  }
  if (method === 'GET' && pathname === '/api/v1/reports/attendance') return report(t, url.searchParams);
  if (method === 'GET' && pathname === '/api/v1/reports/attendance/excel') {
    const rep = report(t, url.searchParams);
    const company = companySettings(t.company);
    const buf = await generateStyledAttendanceExcel({ report: rep, company });
    const name = `Reporte_Asistencia_${company.companyName.replace(/[^a-zA-Z0-9]/g, '_')}_${rep.range.startDate}_a_${rep.range.endDate}.xlsx`;
    return fileResponse(buf, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', name);
  }
  if (method === 'GET' && pathname === '/api/v1/reports/microsip') {
    const rep = report(t, url.searchParams);
    const type = url.searchParams.get('type') || 'asistencias';
    const opts = { report: rep, delimiter: url.searchParams.get('delimiter') === 'tab' ? '\t' : ',', dateFormat: url.searchParams.get('dateFormat') || 'DD/MM/YYYY', includeHeader: url.searchParams.get('header') === 'true' };
    const text = type === 'incidencias' ? generateMicrosipIncidentsText(opts) : generateMicrosipAttendanceText(opts);
    return fileResponse(text, 'text/plain; charset=utf-8', `Microsip_${type === 'incidencias' ? 'Incidencias' : 'Asistencias'}_${rep.range.startDate}_a_${rep.range.endDate}.txt`);
  }
  throw new AppError('NOT_FOUND', `Ruta no encontrada: ${pathname}`, {}, 404);
}

// ---------------------------------------------------------------------------
// Intercepta fetch('/api/v1/...') de public/app.js
// ---------------------------------------------------------------------------
const realFetch = window.fetch.bind(window);
window.fetch = async (input, init = {}) => {
  const url = new URL(typeof input === 'string' ? input : input.url, location.href);
  if (!url.pathname.includes('/api/v1/')) return realFetch(input, init);
  const method = String(init.method || 'GET').toUpperCase();
  const headers = new Headers(init.headers || {});
  let body = {};
  try { body = init.body ? JSON.parse(init.body) : {}; } catch { body = {}; }
  await new Promise((r) => setTimeout(r, 120)); // como un servidor local real
  try {
    const data = await handle(method, url, headers, body);
    save();
    if (data && data.__file) {
      return new Response(new Blob([data.body], { type: data.type }), { status: 200, headers: { 'Content-Type': data.type, 'Content-Disposition': `attachment; filename="${data.name}"` } });
    }
    return new Response(JSON.stringify(formatApiResponse(data)), { status: 200, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
  } catch (err) {
    const status = err.status || 400;
    if (!(err instanceof AppError)) console.error(err);
    return new Response(JSON.stringify(formatApiError(err.code || 'BAD_REQUEST', err.message || 'Error procesando solicitud', err.details || {})), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
  }
};

})();