import React from 'react';
import { RiskModule } from '@/lib/types';

interface ModuleStepProps {
  module: RiskModule;
  stepIndex: number;
  totalSteps: number;
  answers: Record<string, string>;
  onAnswerChange: (questionId: string, value: string) => void;
  onNext: () => void;
  onPrev: () => void;
  isLastStep: boolean;
}

export default function ModuleStep({
  module,
  stepIndex,
  totalSteps,
  answers,
  onAnswerChange,
  onNext,
  onPrev,
  isLastStep
}: ModuleStepProps) {

  // Check if all questions in this module have been answered
  const isModuleComplete = module.questions.every(q => answers[q.id]);

  return (
    <div className="card max-w-2xl mx-auto">
      <div className="mb-6 border-b pb-4">
        <div className="text-sm font-medium text-blue-600 mb-1">
          Module {stepIndex + 1} of {totalSteps}
        </div>
        <h2 className="text-2xl font-bold text-gray-900">{module.title}</h2>
        <p className="text-gray-600 mt-2 text-sm">{module.description}</p>
      </div>

      <div className="space-y-8">
        {module.questions.map((q) => (
          <div key={q.id} className="space-y-3">
            <h3 className="text-lg font-medium text-gray-800">{q.text}</h3>
            <div className="space-y-2">
              {q.options.map((option) => (
                <label
                  key={option.value}
                  className={`flex items-start p-3 border rounded-lg cursor-pointer transition-colors ${
                    answers[q.id] === option.value ? 'bg-blue-50 border-blue-300' : 'hover:bg-gray-50 border-gray-200'
                  }`}
                >
                  <div className="flex items-center h-5">
                    <input
                      type="radio"
                      name={q.id}
                      value={option.value}
                      checked={answers[q.id] === option.value}
                      onChange={() => onAnswerChange(q.id, option.value)}
                      className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300"
                    />
                  </div>
                  <div className="ml-3 text-sm">
                    <span className="font-medium text-gray-900">{option.label}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 flex justify-between pt-6 border-t border-gray-100">
        <button
          onClick={onPrev}
          disabled={stepIndex === 0}
          className={`btn-secondary ${stepIndex === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          Previous
        </button>
        <button
          onClick={onNext}
          disabled={!isModuleComplete}
          className={`btn-primary ${!isModuleComplete ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {isLastStep ? 'Submit Assessment' : 'Next Module'}
        </button>
      </div>
    </div>
  );
}
