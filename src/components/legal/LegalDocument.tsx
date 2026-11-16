import React from 'react';

/** Renderiza a estrutura dos modelos sem executar HTML ou alterar o conteúdo assinado. */
function inline(text: string): React.ReactNode[] {
  return text.split(/(\*\*[^]*?\*\*|\*[^*\n]+\*)/g).filter(Boolean).map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={index}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('*') && part.endsWith('*')) return <em key={index}>{part.slice(1, -1)}</em>;
    return <React.Fragment key={index}>{part}</React.Fragment>;
  });
}

export function LegalDocument({ content, label = 'Conteúdo do documento jurídico', compact = false }: {
  content: string;
  label?: string;
  compact?: boolean;
}) {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const blocks: React.ReactNode[] = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index].trim();
    if (!line) { index++; continue; }
    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      const title = inline(heading[2]);
      blocks.push(heading[1].length === 1 ? <h2 key={index} className="legal-document-title">{title}</h2> : <h3 key={index}>{title}</h3>);
      index++; continue;
    }
    if (/^---+$/.test(line)) { blocks.push(<hr key={index} />); index++; continue; }
    if (/^[*-]\s/.test(line)) {
      const start = index;
      const items: string[] = [];
      while (index < lines.length && /^[*-]\s/.test(lines[index].trim())) items.push(lines[index++].trim().replace(/^[*-]\s/, ''));
      const financial = items.some(item => /VALOR TOTAL DO CONTRATO|Subtotal das Aulas/.test(item));
      blocks.push(<ul key={start} className={financial ? 'legal-financial-summary' : undefined}>{items.map((item, itemIndex) => <li key={itemIndex}>{inline(item)}</li>)}</ul>);
      continue;
    }
    const start = index;
    const paragraph: string[] = [];
    while (index < lines.length && lines[index].trim() && !/^(#{1,6}\s|---+$|[*-]\s)/.test(lines[index].trim())) paragraph.push(lines[index++].trim());
    const text = paragraph.join('\n');
    const party = /^\*\*(CONTRATADO|CONTRATANTE)/.test(text);
    blocks.push(<p key={start} className={party ? 'legal-party' : undefined}>{inline(text)}</p>);
  }
  return <article role="region" aria-label={label} tabIndex={0} className={'legal-document' + (compact ? ' legal-document-compact' : '')}>{blocks}</article>;
}
