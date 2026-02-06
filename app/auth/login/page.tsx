import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { Button } from '../../../components/UI/Button';
import { useNavigate } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { normalizeAuthError } from '../../../lib/errorMessages';

export const LoginPage: React.FC = () => {
  const { signIn, signUp, user, profile } = useAuth();
  const navigate = useNavigate();
  
  const [isRegistering, setIsRegistering] = useState(false);
  const [localLoading, setLocalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // Auto-redirect if logged in
  useEffect(() => {
    if (user && profile) {
        navigate('/dashboard');
    }
  }, [user, profile, navigate]);

  // Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLocalLoading(true);

    try {
      if (isRegistering) {
        if (!name) throw new Error("O nome é obrigatório para o cadastro.");
        await signUp(email, password, name);
        setInfo('Conta criada. Se você foi convidado para uma organização, faça login e o acesso será liberado.');
      } else {
        await signIn(email, password);
      }
      // No explicit navigate here; reliance on useEffect above ensures 
      // we only redirect when state is fully propagated.
    } catch (err: any) {
      setError(normalizeAuthError(err));
    } finally {
      setLocalLoading(false);
    }
  };

  const toggleMode = () => {
    setIsRegistering(!isRegistering);
    setError(null);
    setInfo(null);
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-gold/5 rounded-full blur-[120px]"></div>

      <div className="w-full max-w-md bg-surface border border-border p-8 rounded-xl shadow-2xl relative z-10 animate-fade-in">
        <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">V•HUB</h1>
            <p className="text-gray-400">
                {isRegistering ? "Crie sua conta para começar." : "Acesse sua conta para continuar."}
            </p>
        </div>

        {error && (
            <div className="mb-4 bg-red-900/20 border border-red-900/50 p-3 rounded flex items-center gap-2 text-red-200 text-sm">
                <AlertCircle size={16} />
                <span>{error}</span>
            </div>
        )}

        {info && (
            <div className="mb-4 bg-gold/10 border border-gold/30 p-3 rounded text-gold text-sm">
                {info}
            </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
            {isRegistering && (
                <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Nome Completo</label>
                    <input 
                        type="text" 
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full bg-background border border-border rounded-md px-4 py-2 text-white focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold transition-colors"
                        placeholder="Seu Nome"
                    />
                </div>
            )}
            
            <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">E-mail</label>
                <input 
                    type="email" 
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-background border border-border rounded-md px-4 py-2 text-white focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold transition-colors"
                    placeholder="seu@email.com"
                />
            </div>
            
            <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Senha</label>
                <input 
                    type="password" 
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    minLength={6}
                    className="w-full bg-background border border-border rounded-md px-4 py-2 text-white focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold transition-colors"
                    placeholder="••••••••"
                />
            </div>

            <Button type="submit" className="w-full" disabled={localLoading}>
                {localLoading 
                  ? (isRegistering ? 'Criando Conta...' : 'Entrando...') 
                  : (isRegistering ? 'Criar Conta' : 'Entrar')
                }
            </Button>
        </form>

        <div className="mt-6 text-center text-sm">
            <span className="text-gray-500">
                {isRegistering ? "Já possui uma conta?" : "Não possui uma conta?"}
            </span>
            <button 
                onClick={toggleMode}
                className="ml-2 text-gold hover:text-goldHover font-medium focus:outline-none"
            >
                {isRegistering ? "Entrar" : "Cadastrar-se"}
            </button>
        </div>
      </div>
    </div>
  );
};
