export function money(value: number) {
  return new Intl.NumberFormat("he-IL").format(value) + " ₪";
}
