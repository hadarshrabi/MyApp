import { ShiftDayGroups } from "../components/ShiftDayGroups";
import { useBusinessData } from "../context/BusinessDataContext";

export function EmployeeHistoryPage() {
  const { attendanceShiftSummary } = useBusinessData();
  const hours = attendanceShiftSummary.summary.totalMinutes / 60;

  return <div className="employee-history-page">
    <header><span>מידע אישי לקריאה בלבד</span><h1>המשמרות והשכר שלי</h1></header>
    <section className="employee-pay-summary"><article><small>משמרות בחודש</small><strong>{attendanceShiftSummary.summary.totalShifts}</strong></article><article><small>שעות בחודש</small><strong>{hours.toFixed(2)}</strong></article><article><small>שכר חודשי</small><strong>{(attendanceShiftSummary.summary.totalPayCents / 100).toFixed(2)} ₪</strong></article></section>
    <p className="employee-readonly-note">הנתונים מחושבים מרישומי השרת. רק מנהל יכול לבצע תיקונים.</p>
    <ShiftDayGroups value={attendanceShiftSummary} />
  </div>;
}
