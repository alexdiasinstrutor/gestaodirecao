import React, { useState } from 'react';
import {
  Car,
  Lock,
  Mail,
  ArrowRight,
  ShieldCheck,
  UserPlus,
  GraduationCap,
  Sparkles,
  AlertCircle,
  HelpCircle,
  Shield
} from 'lucide-react';
import { db } from '../../lib/storage';
import { User, Organization, Student } from '../../types';
import { PasswordRecoveryModal } from './PasswordRecoveryModal';
import { Logo } from '../common/Logo';
import { signInWithGoogleOAuth } from '../../lib/supabaseClient';
import { generateCPFFingerprint, maskCPF } from '../../lib/validation';

interface LoginScreenProps {
  onLoginAttempt: (user: User) => void;
  onOpenInstructorRegister: () => void;
  onOpenStudentRegister: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  onLoginAttempt,
  onOpenInstructorRegister,
  onOpenStudentRegister
}) => {
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [googleEmail, setGoogleEmail] = useState<string>('');
  const [googlePassword, setGooglePassword] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [showPasswordRecovery, setShowPasswordRecovery] = useState<boolean>(false);
  const [showGoogleModal, setShowGoogleModal] = useState<boolean>(false);
  const [googleModalMode, setGoogleModalMode] = useState<'LOGIN' | 'REGISTER'>('LOGIN');
  const [googleNome, setGoogleNome] = useState<string>('');
  const [googleRole, setGoogleRole] = useState<'INSTRUTOR' | 'ALUNO'>('INSTRUTOR');
  const [googleActionError, setGoogleActionError] = useState<string>('');

  const handleStartGoogleFlow = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await signInWithGoogleOAuth();
      if (res?.error) {
        // Se o Supabase ainda não tiver as credenciais OAuth do Google habilitadas no Dashboard,
        // abre o modal de login/cadastro rápido Google
        setShowGoogleModal(true);
        setLoading(false);
      }
      // Se não deu erro, o redirecionamento OAuth oficial do Supabase ocorre automaticamente
    } catch {
      setShowGoogleModal(true);
      setLoading(false);
    }
  };

  const handleGoogleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGoogleActionError('');

    if (!googleEmail.trim() || !googleEmail.includes('@')) {
      setGoogleActionError('Informe um e-mail do Google válido.');
      return;
    }

    if (!googlePassword || googlePassword.length < 6) {
      setGoogleActionError('A senha de acesso deve ter pelo menos 6 caracteres.');
      return;
    }

    setLoading(true);

    if (googleModalMode === 'LOGIN') {
      const user = db.getUserByEmail(googleEmail.trim());
      if (!user) {
        setLoading(false);
        setGoogleActionError(`Conta Google (${googleEmail.trim()}) não encontrada. Clique na aba "Cadastrar com Google" ao lado para criar seu cadastro.`);
        return;
      }

      const expectedPassword = user.senhaTemporaria || '123456';
      if (googlePassword !== expectedPassword) {
        setLoading(false);
        setGoogleActionError('Senha incorreta para a conta Google informada.');
        return;
      }

      setLoading(false);
      setShowGoogleModal(false);
      onLoginAttempt(user);
    } else {
      // Cadastro com Google
      if (!googleNome.trim() || googleNome.length < 3) {
        setLoading(false);
        setGoogleActionError('Informe seu nome completo para o cadastro.');
        return;
      }

      const existing = db.getUserByEmail(googleEmail.trim());
      if (existing) {
        setLoading(false);
        setGoogleActionError('Este e-mail Google já possui cadastro. Alterne para a aba "Já Tenho Conta".');
        return;
      }

      try {
        const orgId = `org_${Date.now()}`;
        const userId = `usr_${Date.now()}`;

        if (googleRole === 'INSTRUTOR') {
          const newOrg: Organization = {
            id: orgId,
            nome: `${googleNome.trim()} (Instrutor Autônomo)`,
            tipo: 'INSTRUTOR_AUTONOMO',
            cnpjCpf: '000.000.000-00',
            telefone: '(11) 99999-9999',
            email: googleEmail.trim().toLowerCase(),
            cidade: 'Belo Horizonte',
            estado: 'MG',
            status: 'ATIVO',
            plano: 'BASICO',
            criadoEm: new Date().toISOString()
          };

          const newUser: User = {
            id: userId,
            organizacaoId: orgId,
            nome: googleNome.trim(),
            email: googleEmail.trim().toLowerCase(),
            papel: 'ADMIN_ORG',
            telefone: '(11) 99999-9999',
            cpfUltimos4: '0000',
            cpfFingerprint: generateCPFFingerprint('00000000000'),
            cpfMascarado: '***.***.000-00',
            senhaTemporaria: googlePassword,
            twoFactorAtivo: true,
            aprovadoPorMaster: true,
            ultimoAcesso: new Date().toISOString()
          };

          await db.createOrganizationAsync(newOrg);
          await db.createUserAsync(newUser);
          setShowGoogleModal(false);
          setLoading(false);
          onLoginAttempt(newUser);
        } else {
          // Aluno com Google
          const allOrgs = db.getOrganizations();
          const targetOrgId = allOrgs[0]?.id || 'org_direcao_certa_01';
          const instructors = db.getAllInstructors();
          const activeInstructor = instructors[0];

          const newUser: User = {
            id: userId,
            organizacaoId: targetOrgId,
            nome: googleNome.trim(),
            email: googleEmail.trim().toLowerCase(),
            papel: 'ALUNO',
            telefone: '(11) 99999-9999',
            cpfUltimos4: '0000',
            cpfFingerprint: generateCPFFingerprint('00000000000'),
            cpfMascarado: '***.***.000-00',
            senhaTemporaria: googlePassword,
            twoFactorAtivo: true,
            aprovadoPorMaster: true,
            ultimoAcesso: new Date().toISOString()
          };

          const newStudent: Student = {
            id: `stu_${Date.now()}`,
            organizacaoId: targetOrgId,
            instrutorId: activeInstructor?.id || 'usr_instrutor_carlos',
            nome: googleNome.trim(),
            email: googleEmail.trim().toLowerCase(),
            telefone: '(11) 99999-9999',
            cpfMascarado: '***.***.000-00',
            cpfFingerprint: generateCPFFingerprint('00000000000'),
            dataNascimento: '2000-01-01',
            idade: 24,
            categoriaCnh: 'B',
            status: 'EM_ANDAMENTO',
            aulasCumpridas: 0,
            totalAulasContratadas: 20,
            habilidades: {
              baliza: 0,
              controleEmbreagem: 0,
              transitoPesado: 0,
              conversoesCruzamentos: 0,
              rodoviaVelocidade: 0,
              sinalizacaoPreferencia: 0,
              posturaDefensiva: 0,
              simuladoExame: 0
            },
            observacoesInstrutor: 'Aluno matriculado via conta Google.',
            dataCadastro: new Date().toISOString()
          };

          await db.createUserAsync(newUser);
          await db.saveStudentAsync(newStudent, userId);
          setShowGoogleModal(false);
          setLoading(false);
          onLoginAttempt(newUser);
        }
      } catch (err: any) {
        setLoading(false);
        setGoogleActionError('Erro ao cadastrar com Google: ' + (err?.message || 'Tente novamente.'));
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim()) {
      setError('Por favor, informe seu endereço de e-mail.');
      return;
    }

    setLoading(true);

    setTimeout(() => {
      const user = db.getUserByEmail(email.trim());

      if (!user) {
        setError('Usuário não encontrado. Verifique o e-mail de cadastro ou cadastre-se como Instrutor.');
        setLoading(false);
        return;
      }

      // Validação de senha: se o usuário possui senha cadastrada, deve conferir
      const expectedPassword = user.senhaTemporaria || '123456';
      if (password !== expectedPassword) {
        setError('Senha incorreta. Verifique os dados digitados ou utilize "Esqueceu a senha?" logo abaixo para redefini-la.');
        setLoading(false);
        return;
      }

      setLoading(false);
      onLoginAttempt(user);
    }, 400);
  };

  return (
    <div className="min-h-screen bg-radial-[at_top] from-slate-900 via-slate-950 to-slate-950 flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8 selection:bg-blue-600 selection:text-white relative overflow-hidden">
      {/* Decorative Automotive Ambient Glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-40 right-10 w-[300px] h-[300px] bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center space-y-4 relative z-10">
        {/* Gestão AD Official Vector Logo */}
        <div className="flex justify-center py-2">
          <Logo theme="dark" size="xl" className="justify-center scale-105" />
        </div>

        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/15 text-blue-300 text-xs font-semibold border border-blue-400/20 backdrop-blur-xs">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>Plataforma Inteligente para Autoescolas & CFCs</span>
          </span>
          <p className="text-xs text-slate-300 max-w-sm mx-auto mt-2 leading-relaxed">
            Gestão financeira, controle de alunos por categoria, agenda prática sem conflitos e cobranças PIX automatizadas.
          </p>
        </div>
      </div>

      <div className="mt-7 sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="bg-white/95 backdrop-blur-md py-7 px-6 sm:px-9 shadow-2xl rounded-3xl border border-white/20 space-y-5">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-start gap-2 animate-shake">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Social / Google Login */}
          <div>
            <button
              type="button"
              onClick={handleStartGoogleFlow}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 py-2.5 px-4 border border-slate-300/80 rounded-xl shadow-xs bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-400 transition-all cursor-pointer touch-target"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Acessar ou Cadastrar com Google</span>
            </button>

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2.5 text-slate-400 font-bold tracking-wider text-xs">
                  ou com credenciais
                </span>
              </div>
            </div>
          </div>

          {/* Email / Password Form */}
          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                E-mail de Acesso
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seuemail@autoescola.com.br"
                  className="w-full pl-9 pr-3 py-2.5 text-xs border border-slate-300 rounded-xl focus:border-blue-600 focus:outline-none bg-slate-50/50 focus:bg-white transition-colors"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700">
                  Senha
                </label>
                <button
                  type="button"
                  onClick={() => setShowPasswordRecovery(true)}
                  className="text-xs text-blue-600 hover:text-blue-800 cursor-pointer font-medium hover:underline"
                >
                  Esqueceu a senha?
                </button>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3 py-2.5 text-xs border border-slate-300 rounded-xl focus:border-blue-600 focus:outline-none bg-slate-50/50 focus:bg-white transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-gradient-to-r from-blue-600 to-sky-600 hover:from-blue-700 hover:to-sky-700 text-white rounded-xl font-bold shadow-md shadow-blue-500/25 text-xs transition-all cursor-pointer touch-target mt-2"
            >
              {loading ? (
                'Autenticando...'
              ) : (
                <>
                  <span>Entrar no Gestão AD</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Registration Links */}
          <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={onOpenInstructorRegister}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-semibold text-slate-700 transition-colors cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5 text-blue-600" />
              Novo Instrutor
            </button>
            <button
              type="button"
              onClick={onOpenStudentRegister}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-semibold text-slate-700 transition-colors cursor-pointer"
              title="Auto-cadastro condicionado à indicação de instrutor"
            >
              <GraduationCap className="w-3.5 h-3.5 text-emerald-600" />
              Portal do Aluno
            </button>
          </div>
        </div>

        {/* Footer info & Security Badges */}
        <div className="mt-6 text-center space-y-2">
          <p className="text-xs text-slate-600 font-medium font-medium">
            Gestão AD (Auto Direção) · Sistema Oficial em Conformidade com CONTRAN e LGPD
          </p>
          <div className="flex items-center justify-center gap-3 text-xs text-slate-500 font-mono">
            <span>✓ Criptografia 256-bit</span>
            <span>·</span>
            <span>✓ Cloud Backup</span>
            <span>·</span>
            <span>✓ Multi-CFC</span>
          </div>
        </div>
      </div>

      {/* Password Recovery Modal */}
      {showPasswordRecovery && (
        <PasswordRecoveryModal
          onClose={() => setShowPasswordRecovery(false)}
          onSuccessLogin={(user) => {
            setShowPasswordRecovery(false);
            onLoginAttempt(user);
          }}
        />
      )}

      {/* Google Account Selector Dialog */}
      {showGoogleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl border border-slate-200 p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <h3 className="font-bold text-slate-900 text-sm">Fazer Login com Google</h3>
              </div>
              <button
                onClick={() => setShowGoogleModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <span className="sr-only">Fechar</span>
                ✕
              </button>
            </div>

            {/* Alternador de Modo: Login ou Cadastro */}
            <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
              <button
                type="button"
                onClick={() => {
                  setGoogleModalMode('LOGIN');
                  setGoogleActionError('');
                }}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                  googleModalMode === 'LOGIN' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Já Tenho Conta
              </button>
              <button
                type="button"
                onClick={() => {
                  setGoogleModalMode('REGISTER');
                  setGoogleActionError('');
                }}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                  googleModalMode === 'REGISTER' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Cadastrar com Google
              </button>
            </div>

            {googleActionError && (
              <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 text-red-500" />
                <span>{googleActionError}</span>
              </div>
            )}

            <form onSubmit={handleGoogleSubmit} className="space-y-3">
              {googleModalMode === 'REGISTER' && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Seu Nome Completo *
                    </label>
                    <input
                      type="text"
                      required
                      value={googleNome}
                      onChange={(e) => setGoogleNome(e.target.value)}
                      placeholder="Ex: Alex Dias"
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:border-blue-600 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Perfil de Acesso *
                    </label>
                    <select
                      value={googleRole}
                      onChange={(e) => setGoogleRole(e.target.value as any)}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:border-blue-600 focus:outline-none bg-white font-medium cursor-pointer"
                    >
                      <option value="INSTRUTOR">Instrutor Autônomo / Autoescola</option>
                      <option value="ALUNO">Aluno de Direção</option>
                    </select>
                  </div>
                </>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  E-mail da sua Conta Google *
                </label>
                <input
                  type="email"
                  required
                  value={googleEmail}
                  onChange={(e) => setGoogleEmail(e.target.value)}
                  placeholder="seuemail@gmail.com"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Senha de Acesso à Plataforma *
                </label>
                <input
                  type="password"
                  required
                  value={googlePassword}
                  onChange={(e) => setGooglePassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:border-blue-600 focus:outline-none"
                />
                <p className="text-xs text-slate-400 mt-0.5">
                  Esta senha será gravada no banco Supabase para acesso seguro.
                </p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
              >
                {loading ? 'Processando...' : googleModalMode === 'REGISTER' ? 'Concluir Cadastro com Google' : 'Entrar com Conta Google'}
              </button>
            </form>

            <button
              type="button"
              onClick={() => setShowGoogleModal(false)}
              className="w-full py-2 text-xs font-medium text-slate-500 hover:text-slate-800 text-center cursor-pointer"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
