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
    (stdWeight > 0 && (unit === 'nos' || unit === 'piece' || unit === 'rod' || unit === 'bundle'));

  if (isSteel && stdWeight > 0) {
    // If unit is kg directly
    if (unit === 'kg') {
      const ratePerKg = pPrice;
      const totalWeight = quantity;
      const totalPrice = quantity * ratePerKg;
      return {
        isSteel: true,
        ratePerKg,
        unitPrice: ratePerKg,
        standardWeight: stdWeight,
        totalWeight,
        totalPrice,
        unit: 'kg',
        displayBreakdown: `${quantity} kg @ ₹${ratePerKg.toFixed(2)}/kg`
      };
    }

    // Steel in units/pieces (rods)
    // Determine rate per kg vs unit price
    let ratePerKg = pPrice;
    let unitPrice = pPrice * stdWeight;

    // If pPrice in DB was already stored as the full unit rod price (e.g. 244.63 instead of 51.5)
    // (A typical steel rate in India is 40 - 100 ₹/kg)
    if (pPrice > 120 && (pPrice / stdWeight >= 30 && pPrice / stdWeight <= 150)) {
      unitPrice = pPrice;
      ratePerKg = pPrice / stdWeight;
    }

    const totalWeight = quantity * stdWeight;
    const totalPrice = totalWeight * ratePerKg;
    const displayBreakdown = `${quantity} ${unit} × ${stdWeight} kg = ${totalWeight.toFixed(2)} kg @ ₹${ratePerKg.toFixed(2)}/kg`;

    return {
      isSteel: true,
      ratePerKg,
      unitPrice,
      standardWeight: stdWeight,
      totalWeight,
      totalPrice,
      unit,
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
