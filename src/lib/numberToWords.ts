/**
 * Converte valor em centavos para texto por extenso em português (BRL)
 */
export function numberToWordsBRL(centavos: number): string {
  const reais = Math.floor((centavos || 0) / 100);
  const centavosResto = (centavos || 0) % 100;

  if (reais === 0 && centavosResto === 0) return 'zero reais';

  const unidades = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove'];
  const dezenasEspeciais: Record<number, string> = {
    10: 'dez', 11: 'onze', 12: 'doze', 13: 'treze', 14: 'quatorze',
    15: 'quinze', 16: 'dezesseis', 17: 'dezessete', 18: 'dezoito', 19: 'dezenove'
  };
  const dezenas = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
  const centenas = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];

  function converterGrupo(n: number): string {
    if (n === 0) return '';
    if (n === 100) return 'cem';

    const c = Math.floor(n / 100);
    const d = Math.floor((n % 100) / 10);
    const u = n % 10;

    const partes: string[] = [];
    if (c > 0) partes.push(centenas[c]);

    const resto = n % 100;
    if (resto >= 10 && resto <= 19) {
      partes.push(dezenasEspeciais[resto]);
    } else {
      if (d > 0) partes.push(dezenas[d]);
      if (u > 0) partes.push(unidades[u]);
    }

    return partes.join(' e ');
  }

  const milhares = Math.floor(reais / 1000);
  const unidadesReais = reais % 1000;

  const partesReais: string[] = [];

  if (milhares > 0) {
    if (milhares === 1) {
      partesReais.push('mil');
    } else {
      partesReais.push(`${converterGrupo(milhares)} mil`);
    }
  }

  if (unidadesReais > 0) {
    partesReais.push(converterGrupo(unidadesReais));
  }

  let textoReais = partesReais.join(' e ');
  if (reais === 1) {
    textoReais += ' real';
  } else if (reais > 1) {
    textoReais += ' reais';
  }

  const partesCentavos: string[] = [];
  if (centavosResto > 0) {
    const textoCentavos = converterGrupo(centavosResto);
    partesCentavos.push(`${textoCentavos} ${centavosResto === 1 ? 'centavo' : 'centavos'}`);
  }

  if (textoReais && partesCentavos.length > 0) {
    return `${textoReais} e ${partesCentavos.join(' e ')}`;
  } else if (textoReais) {
    return textoReais;
  } else if (partesCentavos.length > 0) {
    return partesCentavos.join(' e ');
  }

  return 'zero reais';
}
