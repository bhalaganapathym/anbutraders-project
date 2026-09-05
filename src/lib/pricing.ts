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
    piece_weight_kg?: number | string | null;
    bundle_conversion_qty?: number | null;
    is_aac_block?: boolean | null;
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
  const stdWeight = round2(product.standard_weight || product.piece_weight_kg || 0);
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

export interface DiscountedPriceInfo extends ProductPriceInfo {
  discountType: 'per_kg' | 'per_unit' | 'flat' | 'none';
  discountValue: number;
  discountPerKg: number;
  discountPerUnit: number;
  totalDiscountAmount: number;
  discountedRatePerKg: number;
  discountedUnitPrice: number;
  finalTotalPrice: number;
}

export function calculateDiscountedProductPrice(
  product: {
    category?: string | null;
    name?: string | null;
    price?: number | string | null;
    standard_weight?: number | string | null;
    unit?: string | null;
    brand?: string | null;
  } | null | undefined,
  quantity: number = 1,
  discount?: {
    type: 'per_kg' | 'per_unit' | 'flat';
    value: number;
  } | null
): DiscountedPriceInfo {
  const base = calculateProductPrice(product, quantity);
  if (!discount || !discount.value || discount.value <= 0) {
    return {
      ...base,
      discountType: 'none',
      discountValue: 0,
      discountPerKg: 0,
      discountPerUnit: 0,
      totalDiscountAmount: 0,
      discountedRatePerKg: base.ratePerKg,
      discountedUnitPrice: base.unitPrice,
      finalTotalPrice: base.totalPrice
    };
  }

  const val = round2(discount.value);
  let discountPerKg = 0;
  let discountPerUnit = 0;
  let totalDiscountAmount = 0;
  let discountedRatePerKg = base.ratePerKg;
  let discountedUnitPrice = base.unitPrice;
  let finalTotalPrice = base.totalPrice;

  if (discount.type === 'per_kg') {
    discountPerKg = val;
    discountedRatePerKg = round2(Math.max(0, base.ratePerKg - val));
    if (base.isSteel && base.standardWeight > 0) {
      discountPerUnit = round2(discountPerKg * base.standardWeight);
      discountedUnitPrice = round2(Math.max(0, base.unitPrice - discountPerUnit));
      totalDiscountAmount = round2(base.totalWeight * discountPerKg);
      finalTotalPrice = round2(Math.max(0, base.totalPrice - totalDiscountAmount));
    } else {
      totalDiscountAmount = round2(base.totalWeight * discountPerKg);
      finalTotalPrice = round2(Math.max(0, base.totalPrice - totalDiscountAmount));
    }
  } else if (discount.type === 'per_unit') {
    discountPerUnit = val;
    discountedUnitPrice = round2(Math.max(0, base.unitPrice - val));
    totalDiscountAmount = round2(quantity * val);
    finalTotalPrice = round2(Math.max(0, base.totalPrice - totalDiscountAmount));
    if (base.standardWeight > 0) {
      discountPerKg = round2(val / base.standardWeight);
      discountedRatePerKg = round2(Math.max(0, base.ratePerKg - discountPerKg));
    }
  } else if (discount.type === 'flat') {
    totalDiscountAmount = round2(Math.min(base.totalPrice, val));
    finalTotalPrice = round2(Math.max(0, base.totalPrice - totalDiscountAmount));
    if (quantity > 0) {
      discountPerUnit = round2(totalDiscountAmount / quantity);
      discountedUnitPrice = round2(Math.max(0, base.unitPrice - discountPerUnit));
    }
    if (base.totalWeight > 0) {
      discountPerKg = round2(totalDiscountAmount / base.totalWeight);
      discountedRatePerKg = round2(Math.max(0, base.ratePerKg - discountPerKg));
    }
  }

  return {
    ...base,
    discountType: discount.type,
    discountValue: val,
    discountPerKg,
    discountPerUnit,
    totalDiscountAmount,
    discountedRatePerKg,
    discountedUnitPrice,
    finalTotalPrice
  };
}

/**
 * Converts a quantity of steel pieces into bundles + remaining pieces.
 * e.g., 16 pieces of 8mm steel (where 1 bundle = 7 nos) -> "2 bundles + 2 nos (16 nos)"
 */
export function formatBundleQuantity(
  quantity: number,
  bundleConversionQty?: number | null
): { bundles: number; remainingNos: number; formatted: string } {
  if (!bundleConversionQty || bundleConversionQty <= 1) {
    return { bundles: 0, remainingNos: quantity, formatted: `${quantity} nos` };
  }
  const bundles = Math.floor(quantity / bundleConversionQty);
  const remainingNos = quantity % bundleConversionQty;
  if (bundles === 0) {
    return { bundles, remainingNos, formatted: `${quantity} nos` };
  }
  if (remainingNos === 0) {
    return { bundles, remainingNos, formatted: `${bundles} bundle${bundles > 1 ? 's' : ''} (${quantity} nos)` };
  }
  return {
    bundles,
    remainingNos,
    formatted: `${bundles} bundle${bundles > 1 ? 's' : ''} + ${remainingNos} nos (${quantity} nos)`
  };
}
