import React from 'react';
import Head from 'next/head';
import { modules } from '@/lib/riskModel';

export default function Toolkit() {
  return (
    <>
      <Head>
        <title>Institutional Toolkit - Algorithmic Sovereignty Lab</title>
      </Head>

      <div className="max-w-4xl mx-auto py-8">
        <h1 className="text-3xl font-extrabold mb-4">Institutional Toolkit</h1>
        <p className="text-lg text-gray-600 mb-8">
          The 10-module framework provides a minimum democratic standard for evaluating the adoption of surveillance and AI technologies.
          Use this reference to understand the dimensions of governance we measure.
        </p>

        <div className="space-y-6">
          {modules.map((module, index) => (
            <div key={module.id} className="card">
              <div className="flex items-center gap-4 mb-3">
                <span className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-blue-100 text-blue-800 font-bold rounded-full">
                  {index + 1}
                </span>
                <h2 className="text-xl font-bold text-gray-900 m-0">{module.title}</h2>
              </div>
              <p className="text-gray-700 ml-12">
                {module.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
