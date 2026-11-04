const techMoneyFormatter = new Intl.NumberFormat("fr-DZ", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
export const formatTechMoney = (n: number) =>
  Number.isFinite(n) ? techMoneyFormatter.format(n) + " DA" : "À saisir";
export const formatTechDeadline = (date: string) => date.split("-").reverse().join("/");
