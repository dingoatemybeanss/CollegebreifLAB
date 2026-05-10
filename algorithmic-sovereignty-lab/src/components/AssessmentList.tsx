import React, { useState } from 'react';
import { Institution, Assessment, RiskLevel } from '@/lib/types';

interface AssessmentListProps {
  institutions: Institution[];
  assessments: Assessment[];
}

export default function AssessmentList({ institutions, assessments }: AssessmentListProps) {
  const [expandedInst, setExpandedInst] = useState<string | null>(null);

  if (institutions.length === 0) {
    return (
      <div className="card text-center py-12">
        <p className="text-gray-500 mb-4">You haven&apos;t created any assessments yet.</p>
      </div>
    );
  }

  const getBadgeColor = (level: RiskLevel) => {
    switch (level) {
      case 'Low': return 'bg-green-100 text-green-800 border-green-200';
      case 'Medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'High': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'Unknown date';
    // Firestore timestamp
    if (timestamp.toDate) {
      return timestamp.toDate().toLocaleDateString();
    }
    // Just in case it's a number
    return new Date(timestamp).toLocaleDateString();
  };

  return (
    <div className="space-y-6">
      {institutions.map(inst => {
        const instAssessments = assessments.filter(a => a.institutionId === inst.id).sort((a, b) => {
          const timeA = a.createdAt?.valueOf() || 0;
          const timeB = b.createdAt?.valueOf() || 0;
          return timeB - timeA; // Descending
        });
        const isExpanded = expandedInst === inst.id;

        return (
          <div key={inst.id} className="card overflow-hidden !p-0">
            <div
              className="p-6 cursor-pointer hover:bg-gray-50 transition-colors flex justify-between items-center"
              onClick={() => setExpandedInst(isExpanded ? null : inst.id)}
            >
              <div>
                <h3 className="text-xl font-bold text-gray-900">{inst.name}</h3>
                <p className="text-sm text-gray-500">{inst.type} &bull; {inst.country}</p>
              </div>
              <div className="text-gray-400">
                {isExpanded ? '▲' : '▼'}
              </div>
            </div>

            {isExpanded && (
              <div className="bg-gray-50 border-t border-gray-200 p-6">
                <h4 className="font-bold text-sm text-gray-700 uppercase tracking-wider mb-4">Assessment History</h4>
                {instAssessments.length === 0 ? (
                  <p className="text-sm text-gray-500">No assessments found.</p>
                ) : (
                  <div className="space-y-3">
                    {instAssessments.map(assessment => (
                      <div key={assessment.id} className="bg-white p-4 rounded border border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center">
                        <div className="mb-2 sm:mb-0">
                          <p className="font-medium text-gray-800">{formatDate(assessment.createdAt)}</p>
                          <p className="text-xs text-gray-500">Score: {assessment.overallScore}/{assessment.maxPossibleScore}</p>
                        </div>
                        <span className={`px-3 py-1 text-xs font-bold uppercase rounded-full border ${getBadgeColor(assessment.overallRiskLevel)}`}>
                          {assessment.overallRiskLevel} Risk
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
