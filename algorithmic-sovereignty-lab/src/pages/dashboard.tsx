import React, { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import AuthGuard from '@/components/AuthGuard';
import AssessmentList from '@/components/AssessmentList';
import { db, auth } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { Institution, Assessment } from '@/lib/types';

export default function Dashboard() {
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const user = auth.currentUser;
      if (!user) return;

      try {
        // Fetch Institutions
        const instQuery = query(collection(db, 'institutions'), where('userId', '==', user.uid));
        const instSnapshot = await getDocs(instQuery);
        const fetchedInsts: Institution[] = instSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Institution));

        // Fetch Assessments
        const assQuery = query(collection(db, 'assessments'), where('userId', '==', user.uid));
        const assSnapshot = await getDocs(assQuery);
        const fetchedAssessments: Assessment[] = assSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Assessment));

        setInstitutions(fetchedInsts);
        setAssessments(fetchedAssessments);
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  return (
    <AuthGuard>
      <Head>
        <title>Dashboard - Algorithmic Sovereignty Lab</title>
      </Head>

      <div className="py-8 max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8 border-b pb-4">
          <div>
            <h1 className="text-3xl font-extrabold text-gray-900">Dashboard</h1>
            <p className="text-gray-600 mt-1">Manage your institutional risk assessments.</p>
          </div>
          <Link href="/profiler" className="btn-primary whitespace-nowrap">
            + New Assessment
          </Link>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <p className="text-gray-500">Loading your data...</p>
          </div>
        ) : (
          <AssessmentList institutions={institutions} assessments={assessments} />
        )}
      </div>
    </AuthGuard>
  );
}
