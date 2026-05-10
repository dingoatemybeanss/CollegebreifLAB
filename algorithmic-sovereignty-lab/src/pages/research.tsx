import React from 'react';
import Head from 'next/head';

export default function Research() {
  return (
    <>
      <Head>
        <title>Research - Algorithmic Sovereignty Lab</title>
      </Head>

      <div className="max-w-4xl mx-auto py-8 space-y-8">
        <div>
          <h1 className="text-3xl font-extrabold mb-4">Underlying Research</h1>
          <p className="text-xl text-gray-600 mb-8 border-b pb-8">
            The foundation of the Algorithmic Sovereignty Lab.
          </p>
        </div>

        <section className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h2 className="text-2xl font-bold mb-4 text-blue-800">Abstract</h2>
          <p className="text-gray-700 italic leading-relaxed">
            This research examines the intersection of the &quot;surveillance stack&quot;quot;surveillance stack&quot;surveillance stack&quot;quot;—the interconnected layers of data extraction, algorithmic analysis, and coercive capacity—and the unique vulnerabilities of small democracies. By analyzing the structural failures of both US constitutional litigation models and EU top-down regulatory frameworks, this paper identifies a dangerous &quot;Import Gap.&quot;quot;Import Gap.&quot;Import Gap.&quot;quot; Small states increasingly import sophisticated surveillance architectures without the corresponding institutional safeguards. Focusing on the Dominican Republic and the Article 69 confrontation guarantee as a primary case study, this paper proposes a theory of &quot;Algorithmic Sovereignty.&quot;quot;Algorithmic Sovereignty.&quot;Algorithmic Sovereignty.&quot;quot; It argues that protecting democratic rights requires stack-level governance and introduces a 10-module institutional toolkit designed as a minimum democratic standard for technology adoption in resource-constrained environments.
          </p>
        </section>

        <section className="space-y-6">
          <h2 className="text-2xl font-bold text-gray-900 border-b pb-2">Central Claims</h2>

          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-bold text-blue-700">1. The Stack as a System</h3>
              <p className="text-gray-700">
                Surveillance tools cannot be evaluated in silos. Facial recognition, encryption backdoors, and AI training data combine to form a cohesive system that dramatically alters the balance of power between the state (or vendor) and the citizen.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-bold text-blue-700">2. US/EU Structural Failure</h3>
              <p className="text-gray-700">
                Current global paradigms fail small democracies. The US relies on post-harm litigation, which cannot dismantle entrenched technical architectures. The EU relies on massive bureaucratic state capacity, which small democracies cannot replicate.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-bold text-blue-700">3. The Small-Democracy Import Gap</h3>
              <p className="text-gray-700">
                When a small democracy imports surveillance tech from a foreign superpower or multinational vendor, they are importing coercive capacity while leaving the oversight mechanisms behind. This leads to rapid democratic backsliding.
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-4 pt-6">
          <h2 className="text-2xl font-bold text-gray-900 border-b pb-2">The Case Study: Dominican Republic</h2>
          <p className="text-gray-700">
            The Dominican Republic serves as the primary case study for this framework. We specifically examine the confrontation between imported AI technologies and the guarantees provided by <strong>Article 69</strong> of the Dominican Constitution (effective judicial protection and due process).
          </p>
          <p className="text-gray-700">
            The research demonstrates how opaque, foreign-developed algorithms fundamentally violate Article 69 when used in administrative or punitive capacities, as the citizen cannot effectively challenge the logic of a proprietary black-box system.
          </p>
        </section>

        <div className="mt-10 p-6 bg-blue-50 rounded-lg text-center">
          <h3 className="text-lg font-bold mb-2">Read the Full Paper</h3>
          <p className="text-gray-600 mb-4 text-sm">
            The full research paper detailing the surveillance stack, the DR case study, and the theoretical underpinnings of Algorithmic Sovereignty is available below.
          </p>
          <a href="/papers/algorithmic-sovereignty.pdf" target="_blank" rel="noopener noreferrer" className="btn-primary inline-block opacity-50 cursor-not-allowed" title="Paper PDF coming soon">
            Download PDF (Coming Soon)
          </a>
        </div>
      </div>
    </>
  );
}
