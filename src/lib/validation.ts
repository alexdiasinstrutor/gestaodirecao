// Algoritmos de Validação, Segurança e Formatação (LGPD e Regras de Negócio)

/**
 * Validação rigorosa dos dígitos verificadores do CPF (Algoritmo Oficial da Receita Federal)
 */
export function isValidCPF(cpfRaw: string): boolean {
  if (!cpfRaw) return false;
  const cpf = cpfRaw.replace(/\D/g, '');

  if (cpf.length !== 11) return false;

  // Rejeita sequências repetidas (00000000000, 11111111111, etc.)
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  // Primeiro dígito verificador
  let soma = 0;
  for (let i = 0; i < 9; i++) {
    soma += parseInt(cpf.charAt(i), 10) * (10 - i);
  }
  let resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(cpf.charAt(9), 10)) return false;

  // Segundo dígito verificador
  soma = 0;
  for (let i = 0; i < 10; i++) {
    soma += parseInt(cpf.charAt(i), 10) * (11 - i);
  }
  resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(cpf.charAt(10), 10)) return false;

  return true;
}

/**
 * Máscara LGPD do CPF para exibição segura sem vazamento de dados sensíveis
 * Exemplo: 123.456.789-01 -> ***.***.789-01
 */
export function maskCPF(cpfRaw: string): string {
  const digits = cpfRaw.replace(/\D/g, '');
  if (digits.length !== 11) return '***.***.***-**';
  return `***.***.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
}

/**
 * Retorna os últimos 4 dígitos do CPF
 */
export function getCPFLast4(cpfRaw: string): string {
  const digits = cpfRaw.replace(/\D/g, '');
  return digits.slice(-4);
}

/**
 * Gera fingerprint determinístico do CPF (Simulação segura para busca sem expor CPF em texto)
 */
export function generateCPFFingerprint(cpfRaw: string): string {
  const clean = cpfRaw.replace(/\D/g, '');
  let hash = 0;
  for (let i = 0; i < clean.length; i++) {
    const char = clean.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash | 0;
  }
  return `fp_${Math.abs(hash).toString(16).padStart(8, '0')}`;
}

/**
 * Validação rigorosa de Maioridade (Norma CONTRAN / Código de Trânsito Brasileiro e Requisito 18+)
 * Não é permitido o cadastro de alunos menores que 18 anos.
 */
export function calculateAge(birthDateString: string): number {
  if (!birthDateString) return 0;
  const parts = birthDateString.split('-');
  if (parts.length !== 3) return 0;

  const birthYear = parseInt(parts[0], 10);
  const birthMonth = parseInt(parts[1], 10) - 1; // 0-indexed
  const birthDay = parseInt(parts[2], 10);

  const today = new Date();
  const birth = new Date(birthYear, birthMonth, birthDay);

  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();

  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age--;
  }

  return age;
}

export function validateMinimumAge(birthDateString: string): { valid: boolean; age: number; error?: string } {
  if (!birthDateString) {
    return { valid: false, age: 0, error: 'Data de nascimento é obrigatória.' };
  }

  const birth = new Date(birthDateString);
  const today = new Date();

  if (isNaN(birth.getTime())) {
    return { valid: false, age: 0, error: 'Data de nascimento em formato inválido.' };
  }

  if (birth > today) {
    return { valid: false, age: 0, error: 'A data de nascimento não pode ser no futuro.' };
  }

  const age = calculateAge(birthDateString);

  if (age < 18) {
    return {
      valid: false,
      age,
      error: `Cadastro não permitido: O aluno possui ${age} ano(s). De acordo com as normas do CTB e diretrizes do sistema, a idade mínima obrigatória é de 18 anos completos.`
    };
  }

  return { valid: true, age };
}

/**
 * Formatação de moeda BRL a partir de centavos
 */
export function formatCurrencyBRL(centavos: number): string {
  const reais = (centavos || 0) / 100;
  return reais.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

/**
 * Formatação de telefone para padrão brasileiro (11) 99999-9999
 */
export function formatPhone(phone: string): string {
  const digits = (phone || '').replace(/\D/g, '');
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return phone;
}

/**
 * Converte data ISO (YYYY-MM-DD ou YYYY-MM-DDTHH:mm:ss.sssZ) para formato brasileiro DD/MM/YYYY
 */
export function formatDateBR(dateInput: string | Date | undefined | null): string {
  if (!dateInput) return '';

  if (dateInput instanceof Date) {
    if (isNaN(dateInput.getTime())) return '';
    const dia = String(dateInput.getDate()).padStart(2, '0');
    const mes = String(dateInput.getMonth() + 1).padStart(2, '0');
    const ano = dateInput.getFullYear();
    return `${dia}/${mes}/${ano}`;
  }

  const clean = String(dateInput).trim();

  // Se já for DD/MM/YYYY
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(clean)) {
    return clean;
  }

  // Se for YYYY-MM-DD ou formato ISO com YYYY-MM-DD no início
  const matchYMD = clean.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (matchYMD) {
    const [, ano, mes, dia] = matchYMD;
    return `${dia}/${mes}/${ano}`;
  }

  // Fallback seguro via objeto Date
  try {
    const d = new Date(clean);
    if (!isNaN(d.getTime())) {
      const dia = String(d.getDate()).padStart(2, '0');
      const mes = String(d.getMonth() + 1).padStart(2, '0');
      const ano = d.getFullYear();
      return `${dia}/${mes}/${ano}`;
    }
  } catch {
    // fallback
  }

  return clean;
}

/**
 * Converte data ISO para formato brasileiro com data e hora DD/MM/YYYY às HH:mm
 */
export function formatDateTimeBR(dateInput: string | Date | undefined | null): string {
  if (!dateInput) return '';
  try {
    const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    if (d && !isNaN(d.getTime())) {
      const dia = String(d.getDate()).padStart(2, '0');
      const mes = String(d.getMonth() + 1).padStart(2, '0');
      const ano = d.getFullYear();
      const hora = String(d.getHours()).padStart(2, '0');
      const min = String(d.getMinutes()).padStart(2, '0');
      return `${dia}/${mes}/${ano} às ${hora}:${min}`;
    }
  } catch {
    // fallback
  }
  return formatDateBR(dateInput);
}
