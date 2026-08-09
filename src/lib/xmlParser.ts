import { Receipt, ReceiptItem } from '../types';

export function parseFiscalXml(xmlString: string, userId: string = 'user-default'): Omit<Receipt, 'id' | 'createdAt'> {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlString, 'text/xml');

  // Helper to extract text from a node
  const getText = (selector: string, parent: ParentNode = xmlDoc): string => {
    const el = parent.querySelector(selector);
    return el ? el.textContent?.trim() || '' : '';
  };

  const getNumber = (selector: string, parent: ParentNode = xmlDoc): number => {
    const val = getText(selector, parent);
    const num = parseFloat(val);
    return isNaN(num) ? 0 : num;
  };

  // Emitente
  const issuerName = getText('emit > xNome') || getText('xNome') || 'Emitente Não Identificado';
  const fantasyName = getText('emit > xFant') || getText('xFant') || issuerName;
  const cnpj = getText('emit > CNPJ') || getText('CNPJ');
  const cpf = getText('emit > CPF') || getText('CPF');
  const taxId = cnpj || cpf || '00000000000000';
  const taxIdType = cnpj ? 'CNPJ' : cpf ? 'CPF' : 'OUTRO';

  // Documento
  const mod = getText('ide > mod') || getText('mod');
  let documentType: Receipt['documentType'] = 'NF-e';
  if (mod === '65') documentType = 'NFC-e';
  else if (mod === '59') documentType = 'SAT';
  else if (mod === '55') documentType = 'NF-e';
  else documentType = 'Cupom Fiscal';

  const documentNumber = getText('ide > nNF') || getText('nNF') || '0';
  
  // Data e hora (dhEmi ou dEmi + hEmi)
  const dhEmi = getText('ide > dhEmi') || getText('dhEmi') || getText('ide > dEmi') || getText('dEmi');
  let date = new Date().toISOString().split('T')[0];
  let time = '12:00';
  if (dhEmi) {
    if (dhEmi.includes('T')) {
      const parts = dhEmi.split('T');
      date = parts[0];
      time = parts[1].substring(0, 5);
    } else {
      date = dhEmi;
    }
  }

  // Forma de pagamento
  const tPag = getText('detPag > tPag') || getText('tPag');
  let paymentMethod: Receipt['paymentMethod'] = 'Cartão de Crédito';
  if (tPag === '01') paymentMethod = 'Dinheiro';
  else if (tPag === '02') paymentMethod = 'Cartão de Crédito';
  else if (tPag === '03') paymentMethod = 'Cartão de Débito';
  else if (tPag === '17' || tPag === '20') paymentMethod = 'PIX';
  else if (tPag === '15') paymentMethod = 'Boleto';

  // Totais
  const grossAmount = getNumber('ICMSTot > vProd') || getNumber('vProd') || getNumber('vCFe');
  const discounts = getNumber('ICMSTot > vDesc') || getNumber('vDesc');
  const taxesAmount = getNumber('ICMSTot > vTotTrib') || getNumber('vTotTrib') || getNumber('ICMSTot > vICMS');
  const totalAmount = getNumber('ICMSTot > vNF') || getNumber('vNF') || grossAmount - discounts;

  // Items
  const detNodes = xmlDoc.querySelectorAll('det');
  const items: ReceiptItem[] = [];

  detNodes.forEach((det, index) => {
    const seqAttr = det.getAttribute('nItem');
    const sequence = seqAttr ? parseInt(seqAttr, 10) : index + 1;

    const originalDescription = getText('prod > xProd', det) || `Item ${sequence}`;
    const ncm = getText('prod > NCM', det);
    const quantity = getNumber('prod > qCom', det) || 1;
    const unit = getText('prod > uCom', det) || 'UN';
    const unitPrice = getNumber('prod > vUnCom', det) || getNumber('prod > vProd', det) / (quantity || 1);
    const discount = getNumber('prod > vDesc', det);
    const totalPrice = getNumber('prod > vProd', det) - discount;

    // Categoria rápida automática
    let category: ReceiptItem['category'] = 'Supermercado';
    const lowerDesc = originalDescription.toLowerCase();
    if (lowerDesc.includes('gasolina') || lowerDesc.includes('etanol') || lowerDesc.includes('diesel') || lowerDesc.includes('combustiv')) {
      category = 'Combustível';
    } else if (lowerDesc.includes('restaurante') || lowerDesc.includes('lanche') || lowerDesc.includes('cafe') || lowerDesc.includes('pizz')) {
      category = 'Alimentação';
    } else if (lowerDesc.includes('farmacia') || lowerDesc.includes('remedio') || lowerDesc.includes('drogaria')) {
      category = 'Saúde';
    } else if (lowerDesc.includes('uber') || lowerDesc.includes('taxi') || lowerDesc.includes('pedagio')) {
      category = 'Transporte';
    } else if (lowerDesc.includes('papel') || lowerDesc.includes('caneta') || lowerDesc.includes('impressora')) {
      category = 'Escritório';
    }

    items.push({
      sequence,
      originalDescription,
      normalizedDescription: originalDescription.trim().toUpperCase(),
      category,
      quantity,
      unit: unit.toUpperCase(),
      unitPrice,
      discount,
      totalPrice: totalPrice > 0 ? totalPrice : (quantity * unitPrice) - discount,
      taxInfo: ncm ? `NCM: ${ncm}` : undefined
    });
  });

  return {
    userId,
    issuerName,
    fantasyName,
    taxId,
    taxIdType,
    documentType,
    documentNumber,
    date,
    time,
    paymentMethod,
    currency: 'BRL',
    grossAmount: grossAmount || items.reduce((a, b) => a + b.totalPrice, 0),
    discounts,
    taxesAmount,
    totalAmount: totalAmount || grossAmount - discounts,
    confidence: 1.0, // 100% confidence for structured XML
    readingMode: 'normal',
    source: 'xml',
    status: 'confirmada',
    requiresReview: false,
    divergences: [],
    items
  };
}
