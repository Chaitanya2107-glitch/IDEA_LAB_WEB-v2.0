import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';

const FloatingLoginBtn: React.FC = () => {
  const navigate = useNavigate();

  return (
    <button 
      onClick={() => navigate('/staff-login')}
      className="fixed bottom-6 right-6 z-40 inline-flex h-12 w-12 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-lg transition-colors hover:bg-slate-50 hover:text-slate-900"
      title="Staff Login"
      aria-label="Staff Login"
    >
      <ShieldCheck className="h-5 w-5 text-brand-500" aria-hidden="true" />
    </button>
  );
};

export default FloatingLoginBtn;