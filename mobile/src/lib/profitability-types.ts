export interface FinanceProfile {
  vehicleId: number;
  purchasePrice: number;
  downPayment: number;
  annualRate: number;
  months: number;
  startMonth: string;
  monthlyPaymentOverride: number | null;
  insurance: number;
  maintenance: number;
  otherCosts: number;
  isEstimate: boolean;
}
export interface ProfitRow {
  vehicleId: number;
  name: string;
  imageUrl: string;
  dailyRate: number;
  archived: boolean;
  profile: FinanceProfile | null;
  saved: boolean;
  market: { price: number; source: string; label: string } | null;
  realRevenue: number;
  testRevenue: number;
  revenue: number;
  credit: number | null;
  costs: number | null;
  balance: number | null;
  breakEvenDays: number | null;
}
export interface ProfitReport {
  month: string;
  includeTest: boolean;
  checkedAt: string;
  rows: ProfitRow[];
  summary: {
    revenue: number;
    credit: number;
    costs: number;
    balance: number;
    configured: number;
    total: number;
  };
}
