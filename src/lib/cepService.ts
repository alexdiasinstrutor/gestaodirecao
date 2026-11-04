/**
 * Serviço de Validação e Consulta Automática de CEP (ViaCEP + Fallback BrasilAPI)
 * Localiza Logradouro, Bairro, Cidade e UF automaticamente a partir do CEP,
 * deixando Número e Complemento para preenchimento do usuário.
 */

export interface BrazilianState {
  uf: string;
  nome: string;
}

export const ESTADOS_BRASIL: BrazilianState[] = [
  { uf: 'AC', nome: 'Acre' },
  { uf: 'AL', nome: 'Alagoas' },
  { uf: 'AP', nome: 'Amapá' },
  { uf: 'AM', nome: 'Amazonas' },
  { uf: 'BA', nome: 'Bahia' },
  { uf: 'CE', nome: 'Ceará' },
  { uf: 'DF', nome: 'Distrito Federal' },
  { uf: 'ES', nome: 'Espírito Santo' },
  { uf: 'GO', nome: 'Goiás' },
  { uf: 'MA', nome: 'Maranhão' },
  { uf: 'MT', nome: 'Mato Grosso' },
  { uf: 'MS', nome: 'Mato Grosso do Sul' },
  { uf: 'MG', nome: 'Minas Gerais' },
  { uf: 'PA', nome: 'Pará' },
  { uf: 'PB', nome: 'Paraíba' },
  { uf: 'PR', nome: 'Paraná' },
  { uf: 'PE', nome: 'Pernambuco' },
  { uf: 'PI', nome: 'Piauí' },
  { uf: 'RJ', nome: 'Rio de Janeiro' },
  { uf: 'RN', nome: 'Rio Grande do Norte' },
  { uf: 'RS', nome: 'Rio Grande do Sul' },
  { uf: 'RO', nome: 'Rondônia' },
  { uf: 'RR', nome: 'Roraima' },
  { uf: 'SC', nome: 'Santa Catarina' },
  { uf: 'SP', nome: 'São Paulo' },
  { uf: 'SE', nome: 'Sergipe' },
  { uf: 'TO', nome: 'Tocantins' }
];

export interface CepLookupResult {
  success: boolean;
  cep: string;
  logradouro: string;
  bairro: string;
  cidade: string;
  estado: string;
  stateMismatch?: boolean;
  message?: string;
}

/**
 * Formata string numérica para o padrão de CEP brasileiro: 00000-000
 */
export function formatCEP(raw: string): string {
  const digits = (raw || '').replace(/\D/g, '').slice(0, 8);
  if (digits.length > 5) {
    return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  }
  return digits;
}

/**
 * Valida se o CEP possui exatamente 8 dígitos numéricos válidos
 */
export function isValidCEPFormat(raw: string): boolean {
  const digits = (raw || '').replace(/\D/g, '');
  if (digits.length !== 8) return false;
  if (/^(\d)\1{7}$/.test(digits)) return false;
  return true;
}

/**
 * Formata o endereço completo em uma linha legível para exibição em tabelas e fichas
 */
export function formatFullAddress(addr: {
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
}): string {
  const parts: string[] = [];
  if (addr.logradouro) {
    const num = addr.numero ? `, nº ${addr.numero}` : ', S/N';
    const comp = addr.complemento ? ` (${addr.complemento})` : '';
    parts.push(`${addr.logradouro}${num}${comp}`);
  }
  if (addr.bairro) {
    parts.push(addr.bairro);
  }
  if (addr.cidade || addr.estado) {
    parts.push(`${addr.cidade || ''}${addr.cidade && addr.estado ? '/' : ''}${addr.estado || ''}`);
  }
  if (addr.cep) {
    parts.push(`CEP ${formatCEP(addr.cep)}`);
  }
  return parts.join(' · ') || 'Endereço não informado';
}

/**
 * Consulta o CEP na base nacional (ViaCEP com fallback automático para BrasilAPI)
 */
export async function lookupAddressByCEP(
  cepRaw: string,
  selectedUf?: string
): Promise<CepLookupResult> {
  const cleanCep = (cepRaw || '').replace(/\D/g, '');

  if (!isValidCEPFormat(cleanCep)) {
    return {
      success: false,
      cep: formatCEP(cleanCep),
      logradouro: '',
      bairro: '',
      cidade: '',
      estado: selectedUf || 'SP',
      message: 'Informe um CEP válido com 8 dígitos numéricos (Ex: 30140-071).'
    };
  }

  // 1. Tentativa Primária: ViaCEP
  try {
    const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
    if (response.ok) {
      const data = await response.json();
      if (!data.erro) {
        const returnedUf = (data.uf || '').toUpperCase();
        const mismatch = Boolean(selectedUf && returnedUf && selectedUf.toUpperCase() !== returnedUf);

        return {
          success: true,
          cep: formatCEP(cleanCep),
          logradouro: data.logradouro || '',
          bairro: data.bairro || '',
          cidade: data.localidade || '',
          estado: returnedUf || selectedUf || 'SP',
          stateMismatch: mismatch,
          message: mismatch
            ? `CEP localizado em ${data.localidade}/${returnedUf} (Estado atualizado automaticamente de ${selectedUf} para ${returnedUf}). Preencha o Número e Complemento.`
            : `Endereço localizado em ${data.localidade}/${returnedUf}! Preencha apenas o Número e o Complemento.`
        };
      }
    }
  } catch {
    // Segue para o fallback BrasilAPI
  }

  // 2. Tentativa Secundária (Fallback): BrasilAPI
  try {
    const response = await fetch(`https://brasilapi.com.br/api/cep/v1/${cleanCep}`);
    if (response.ok) {
      const data = await response.json();
      if (data && data.city) {
        const returnedUf = (data.state || '').toUpperCase();
        const mismatch = Boolean(selectedUf && returnedUf && selectedUf.toUpperCase() !== returnedUf);

        return {
          success: true,
          cep: formatCEP(cleanCep),
          logradouro: data.street || '',
          bairro: data.neighborhood || '',
          cidade: data.city || '',
          estado: returnedUf || selectedUf || 'SP',
          stateMismatch: mismatch,
          message: mismatch
            ? `CEP localizado em ${data.city}/${returnedUf} (Estado ajustado automaticamente para ${returnedUf}). Preencha o Número e Complemento.`
            : `Endereço localizado em ${data.city}/${returnedUf}! Preencha apenas o Número e o Complemento.`
        };
      }
    }
  } catch {
    // Caso o usuário esteja sem internet no momento, permite preenchimento manual
    return {
      success: false,
      cep: formatCEP(cleanCep),
      logradouro: '',
      bairro: '',
      cidade: '',
      estado: selectedUf || 'SP',
      message: 'Não foi possível consultar o CEP online agora. Você pode preencher os campos de endereço manualmente.'
    };
  }

  return {
    success: false,
    cep: formatCEP(cleanCep),
    logradouro: '',
    bairro: '',
    cidade: '',
    estado: selectedUf || 'SP',
    message: 'CEP não encontrado na base dos Correios. Verifique os números digitados.'
  };
}
