export function money(value: number | string | null | undefined) {

  const numberValue = Number(value || 0);

  return (
    new Intl.NumberFormat("fa-IR", {
      maximumFractionDigits: 0
    }).format(numberValue)
    + " ریال"
  );

}



export function numberFa(value: number | string | null | undefined) {

  return new Intl.NumberFormat("fa-IR", {
    maximumFractionDigits: 0
  }).format(Number(value || 0));

}



export function todayLabel() {

  return new Intl.DateTimeFormat("fa-IR", {
    dateStyle: "medium"
  }).format(new Date());

}