import React, { useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import AuthGuard from '@/components/AuthGuard';
import InstitutionForm from '@/components/InstitutionForm';
import RiskForm from '@/components/RiskForm';
import ResultSummary from '@/components/ResultSummary';
import { InstitutionType, RiskScore } from '@/lib/types';
import { db, auth } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

export default function Profiler() {
  const router = useRouter();
  const [step, setStep] = useState<'institution' | 'assessment' | 'result'>('institution');
  const [institutionData, setInstitutionData] = useState<{name: string, country: string, type: InstitutionType} | null>(null);
  const [finalScore, setFinalScore] = useState<RiskScore | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleInstitutionSubmit = (data: {name: string, country: string, type: InstitutionType}) => {
    setInstitutionData(data);
    setStep('assessment');
  };

  const handleAssessmentComplete = async (answers: Record<string, string>, score: RiskScore) => {
    setIsSaving(true);
    setFinalScore(score);

    try {
      const user = auth.currentUser;
      if (!user || !institutionData) throw new Error("Missing user or institution data");

      // Save Institution first
      const instRef = await addDoc(collection(db, 'institutions'), {
        userId: user.uid,
        name: institutionData.name,
        country: institutionData.country,
        type: institutionData.type,
        createdAt: serverTimestamp()
      });

      // Save Assessment
      await addDoc(collection(db, 'assessments'), {
        institutionId: instRef.id,
        userId: user.uid,
        answers: answers,
        moduleScores: score.moduleScores,
        overallRiskLevel: score.overallLevel,
        overallScore: score.overallScore,
        maxPossibleScore: score.maxPossibleScore,
        createdAt: serverTimestamp()
      });

      setStep('result');
    } catch (error) {
      console.error("Error saving assessment:", error);
      alert("There was an error saving your assessment. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AuthGuard>
      <Head>
        <title>Risk Profiler - Algorithmic Sovereignty Lab</title>
      </Head>

      <div className="py-8">
        <h1 className="text-3xl font-extrabold mb-8 text-center">Interactive Risk Profiler</h1>

        {step === 'institution' && (
          <InstitutionForm onSubmit={handleInstitutionSubmit} />
        )}

        {step === 'assessment' && (
          isSaving ? (
            <div className="text-center py-20">
              <p className="text-xl text-gray-600 font-medium animate-pulse">Saving your assessment...</p>
            </div>
          ) : (
            <RiskForm onComplete={handleAssessmentComplete} />
          )
        )}

        {step === 'result' && finalScore && (
          <ResultSummary
            score={finalScore}
            onDashboardRedirect={() => router.push('/dashboard')}
          />
        )}
      </div>
    </AuthGuard>
  );
}
