export interface ProductPriceInfo {
  isSteel: boolean;
  ratePerKg: number;
  unitPrice: number;
  standardWeight: number;
  totalWeight: number;
  totalPrice: number;
  unit: string;
  displayBreakdown: string;
}

/**
 * Rounds any number to exactly 2 decimal places with precision.
 * e.g. 52129.689999999 -> 52129.69
 */
export function round2(num: number | string | null | undefined): number {
  if (num === null || num === undefined || num === '') return 0;
  const n = Number(num);
  if (isNaN(n) || !isFinite(n)) return 0;
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Calculates accurate pricing for any product in Anbu Traders.
 * For steel products (e.g. Sumangala TMT, iSteel, Tata Steel):
 * - Total Weight = Quantity x Standard Weight (kg)
 * - Rate = Rate per kg (₹/kg)
 * - Unit Price = Standard Weight x Rate per kg
 * - Total Line Price = Total Weight x Rate per kg = Quantity x Unit Price
 * All weights and prices are rounded to 2 decimal places.
 */
export function calculateProductPrice(
  product: {
    category?: string | null;
    name?: string | null;
    price?: number | string | null;
    standard_weight?: number | string | null;
    unit?: string | null;
    brand?: string | null;
  } | null | undefined,
  quantity: number = 1
): ProductPriceInfo {
  if (!product) {
    return {
      isSteel: false,
      ratePerKg: 0,
      unitPrice: 0,
      standardWeight: 0,
      totalWeight: 0,
      totalPrice: 0,
      unit: 'nos',
      displayBreakdown: ''
    };
  }

  const pPrice = Number(product.price || 0);
  const stdWeight = round2(product.standard_weight || 0);
  const unit = (product.unit || 'nos').toLowerCase();
  const cat = (product.category || '').toLowerCase();
  const name = (product.name || '').toLowerCase();
  const brand = (product.brand || '').toLowerCase();

  const isSteel =
    cat.includes('steel') ||
    cat.includes('tmt') ||
    name.includes('steel') ||
    name.includes('tmt') ||
    name.includes('isteel') ||
    name.includes('sumangala') ||
    brand.includes('sumangala') ||
    brand.includes('isteel') ||
    (stdWeight > 0 && (unit === 'nos' || unit === 'piece' || unit === 'rod' || unit === 'bundle' || unit === 'kg'));

  if (isSteel && stdWeight > 0) {
    // Determine rate per kg vs unit price (price per single piece / rod)
    let ratePerKg = pPrice;
    let unitPrice = pPrice * stdWeight;

    // If pPrice in DB was stored as the piece price (e.g. 280.25 for 4.75kg = 59/kg, or 525 for 10.5kg = 50/kg)
    // Standard steel rates in India range between ~₹35 to ~₹150 / kg
    if (pPrice > 120 && stdWeight > 0) {
      const calculatedRate = pPrice / stdWeight;
      if (calculatedRate >= 25 && calculatedRate <= 200) {
        unitPrice = pPrice;
        ratePerKg = calculatedRate;
      }
    }

    const totalWeight = round2(quantity * stdWeight);
    const roundedRatePerKg = round2(ratePerKg);
    const totalPrice = round2(totalWeight * roundedRatePerKg);
    const roundedUnitPrice = round2(unitPrice);
    const displayBreakdown = `${quantity} nos × ${stdWeight} kg = ${totalWeight.toFixed(2)} kg @ ₹${roundedRatePerKg.toFixed(2)}/kg`;

    return {
      isSteel: true,
      ratePerKg: roundedRatePerKg,
      unitPrice: roundedUnitPrice,
      standardWeight: stdWeight,
      totalWeight,
      totalPrice,
      unit: 'nos',
      displayBreakdown
    };
  }

  // Non-steel products (Cement, accessories, blocks, etc.)
  const unitPrice = round2(pPrice);
  const totalWeight = stdWeight > 0 ? round2(quantity * stdWeight) : 0;
  const totalPrice = round2(quantity * unitPrice);
  const ratePerKg = stdWeight > 0 ? round2(unitPrice / stdWeight) : 0;
  const displayBreakdown = `${quantity} ${unit} × ₹${unitPrice.toFixed(2)}`;

  return {
    isSteel: false,
    ratePerKg,
    unitPrice,
    standardWeight: stdWeight,
    totalWeight,
    totalPrice,
    unit,
    displayBreakdown
  };
}
