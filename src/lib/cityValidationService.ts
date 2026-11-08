/**
 * Serviço de Validação e Autocompletar de Cidades Brasileiras por Estado (UF)
 * Integra a base oficial do IBGE com cache em memória e localStorage,
 * além de dicionário estático embarcado para funcionamento offline-first imediato.
 */

export const ESTADOS_BRASIL = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
];

export function normalizeCityText(text?: string): string {
  if (!text) return '';
  return text
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

// Cidades de referência rápida embarcadas para garantir validação instantânea e offline
export const BASE_CITIES_BY_STATE: Record<string, string[]> = {
  MG: [
    'Belo Horizonte', 'Contagem', 'Betim', 'Ribeirão das Neves', 'Santa Luzia',
    'Ibirité', 'Sabará', 'Nova Lima', 'Vespasiano', 'Lagoa Santa', 'Sete Lagoas',
    'Sarzedo', 'Igarapé', 'Brumadinho', 'Mário Campos', 'São Joaquim de Bicas',
    'Mateus Leme', 'Juatuba', 'Esmeraldas', 'Florestal', 'Itaúna', 'Pará de Minas',
    'Divinópolis', 'Uberlândia', 'Uberaba', 'Juiz de Fora', 'Montes Claros',
    'Ipatinga', 'Coronel Fabriciano', 'Timóteo', 'Governador Valadares',
    'Poços de Caldas', 'Pouso Alegre', 'Varginha', 'Passos', 'Lavras',
    'Itajubá', 'Araguari', 'Patos de Minas', 'Alfenas', 'Três Corações',
    'São João del-Rei', 'Barbacena', 'Conselheiro Lafaiete', 'Congonhas',
    'Ouro Preto', 'Mariana', 'Itabira', 'João Monlevade', 'Caratinga',
    'Manhuaçu', 'Muriaé', 'Ubá', 'Viçosa', 'Cataguases', 'Leopoldina',
    'Araxá', 'Unaí', 'Paracatu', 'Curvelo', 'Diamantina', 'Teófilo Otoni'
  ],
  SP: [
    'São Paulo', 'Guarulhos', 'Campinas', 'São Bernardo do Campo', 'Santo André',
    'São José dos Campos', 'Osasco', 'Ribeirão Preto', 'Sorocaba', 'Mauá',
    'São José do Rio Preto', 'Santos', 'Mogi das Cruzes', 'Diadema', 'Jundiaí',
    'Piracicaba', 'Carapicuíba', 'Bauru', 'Itaquaquecetuba', 'São Vicente',
    'Franca', 'Praia Grande', 'Guarujá', 'Taubaté', 'Limeira', 'Suzano',
    'Taboão da Serra', 'Sumaré', 'Barueri', 'Embu das Artes', 'São Carlos',
    'Indaiatuba', 'Cotia', 'Marília', 'Americana', 'Jacareí', 'Araraquara',
    'Itapevi', 'Presidente Prudente', 'Hortolândia', 'Rio Claro', 'Araçatuba',
    'Santa Bárbara d\'Oeste', 'Ferraz de Vasconcelos', 'Francisco Morato',
    'Itapecerica da Serra', 'Bragança Paulista', 'Pindamonhangaba', 'Ititu',
    'Itapetininga', 'São Caetano do Sul', 'Franco da Rocha', 'Mogi Guaçu',
    'Jaú', 'Atibaia', 'Santana de Parnaíba', 'Botucatu', 'Votorantim'
  ],
  RJ: [
    'Rio de Janeiro', 'São Gonçalo', 'Duque de Caxias', 'Nova Iguaçu', 'Niterói',
    'Belford Roxo', 'São João de Meriti', 'Campos dos Goytacazes', 'Petrópolis',
    'Volta Redonda', 'Macaé', 'Magé', 'Itaboraí', 'Cabo Frio', 'Angra dos Reis',
    'Nova Friburgo', 'Barra Mansa', 'Teresópolis', 'Mesquita', 'Nilópolis',
    'Maricá', 'Queimados', 'Rio das Ostras', 'Resende', 'Araruama', 'Itaguaí',
    'São Pedro da Aldeia', 'Japeri', 'Itaperuna', 'Barra do Piraí', 'Saquarema',
    'Seropédica', 'Três Rios', 'Valença', 'Guapimirim', 'Rio Bonito', 'Cachoeiras de Macacu'
  ],
  PR: [
    'Curitiba', 'Londrina', 'Maringá', 'Ponta Grossa', 'Cascavel',
    'São José dos Pinhais', 'Foz do Iguaçu', 'Colombo', 'Guarapuava', 'Paranaguá',
    'Araucária', 'Toledo', 'Apucarana', 'Pinhais', 'Campo Largo', 'Arapongas',
    'Almirante Tamandaré', 'Piraquara', 'Umuarama', 'Cambé', 'Fazenda Rio Grande',
    'Sarandi', 'Campo Mourão', 'Francisco Beltrão', 'Paranavaí', 'Pato Branco'
  ],
  RS: [
    'Porto Alegre', 'Caxias do Sul', 'Canoas', 'Pelotas', 'Santa Maria',
    'Gravataí', 'Viamão', 'Novo Hamburgo', 'São Leopoldo', 'Rio Grande',
    'Alvorada', 'Passo Fundo', 'Sapucaia do Sul', 'Uruguaiana', 'Santa Cruz do Sul',
    'Cachoeirinha', 'Bento Gonçalves', 'Bagé', 'Erechim', 'Guaíba'
  ],
  SC: [
    'Florianópolis', 'Joinville', 'Blumenau', 'São José', 'Criciúma',
    'Chapecó', 'Itajaí', 'Jaraguá do Sul', 'Palhoça', 'Lages',
    'Balneário Camboriú', 'Brusque', 'Tubarão', 'São Bento do Sul', 'Camboriú',
    'Navegantes', 'Caçador', 'Concórdia', 'Rio do Sul', 'Gaspar'
  ],
  BA: [
    'Salvador', 'Feira de Santana', 'Vitória da Conquista', 'Camaçari', 'Juazeiro',
    'Itabuna', 'Lauro de Freitas', 'Ilhéus', 'Jequié', 'Teixeira de Freitas',
    'Barreiras', 'Alagoinhas', 'Porto Seguro', 'Simões Filho', 'Paulo Afonso'
  ],
  GO: [
    'Goiânia', 'Aparecida de Goiânia', 'Anápolis', 'Rio Verde', 'Águas Lindas de Goiás',
    'Luziânia', 'Valparaíso de Goiás', 'Trindade', 'Formosa', 'Senador Canedo',
    'Itumbiara', 'Catalão', 'Jataí', 'Planaltina', 'Caldas Novas'
  ],
  ES: [
    'Vitória', 'Vila Velha', 'Serra', 'Cariacica', 'Cachoeiro de Itapemirim',
    'Linhares', 'São Mateus', 'Colatina', 'Guarapari', 'Aracruz', 'Viana'
  ],
  DF: [
    'Brasília', 'Ceilândia', 'Taguatinga', 'Samambaia', 'Plano Piloto',
    'Águas Claras', 'Guará', 'Gama', 'Santa Maria', 'Sobradinho'
  ],
  PE: [
    'Recife', 'Jaboatão dos Guararapes', 'Olinda', 'Caruaru', 'Petrolina',
    'Paulista', 'Cabo de Santo Agostinho', 'Camaragibe', 'Garanhuns', 'Vitória de Santo Antão'
  ],
  CE: [
    'Fortaleza', 'Caucaia', 'Juazeiro do Norte', 'Maracanaú', 'Sobral',
    'Crato', 'Itapipoca', 'Maranguape', 'Iguatu', 'Quixadá'
  ]
};

// Cache em memória durante a sessão
const memoryCitiesCache = new Map<string, string[]>();

/**
 * Carrega a lista completa de cidades para a UF indicada.
 * Tenta buscar da API oficial do IBGE e armazena em cache (localStorage + memória).
 * Caso esteja offline ou a requisição falhe, utiliza a base interna de contingência.
 */
export async function loadCitiesForState(uf: string): Promise<string[]> {
  const cleanUf = (uf || 'MG').trim().toUpperCase();

  // 1. Verifica cache em memória
  if (memoryCitiesCache.has(cleanUf)) {
    return memoryCitiesCache.get(cleanUf)!;
  }

  // 2. Verifica cache persistente no localStorage
  const storageKey = `agd_cities_ibge_${cleanUf}`;
  try {
    const cached = localStorage.getItem(storageKey);
    if (cached) {
      const parsed: string[] = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) {
        memoryCitiesCache.set(cleanUf, parsed);
        return parsed;
      }
    }
  } catch {
    // Continua sem falhar
  }

  // 3. Consulta API pública do IBGE
  try {
    const response = await fetch(
      `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${cleanUf}/municipios`,
      { headers: { Accept: 'application/json' } }
    );
    if (response.ok) {
      const data: Array<{ nome: string }> = await response.json();
      if (Array.isArray(data) && data.length > 0) {
        const sorted = data.map((item) => item.nome).sort((a, b) => a.localeCompare(b, 'pt-BR'));
        memoryCitiesCache.set(cleanUf, sorted);
        try {
          localStorage.setItem(storageKey, JSON.stringify(sorted));
        } catch {
          // Ignora limitações de storage
        }
        return sorted;
      }
    }
  } catch {
    // Falha de rede ou sandbox - usa contingência
  }

  // 4. Contingência embarcada
  const fallback = BASE_CITIES_BY_STATE[cleanUf] || ['Belo Horizonte', 'Contagem', 'Betim'];
  const sortedFallback = [...fallback].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  memoryCitiesCache.set(cleanUf, sortedFallback);
  return sortedFallback;
}

/**
 * Resultado da busca e validação de cidades
 */
export interface CitySearchResult {
  query: string;
  uf: string;
  matches: string[];
  isValidExact: boolean;
  exactCityName?: string;
  totalMatches: number;
}

/**
 * Valida e busca cidades por nome e estado.
 * Identifica se o termo digitado corresponde a uma cidade existente e retorna as sugestões ordenadas.
 */
export async function searchAndValidateCity(
  cityQuery: string,
  uf: string
): Promise<CitySearchResult> {
  const cleanQuery = (cityQuery || '').trim();
  const cleanUf = (uf || 'MG').trim().toUpperCase();
  const cities = await loadCitiesForState(cleanUf);

  if (!cleanQuery) {
    return {
      query: cleanQuery,
      uf: cleanUf,
      matches: [],
      isValidExact: false,
      totalMatches: 0
    };
  }

  const queryNorm = normalizeCityText(cleanQuery);

  // Procura correspondência exata (insensível a acentos e maiúsculas/minúsculas)
  const exactMatch = cities.find((c) => normalizeCityText(c) === queryNorm);

  // Procura cidades que começam com ou contenham a query
  const startsWithMatches: string[] = [];
  const containsMatches: string[] = [];

  for (const c of cities) {
    const cityNorm = normalizeCityText(c);
    if (cityNorm === queryNorm) {
      continue; // Exata já foi identificada
    }
    if (cityNorm.startsWith(queryNorm)) {
      startsWithMatches.push(c);
    } else if (cityNorm.includes(queryNorm)) {
      containsMatches.push(c);
    }
  }

  const combined = [
    ...(exactMatch ? [exactMatch] : []),
    ...startsWithMatches,
    ...containsMatches
  ];

  return {
    query: cleanQuery,
    uf: cleanUf,
    matches: combined.slice(0, 12), // Limita sugestões imediatas para melhor fluidez visual
    isValidExact: Boolean(exactMatch),
    exactCityName: exactMatch,
    totalMatches: combined.length
  };
}
