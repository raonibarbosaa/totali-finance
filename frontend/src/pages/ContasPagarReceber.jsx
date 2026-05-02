import { useState } from 'react';

export default function ContasPagarReceber() {
  const [tab, setTab] = useState('PAYABLE');
  return (
    <div className="p-6">
      <div className="flex gap-2 mb-6">
        <button onClick={() => setTab('PAYABLE')}
          className={`px-5 py-2 rounded-xl text-sm font-medium ${tab === 'PAYABLE' ? 'bg-[#152740] text-white' : 'bg-gray-100 text-gray-600'}`}>
          Contas a Pagar
        </button>
        <button onClick={() => setTab('RECEIVABLE')}
          className={`px-5 py-2 rounded-xl text-sm font-medium ${tab === 'RECEIVABLE' ? 'bg-[#152740] text-white' : 'bg-gray-100 text-gray-600'}`}>
          Contas a Receber
        </button>
      </div>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center text-gray-400">
        <p className="font-medium text-[#152740]">{tab === 'PAYABLE' ? 'Contas a Pagar' : 'Contas a Receber'}</p>
        <p className="text-sm mt-1">Modulo em integracao</p>
      </div>
    </div>
  );
}
