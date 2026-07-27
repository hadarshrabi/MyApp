export const saleService = {
  async create(productId: string, quantity: number) {
    const response = await fetch("/api/sales", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ productId, quantity }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error ?? "לא ניתן לשמור את המכירה");
    return payload.sale;
  },
};
