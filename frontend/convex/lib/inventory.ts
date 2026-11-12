export function validateStockQuantity(quantity: number | undefined): void {
  if (quantity !== undefined && (!Number.isInteger(quantity) || quantity < 0)) {
    throw new Error("Stock quantity must be a non-negative whole number");
  }
}

export function reserveOneUnit(availableQuantity: number | undefined): number {
  if (availableQuantity === undefined) {
    throw new Error("Seller must set available stock before this listing can be purchased");
  }
  if (!Number.isInteger(availableQuantity) || availableQuantity < 0) {
    throw new Error("Tracked stock must be a non-negative whole number");
  }
  if (availableQuantity === 0) {
    throw new Error("This listing is out of stock");
  }
  return availableQuantity - 1;
}

export function releaseOneUnit(
  availableQuantity: number | undefined,
  stockReserved: boolean | undefined,
): number | undefined {
  if (!stockReserved) return availableQuantity;
  if (availableQuantity === undefined || !Number.isInteger(availableQuantity) || availableQuantity < 0) {
    throw new Error("Cannot restore reserved stock because the listing inventory is invalid");
  }
  return availableQuantity + 1;
}
