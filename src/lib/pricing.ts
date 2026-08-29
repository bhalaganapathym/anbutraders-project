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
 * Calculates accurate pricing for any product in Anbu Traders.
 * For steel products (e.g. Sumangala TMT, iSteel, Tata Steel):
 * - Total Weight = Quantity x Standard Weight (kg)
 * - Rate = Rate per kg (₹/kg)
 * - Unit Price = Standard Weight x Rate per kg
 * - Total Line Price = Total Weight x Rate per kg = Quantity x Unit Price
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
  const stdWeight = Number(product.standard_weight || 0);
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

    const totalWeight = quantity * stdWeight;
    const totalPrice = totalWeight * ratePerKg;
    const displayBreakdown = `${quantity} nos × ${stdWeight} kg = ${totalWeight.toFixed(2)} kg @ ₹${ratePerKg.toFixed(2)}/kg`;

    return {
      isSteel: true,
      ratePerKg,
      unitPrice,
      standardWeight: stdWeight,
      totalWeight,
      totalPrice,
      unit: 'nos',
      displayBreakdown
    };
  }

  // Non-steel products (Cement, accessories, blocks, etc.)
  const unitPrice = pPrice;
  const totalWeight = stdWeight > 0 ? quantity * stdWeight : 0;
  const totalPrice = quantity * unitPrice;
  const ratePerKg = stdWeight > 0 ? unitPrice / stdWeight : 0;
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
