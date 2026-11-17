// A month directory of the sessions and of the plans: <YYYY-MM>, the month
// from 01 to 12.
const MONTH_NAME = /^\d{4}-(0[1-9]|1[0-2])$/u;

export function isMonthName(name: string): boolean {
  return MONTH_NAME.test(name);
}
