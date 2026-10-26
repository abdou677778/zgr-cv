export const formatTechMoney = (n: number) =>
  Number.isFinite(n)
    ? new Intl.NumberFormat("fr-DZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
        n,
      ) + " DA"
    : "À saisir";
export const formatTechDeadline = (date: string) => date.split("-").reverse().join("/");
