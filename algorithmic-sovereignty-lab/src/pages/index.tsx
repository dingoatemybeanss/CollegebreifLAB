import React from 'react';
import Link from 'next/link';
import Head from 'next/head';

export default function Home() {
  return (
    <>
      <Head>
        <title>Algorithmic Sovereignty Lab</title>
        <meta name="description" content="Evaluating the risk of importing surveillance technologies in small democracies." />
      </Head>

      <div className="space-y-12 py-8">
        <section className="text-center max-w-3xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-gray-900 mb-6">
            Algorithmic Sovereignty Lab
          </h1>
          <p className="text-lg text-gray-600 mb-8">
            A toolkit for institutions in small democracies to evaluate the risks of importing surveillance technologies, facial recognition, and AI trained on personal data.
          </p>
          <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
            <Link href="/profiler" className="btn-primary text-lg px-8 py-3 w-full sm:w-auto">
              Start Risk Profiler
            </Link>
            <Link href="/framework" className="btn-secondary text-lg px-8 py-3 w-full sm:w-auto">
              Read the Framework
            </Link>
          </div>
        </section>

        <section className="grid md:grid-cols-2 gap-8 mt-12">
          <div className="card">
            <h3 className="text-xl font-bold mb-3 text-blue-700">The Surveillance Stack</h3>
            <p className="text-gray-700 mb-4">
              Modern surveillance is not a set of isolated tools, but a combined &quot;stack&quot;quot;stack&quot;stack&quot;quot;: facial recognition, encryption vulnerabilities, and AI training. Together, these form a composite identity profile that fundamentally shifts power to those who control the stack.
            </p>
            <Link href="/framework" className="text-blue-600 font-medium hover:underline">Learn more &rarr;</Link>
          </div>

          <div className="card">
            <h3 className="text-xl font-bold mb-3 text-blue-700">The Import Gap</h3>
            <p className="text-gray-700 mb-4">
              Small democracies often import advanced surveillance tech and coercive capacities without importing the corresponding legal safeguards and regulatory oversight, creating an &quot;Import Gap&quot;quot;Import Gap&quot;Import Gap&quot;quot; that threatens democratic rights.
            </p>
            <Link href="/research" className="text-blue-600 font-medium hover:underline">Read the research &rarr;</Link>
          </div>
        </section>

        <section className="bg-blue-50 border border-blue-100 rounded-xl p-8 text-center max-w-4xl mx-auto mt-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">The Toolkit</h2>
          <p className="text-gray-700 mb-6 max-w-2xl mx-auto">
            Our 10-module toolkit provides a minimum democratic standard for institutions (such as universities and government agencies) to assess tech adoption.
          </p>
          <Link href="/toolkit" className="btn-primary inline-block">
            Explore the 10 Modules
          </Link>
        </section>
      </div>
    </>
  );
}
