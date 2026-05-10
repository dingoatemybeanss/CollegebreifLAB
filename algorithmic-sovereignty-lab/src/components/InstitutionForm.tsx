import React, { useState } from 'react';
import { InstitutionType } from '@/lib/types';

interface InstitutionFormProps {
  onSubmit: (data: { name: string; country: string; type: InstitutionType }) => void;
}

export default function InstitutionForm({ onSubmit }: InstitutionFormProps) {
  const [name, setName] = useState('');
  const [country, setCountry] = useState('Dominican Republic');
  const [type, setType] = useState<InstitutionType>(InstitutionType.Government);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ name, country, type });
  };

  return (
    <div className="card max-w-lg mx-auto">
      <h2 className="text-xl font-bold mb-4 text-blue-800">Institution Details</h2>
      <p className="text-sm text-gray-600 mb-6">
        Before starting the risk profile, please provide details about the institution evaluating the technology.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Institution Name</label>
          <input
            type="text"
            required
            className="input-field"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. UASD, Ministry of Interior"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Country</label>
          <input
            type="text"
            required
            className="input-field"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Institution Type</label>
          <select
            className="input-field"
            value={type}
            onChange={(e) => setType(e.target.value as InstitutionType)}
          >
            {Object.values(InstitutionType).map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        <button type="submit" className="w-full btn-primary mt-6">
          Start Assessment
        </button>
      </form>
    </div>
  );
}
