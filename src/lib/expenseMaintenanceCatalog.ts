import type { ExpenseCategory } from '../types';

export interface ExpenseMaintenanceItem {
  id: string;
  label: string;
  categoria: ExpenseCategory;
}

export const EXPENSE_OTHER_OPTION = 'OUTRO';

/**
 * Catálogo oficial com os 25 principais tipos de manutenção e despesas
 * de veículos de instrução prática (+ opção OUTRO para digitação manual).
 */
export const EXPENSE_MAINTENANCE_ITEMS: ExpenseMaintenanceItem[] = [
  { id: 'TROCA_OLEO', label: 'Troca de Óleo do Motor', categoria: 'MANUTENCAO_VEICULO' },
  { id: 'ABASTECIMENTO', label: 'Abastecimento (Gasolina / Etanol / GNV / Diesel)', categoria: 'COMBUSTIVEL' },
  { id: 'TROCA_PNEU', label: 'Troca de Pneu', categoria: 'MANUTENCAO_VEICULO' },
  { id: 'COMPRA_PNEU', label: 'Compra de Pneu(s) Novo(s)', categoria: 'MANUTENCAO_VEICULO' },
  { id: 'TROCA_EMBREAGEM', label: 'Troca de Embreagem (Kit Embreagem / Platô / Disco)', categoria: 'MANUTENCAO_VEICULO' },
  { id: 'PASTILHAS_FREIO', label: 'Troca de Pastilhas de Freio', categoria: 'MANUTENCAO_VEICULO' },
  { id: 'DISCOS_FREIO', label: 'Troca de Discos / Tambores de Freio', categoria: 'MANUTENCAO_VEICULO' },
  { id: 'FLUIDO_FREIO', label: 'Troca / Reposição de Fluido de Freio', categoria: 'MANUTENCAO_VEICULO' },
  { id: 'ALINHAMENTO_BALANCEAMENTO', label: 'Alinhamento e Balanceamento', categoria: 'MANUTENCAO_VEICULO' },
  { id: 'CORREIA_DENTADA', label: 'Troca de Correia Dentada / Correia de Acessórios', categoria: 'MANUTENCAO_VEICULO' },
  { id: 'VELAS_CABOS', label: 'Troca de Velas e Cabos de Ignição', categoria: 'MANUTENCAO_VEICULO' },
  { id: 'FILTROS_GERAIS', label: 'Troca de Filtros (Óleo, Ar, Combustível e Cabine)', categoria: 'MANUTENCAO_VEICULO' },
  { id: 'BATERIA', label: 'Troca / Compra de Bateria Automotiva', categoria: 'MANUTENCAO_VEICULO' },
  { id: 'AMORTECEDORES', label: 'Troca de Amortecedores e Molas', categoria: 'MANUTENCAO_VEICULO' },
  { id: 'SUSPENSAO_BUCHAS', label: 'Reparo de Suspensão (Bandejas, Buchas, Pivôs e Terminais)', categoria: 'MANUTENCAO_VEICULO' },
  { id: 'LIMPEZA_BICOS', label: 'Limpeza de Bicos Injetores e Corpo de Borboleta', categoria: 'MANUTENCAO_VEICULO' },
  { id: 'ARREFECIMENTO_RADIADOR', label: 'Manutenção de Arrefecimento / Radiador / Aditivo', categoria: 'MANUTENCAO_VEICULO' },
  { id: 'DUPLO_COMANDO', label: 'Manutenção / Regulagem de Duplo Comando (Pedais de Instrução)', categoria: 'MANUTENCAO_VEICULO' },
  { id: 'CAMBIO_TRANSMISSAO', label: 'Manutenção de Câmbio / Transmissão e Trambulador', categoria: 'MANUTENCAO_VEICULO' },
  { id: 'ELETRICA_LAMPADAS', label: 'Elétrica Automotiva (Lâmpadas, Setas, Fusíveis e Alternador)', categoria: 'MANUTENCAO_VEICULO' },
  { id: 'AR_CONDICIONADO', label: 'Manutenção / Higienização / Carga de Gás do Ar-Condicionado', categoria: 'MANUTENCAO_VEICULO' },
  { id: 'PALHETAS_LIMPADOR', label: 'Troca de Palhetas do Limpador de Para-brisa', categoria: 'MANUTENCAO_VEICULO' },
  { id: 'LAVAGEM_HIGIENIZACAO', label: 'Lavagem e Higienização Completa do Veículo', categoria: 'MANUTENCAO_VEICULO' },
  { id: 'BORRACHARIA_REPARO', label: 'Borracharia / Conserto / Rodízio de Pneus', categoria: 'MANUTENCAO_VEICULO' },
  { id: 'VISTORIA_DETRAN', label: 'Vistoria Veicular / Licenciamento / Taxas DETRAN', categoria: 'TAXAS_DETRAN' },
];

export function findMaintenanceItemById(id: string): ExpenseMaintenanceItem | undefined {
  return EXPENSE_MAINTENANCE_ITEMS.find((item) => item.id === id);
}
