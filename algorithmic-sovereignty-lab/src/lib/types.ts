export type RiskLevel = "Low" | "Medium" | "High";

export enum InstitutionType {
  University = "University",
  Government = "Government",
  NonProfit = "NonProfit",
  PrivateCompany = "PrivateCompany",
  Other = "Other"
}

export interface Institution {
  id: string;
  userId: string;
  name: string;
  country: string;
  type: InstitutionType;
  createdAt: number;
}

export interface Assessment {
  id: string;
  institutionId: string;
  userId: string;
  answers: Record<string, string>;
  moduleScores: Record<string, { score: number; level: RiskLevel }>;
  overallRiskLevel: RiskLevel;
  overallScore: number;
  maxPossibleScore: number;
  createdAt: number;
}

export interface ModuleQuestionOption {
  value: string;
  label: string;
  score: number; // 0 = safe, 1 = caution, 2 = high risk
}

export interface ModuleQuestion {
  id: string;
  text: string;
  options: ModuleQuestionOption[];
}

export interface RiskModule {
  id: string;
  title: string;
  description: string;
  questions: ModuleQuestion[];
}

export interface RiskScore {
  moduleScores: Record<string, { score: number; level: RiskLevel }>;
  overallScore: number;
  maxPossibleScore: number;
  overallLevel: RiskLevel;
}
