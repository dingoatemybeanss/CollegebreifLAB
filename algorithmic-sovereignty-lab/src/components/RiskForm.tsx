import React, { useState } from 'react';
import { modules, calculateRisk } from '@/lib/riskModel';
import { RiskScore } from '@/lib/types';
import ModuleStep from './ModuleStep';

interface RiskFormProps {
  onComplete: (answers: Record<string, string>, riskScore: RiskScore) => void;
}

export default function RiskForm({ onComplete }: RiskFormProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const handleAnswerChange = (questionId: string, value: string) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: value
    }));
  };

  const handleNext = () => {
    if (currentStep < modules.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      // Finished
      const riskScore = calculateRisk(answers);
      onComplete(answers, riskScore);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  return (
    <div>
      <ModuleStep
        module={modules[currentStep]}
        stepIndex={currentStep}
        totalSteps={modules.length}
        answers={answers}
        onAnswerChange={handleAnswerChange}
        onNext={handleNext}
        onPrev={handlePrev}
        isLastStep={currentStep === modules.length - 1}
      />
    </div>
  );
}
