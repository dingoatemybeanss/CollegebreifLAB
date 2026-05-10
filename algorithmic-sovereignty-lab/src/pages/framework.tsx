import React from 'react';
import Head from 'next/head';

export default function Framework() {
  return (
    <>
      <Head>
        <title>Framework - Algorithmic Sovereignty Lab</title>
      </Head>

      <div className="max-w-4xl mx-auto py-8 space-y-8">
        <div>
          <h1 className="text-3xl font-extrabold mb-4">The Framework</h1>
          <p className="text-xl text-gray-600 mb-8 border-b pb-8">
            Understanding the Surveillance Stack and the necessity of Stack-Level Governance.
          </p>
        </div>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-blue-800">1. The Surveillance Stack as a System</h2>
          <p>
            Surveillance technology is rarely deployed as a single, isolated tool. Instead, it operates as a deeply integrated <strong>Surveillance Stack</strong>.
            This stack includes overlapping capabilities such as facial recognition, mandated encryption vulnerabilities, and AI models trained on vast troves of personal data.
          </p>
          <p>
            We use a <strong>&quot;Mosaic&quot;quot;Mosaic&quot;Mosaic&quot;quot; metaphor</strong> to describe this reality: when data from multiple layers of the stack are combined, they form a highly detailed composite profile of individual identity and behavior. Regulating these tools in isolation misses the aggregate power of the mosaic.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-blue-800">2. Structural Failures in Dominant Models</h2>
          <p>
            When confronting the surveillance stack, small democracies often look to larger geopolitical powers for regulatory frameworks. However, both major paradigms structurally miss stack-level governance:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-gray-700">
            <li>
              <strong>The US Constitutional Model:</strong> Relies heavily on post-hoc litigation (e.g., First and Fourth Amendment challenges). This model struggles to address architectural constraints built into the technology itself before harms occur.
            </li>
            <li>
              <strong>The EU Regulatory Model:</strong> Frameworks like the GDPR and the EU AI Act provide top-down, rights-based protections, but they are incredibly complex and expensive to enforce, requiring massive state capacity that small democracies often lack.
            </li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-blue-800">3. The Import Gap</h2>
          <p>
            The fundamental risk for small democracies is the <strong>Import Gap</strong>. Small states routinely import the surveillance technologies and the resulting coercive capacity from foreign vendors. However, they rarely import the corresponding legal safeguards, oversight mechanisms, or algorithmic auditing capabilities.
          </p>
          <p>
            This leaves institutions—such as universities, local municipalities, and regional agencies—highly vulnerable. Without a sovereign framework for algorithmic governance, the imported stack operates unchecked.
          </p>
        </section>

        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 mt-8">
          <h3 className="font-bold text-lg mb-2">Why Algorithmic Sovereignty?</h3>
          <p className="text-gray-700 text-sm">
            Algorithmic Sovereignty is the assertion that a democratic society must have the architectural and legal capacity to govern the technologies deployed within its borders. It requires moving beyond piece-meal privacy policies and enacting structural, institutional minimum standards before technology is adopted.
          </p>
        </div>
      </div>
    </>
  );
}
