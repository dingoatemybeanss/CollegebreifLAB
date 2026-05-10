import React from 'react';
import { RiskScore, RiskLevel } from '@/lib/types';
import { modules } from '@/lib/riskModel';

interface ResultSummaryProps {
  score: RiskScore;
  onDashboardRedirect: () => void;
}

const getLevelColor = (level: RiskLevel) => {
  switch (level) {
    case 'Low': return 'text-green-700 bg-green-50 border-green-200';
    case 'Medium': return 'text-yellow-700 bg-yellow-50 border-yellow-200';
    case 'High': return 'text-red-700 bg-red-50 border-red-200';
    default: return 'text-gray-700 bg-gray-50 border-gray-200';
  }
};

export default function ResultSummary({ score, onDashboardRedirect }: ResultSummaryProps) {
  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className={`card text-center border-2 ${getLevelColor(score.overallLevel)}`}>
        <h2 className="text-2xl font-bold mb-2">Assessment Complete</h2>
        <p className="text-lg mb-4">Overall Institutional Risk Level</p>
        <div className="text-4xl font-extrabold uppercase tracking-widest mb-4">
          {score.overallLevel}
        </div>
        <p className="text-sm opacity-80">
          Total Score: {score.overallScore} / {score.maxPossibleScore}
        </p>
      </div>

      <div className="card">
        <h3 className="text-xl font-bold mb-6 text-gray-900 border-b pb-2">Module Breakdown</h3>
        <div className="space-y-4">
          {modules.map((m) => {
            const modScore = score.moduleScores[m.id];
            if (!modScore) return null;
            return (
              <div key={m.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-gray-50 rounded border border-gray-100">
                <div className="mb-2 sm:mb-0">
                  <div className="font-bold text-gray-800">{m.title}</div>
                </div>
                <div className="flex items-center space-x-4">
                  <span className="text-sm text-gray-500 font-mono">Score: {modScore.score}</span>
                  <span className={`px-3 py-1 text-xs font-bold uppercase rounded-full border ${getLevelColor(modScore.level)}`}>
                    {modScore.level} Risk
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="text-center">
        <button onClick={onDashboardRedirect} className="btn-primary px-8">
          Go to Dashboard
        </button>
      </div>
    </div>
  );
}
