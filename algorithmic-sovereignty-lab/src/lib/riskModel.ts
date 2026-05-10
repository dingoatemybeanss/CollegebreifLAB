import { RiskModule, RiskScore, RiskLevel } from "./types";

export const modules: RiskModule[] = [
  {
    id: "m1_purpose",
    title: "Purpose & Necessity",
    description: "Evaluates whether the deployed technology is actually needed and proportional to its stated goal.",
    questions: [
      {
        id: "q1_1",
        text: "How clearly defined is the purpose of the surveillance/AI technology?",
        options: [
          { value: "clear", label: "Clearly defined, limited, and legally bounded", score: 0 },
          { value: "vague", label: "Broadly defined with potential for scope creep", score: 1 },
          { value: "undefined", label: "Undefined, catch-all, or general 'security' purposes", score: 2 }
        ]
      },
      {
        id: "q1_2",
        text: "Could the stated goal be achieved through less invasive means?",
        options: [
          { value: "no", label: "No, this is the least invasive effective option", score: 0 },
          { value: "maybe", label: "Yes, but those means are costlier or slower", score: 1 },
          { value: "yes", label: "Yes, there are obvious traditional alternatives", score: 2 }
        ]
      }
    ]
  },
  {
    id: "m2_data",
    title: "Data & Training",
    description: "Assesses the origin, quality, and ownership of the data used to train the system.",
    questions: [
      {
        id: "q2_1",
        text: "Where is the data used to train the system sourced from?",
        options: [
          { value: "local_consented", label: "Locally sourced, fully consented, and representative", score: 0 },
          { value: "mixed", label: "Scraped data or purchased from third-party brokers", score: 1 },
          { value: "foreign", label: "Foreign datasets lacking representation of local demographics", score: 2 }
        ]
      },
      {
        id: "q2_2",
        text: "How is personal data handled post-collection?",
        options: [
          { value: "anonymized", label: "Strictly anonymized and stored locally for a limited time", score: 0 },
          { value: "pseudonymized", label: "Pseudonymized and kept indefinitely", score: 1 },
          { value: "raw", label: "Stored raw, potentially transferred cross-border", score: 2 }
        ]
      }
    ]
  },
  {
    id: "m3_decision",
    title: "Decision-Making Role of AI",
    description: "Analyzes whether the AI acts as an assistant or an autonomous decision-maker.",
    questions: [
      {
        id: "q3_1",
        text: "What level of human oversight exists in the decision-making loop?",
        options: [
          { value: "human_led", label: "Human decides, AI only provides supplementary data", score: 0 },
          { value: "human_in_loop", label: "AI decides, human merely rubber-stamps (automation bias)", score: 1 },
          { value: "autonomous", label: "Fully autonomous decision-making with direct impact", score: 2 }
        ]
      },
      {
        id: "q3_2",
        text: "Is the system's output directly linked to disciplinary or coercive action?",
        options: [
          { value: "no", label: "No, output is strictly advisory or analytical", score: 0 },
          { value: "indirect", label: "Triggers further manual investigation", score: 1 },
          { value: "yes", label: "Yes, automates fines, arrests, or service denial", score: 2 }
        ]
      }
    ]
  },
  {
    id: "m4_predictive",
    title: "Predictive Functions",
    description: "Evaluates the risk of relying on 'pre-crime' or predictive behavioral modeling.",
    questions: [
      {
        id: "q4_1",
        text: "Does the system attempt to predict future behavior or assign risk scores to individuals?",
        options: [
          { value: "no", label: "No, it only analyzes past or present factual events", score: 0 },
          { value: "limited", label: "Yes, but strictly limited to aggregate trends", score: 1 },
          { value: "yes", label: "Yes, assigns individual risk scores or predicts criminality", score: 2 }
        ]
      },
      {
        id: "q4_2",
        text: "Are these predictions used to preemptively restrict rights?",
        options: [
          { value: "no", label: "No preemptive action is taken", score: 0 },
          { value: "monitoring", label: "Used to justify increased surveillance", score: 1 },
          { value: "action", label: "Used to preemptively detain or deny access", score: 2 }
        ]
      }
    ]
  },
  {
    id: "m5_transparency",
    title: "Transparency & Contestation",
    description: "Measures whether affected individuals know about the system and can challenge its outputs.",
    questions: [
      {
        id: "q5_1",
        text: "Are citizens/subjects aware of the system's deployment?",
        options: [
          { value: "transparent", label: "Full public disclosure and prior consultation", score: 0 },
          { value: "vague", label: "Hidden in vague terms of service or privacy policies", score: 1 },
          { value: "secret", label: "Deployed secretly or without meaningful public notice", score: 2 }
        ]
      },
      {
        id: "q5_2",
        text: "Can individuals challenge decisions made by the system?",
        options: [
          { value: "easy", label: "Clear, accessible, and fast appeal process", score: 0 },
          { value: "hard", label: "Complex, slow, or costly appeal process", score: 1 },
          { value: "none", label: "No mechanism to appeal algorithmic decisions", score: 2 }
        ]
      }
    ]
  },
  {
    id: "m6_vendor",
    title: "Vendor & Export",
    description: "Checks for dependencies on foreign vendors and the terms of those contracts.",
    questions: [
      {
        id: "q6_1",
        text: "Who developed and controls the core technology?",
        options: [
          { value: "local", label: "Built locally or open-source with full audit capability", score: 0 },
          { value: "foreign_auditable", label: "Foreign vendor, but with strict local audits and controls", score: 1 },
          { value: "black_box", label: "Foreign vendor, black-box proprietary system", score: 2 }
        ]
      },
      {
        id: "q6_2",
        text: "Are there restrictive vendor lock-in clauses?",
        options: [
          { value: "no", label: "Open standards, easy to switch vendors", score: 0 },
          { value: "moderate", label: "Some lock-in, but feasible transition plan exists", score: 1 },
          { value: "yes", label: "Total lock-in; institution loses data access if contract ends", score: 2 }
        ]
      }
    ]
  },
  {
    id: "m7_crossborder",
    title: "Cross-Border Sovereignty",
    description: "Identifies risks related to data leaving national jurisdiction (e.g., CLOUD Act).",
    questions: [
      {
        id: "q7_1",
        text: "Where is the data physically stored and processed?",
        options: [
          { value: "local", label: "On-premise or strictly within national borders", score: 0 },
          { value: "regional", label: "In a neighboring allied jurisdiction with data pacts", score: 1 },
          { value: "foreign", label: "In foreign jurisdictions subject to laws like the US CLOUD Act", score: 2 }
        ]
      },
      {
        id: "q7_2",
        text: "Can foreign intelligence or law enforcement access this data?",
        options: [
          { value: "no", label: "Technically and legally blocked", score: 0 },
          { value: "unclear", label: "Unclear legal protections", score: 1 },
          { value: "yes", label: "Subject to foreign extraterritorial data requests", score: 2 }
        ]
      }
    ]
  },
  {
    id: "m8_contextual",
    title: "Contextual Integrity",
    description: "Assesses whether data collected for one context is inappropriately used in another.",
    questions: [
      {
        id: "q8_1",
        text: "Is data shared across different government or institutional departments?",
        options: [
          { value: "siloed", label: "Strictly siloed, data stays within collecting department", score: 0 },
          { value: "controlled", label: "Shared only under strict legal warrants or agreements", score: 1 },
          { value: "pooled", label: "Pooled into centralized 'data lakes' for universal access", score: 2 }
        ]
      },
      {
        id: "q8_2",
        text: "Does the system repurpose data collected for non-security reasons?",
        options: [
          { value: "no", label: "No, uses only dedicated security/administrative data", score: 0 },
          { value: "some", label: "Occasionally uses public social media data", score: 1 },
          { value: "yes", label: "Routinely mines health, transit, or educational records for policing", score: 2 }
        ]
      }
    ]
  },
  {
    id: "m9_oversight",
    title: "Oversight & Governance",
    description: "Evaluates the strength and independence of institutional oversight bodies.",
    questions: [
      {
        id: "q9_1",
        text: "What entity oversees the deployment and usage of the system?",
        options: [
          { value: "independent", label: "Independent judicial or civilian oversight body", score: 0 },
          { value: "internal", label: "Internal department auditing itself", score: 1 },
          { value: "none", label: "No formal oversight mechanism exists", score: 2 }
        ]
      },
      {
        id: "q9_2",
        text: "Are there mandated periodic audits for bias and accuracy?",
        options: [
          { value: "yes", label: "Yes, by external independent auditors", score: 0 },
          { value: "internal", label: "Yes, but only internal checks", score: 1 },
          { value: "no", label: "No algorithmic auditing takes place", score: 2 }
        ]
      }
    ]
  },
  {
    id: "m10_exit",
    title: "Exit Strategy",
    description: "Checks if there is a realistic plan to decommission the system if it fails or causes harm.",
    questions: [
      {
        id: "q10_1",
        text: "Is there a defined threshold of failure that triggers system shutdown?",
        options: [
          { value: "yes", label: "Clear legal/technical 'kill switch' parameters exist", score: 0 },
          { value: "vague", label: "Informal understanding that it could be reviewed", score: 1 },
          { value: "no", label: "No plan; presumed to be permanent", score: 2 }
        ]
      },
      {
        id: "q10_2",
        text: "Can the institution easily extract its data if it cancels the system?",
        options: [
          { value: "yes", label: "Yes, data is in standard formats and easily portable", score: 0 },
          { value: "costly", label: "Yes, but it is technically difficult or costly", score: 1 },
          { value: "no", label: "No, the vendor retains the data or formatting is proprietary", score: 2 }
        ]
      }
    ]
  }
];

function getLevelFromScore(scoreRatio: number): RiskLevel {
  if (scoreRatio < 0.33) return "Low";
  if (scoreRatio < 0.66) return "Medium";
  return "High";
}

export function calculateRisk(answers: Record<string, string>): RiskScore {
  const moduleScores: Record<string, { score: number; level: RiskLevel }> = {};
  let overallScore = 0;
  let maxPossibleScore = 0;

  for (const m of modules) {
    let modScore = 0;
    let modMax = 0;

    for (const q of m.questions) {
      modMax += 2; // Each question currently has a max score of 2
      const answeredValue = answers[q.id];
      if (answeredValue) {
        const option = q.options.find((o) => o.value === answeredValue);
        if (option) {
          modScore += option.score;
        }
      }
    }

    const modRatio = modMax > 0 ? modScore / modMax : 0;
    moduleScores[m.id] = {
      score: modScore,
      level: getLevelFromScore(modRatio)
    };

    overallScore += modScore;
    maxPossibleScore += modMax;
  }

  const overallRatio = maxPossibleScore > 0 ? overallScore / maxPossibleScore : 0;

  return {
    moduleScores,
    overallScore,
    maxPossibleScore,
    overallLevel: getLevelFromScore(overallRatio)
  };
}
