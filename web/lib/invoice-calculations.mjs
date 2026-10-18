// Match PostgreSQL numeric rounding without binary floating-point intermediates.
const ten = BigInt(10), zero = BigInt(0), one = BigInt(1), two = BigInt(2);
function divideRounded(value, divisor) {
  return value / divisor + ((value % divisor) * two >= divisor ? one : zero);
}
function units(value, scale) {
  const match = /^(\d*)(?:\.(\d*))?(?:e([+-]?\d+))?$/i.exec(String(value).trim());
  if (!match || !(match[1] || match[2])) return null;
  const exponent = Number(match[3] || 0);
  const digits = (match[1] || "") + (match[2] || "");
  if (!Number.isSafeInteger(exponent) || Math.abs(exponent) > 30 || digits.length > 40) return null;
  const shift = scale - (match[2] || "").length + exponent;
  const raw = BigInt(digits);
  return shift >= 0 ? raw * ten ** BigInt(shift) : divideRounded(raw, ten ** BigInt(-shift));
}
/** @param {Array<{quantity:string,unit_price:string,discount:string,tax_rate:string}>} lines */
export function invoiceTotals(lines) {
  let net = zero, tax = zero;
  for (const line of lines) {
    const quantity = units(line.quantity, 3), price = units(line.unit_price, 4);
    const discount = units(line.discount || "0", 2), rate = units(line.tax_rate || "0", 2);
    if (quantity === null || price === null || discount === null || rate === null || quantity <= zero || rate > BigInt(10000)) return null;
    const exactNet = quantity * price - discount * BigInt(100000);
    if (exactNet < zero) return null;
    const cents = divideRounded(exactNet, BigInt(100000));
    net += cents;
    tax += divideRounded(cents * rate, BigInt(10000));
  }
  // numeric(14,2) is the database's total limit.
  if (net + tax > BigInt("99999999999999")) return null;
  return {net:Number(net)/100,tax:Number(tax)/100,total:Number(net+tax)/100};
}
