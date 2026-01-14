export const MOCK_PROMOS = [
  {
    id: "p1",
    title: "Sconto 30% - Venerdì Notte",
    discount: "30%",
    until: "15 Gen",
    image: "https://images.unsplash.com/photo-1519681393784-d120267933ba?q=80&w=800&auto=format&fit=crop&ixlib=rb-4.0.3&s=promo1",
  },
  {
    id: "p2",
    title: "Ingresso VIP - Early Bird",
    discount: "Ingresso VIP",
    until: "20 Gen",
    image: "https://images.unsplash.com/photo-1533777324565-a040eb52fac2?q=80&w=800&auto=format&fit=crop&ixlib=rb-4.0.3&s=promo2",
  },
];

// mock promos owned by the current user (used for frontend-only filtering)
export const MOCK_USER_PROMOS = ["p1"];
