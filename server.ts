import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';

const app = express();
const PORT = 3000;

// Increase payload limit for base64 multi-image uploads
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Ensure persistent data directory exists
const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

interface DBData {
  users: Array<{ id: string; name: string; email: string; avatar?: string }>;
  receipts: any[];
}

function readDB(): DBData {
  try {
    if (fs.existsSync(DB_FILE)) {
      const content = fs.readFileSync(DB_FILE, 'utf-8');
      return JSON.parse(content);
    }
  } catch (err) {
    console.error('Error reading db.json:', err);
  }
  return {
    users: [
      { id: 'usr-1', name: 'Usuário Demo', email: 'demo@fiscal.ai', avatar: '' }
    ],
    receipts: []
  };
}

function writeDB(data: DBData) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing db.json:', err);
  }
}

// Initialize Gemini SDK
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build'
    }
  }
});

// JSON Schema for Gemini Receipt Extraction
const receiptSchema = {
  type: Type.OBJECT,
  properties: {
    issuerName: { type: Type.STRING, description: "Razão social ou nome legal do emitente da nota fiscal" },
    fantasyName: { type: Type.STRING, description: "Nome fantasia, marca ou nome do estabelecimento comercial" },
    taxId: { type: Type.STRING, description: "CNPJ ou CPF do emitente" },
    taxIdType: { type: Type.STRING, description: "Tipo do documento fiscal: CNPJ, CPF ou OUTRO" },
    documentType: { type: Type.STRING, description: "Tipo de documento: NFC-e, NF-e, SAT, Cupom Fiscal, Recibo ou Outro" },
    documentNumber: { type: Type.STRING, description: "Número da nota fiscal ou cupom" },
    date: { type: Type.STRING, description: "Data da emissão no formato AAAA-MM-DD" },
    time: { type: Type.STRING, description: "Hora da emissão no formato HH:MM" },
    paymentMethod: { type: Type.STRING, description: "Forma de pagamento: Dinheiro, Cartão de Crédito, Cartão de Débito, PIX, Boleto ou Outro" },
    currency: { type: Type.STRING, description: "Código da moeda: BRL, USD, EUR" },
    grossAmount: { type: Type.NUMBER, description: "Valor bruto total dos produtos e serviços antes de descontos" },
    discounts: { type: Type.NUMBER, description: "Valor total dos descontos aplicados" },
    taxesAmount: { type: Type.NUMBER, description: "Valor total dos impostos e tributos discriminados" },
    totalAmount: { type: Type.NUMBER, description: "Valor total líquido final pago" },
    confidence: { type: Type.NUMBER, description: "Nível de confiança da leitura de 0.0 a 1.0" },
    items: {
      type: Type.ARRAY,
      description: "Lista de todos os itens e produtos constantes no documento",
      items: {
        type: Type.OBJECT,
        properties: {
          sequence: { type: Type.INTEGER, description: "Número de ordem do item começando em 1" },
          originalDescription: { type: Type.STRING, description: "Descrição do produto exatamente como impressa no cupom" },
          normalizedDescription: { type: Type.STRING, description: "Descrição limpa e normalizada sem abreviações obscuras" },
          category: { type: Type.STRING, description: "Categoria do item: Alimentação, Supermercado, Transporte, Combustível, Saúde, Serviços, Escritório, Outros" },
          quantity: { type: Type.NUMBER, description: "Quantidade de unidades compradas" },
          unit: { type: Type.STRING, description: "Unidade de medida: UN, KG, L, M, CX, PCT, etc" },
          unitPrice: { type: Type.NUMBER, description: "Preço unitário por unidade" },
          discount: { type: Type.NUMBER, description: "Desconto aplicado a este item especificamente" },
          totalPrice: { type: Type.NUMBER, description: "Valor total final cobrado por este item" },
          taxInfo: { type: Type.STRING, description: "Informações fiscais como NCM ou tributos do item se visíveis" }
        },
        required: ["sequence", "originalDescription", "normalizedDescription", "category", "quantity", "unit", "unitPrice", "discount", "totalPrice"]
      }
    }
  },
  required: [
    "issuerName", "fantasyName", "taxId", "taxIdType", "documentType", 
    "documentNumber", "date", "paymentMethod", "currency", 
    "grossAmount", "discounts", "taxesAmount", "totalAmount", "confidence", "items"
  ]
};

// Math Validation Engine
function validateReceiptMath(data: any) {
  const divergences: string[] = [];
  const items = data.items || [];

  // 1. Sum of items totalPrice vs grossAmount
  const itemsSum = items.reduce((acc: number, item: any) => acc + (Number(item.totalPrice) || 0), 0);
  const grossAmount = Number(data.grossAmount) || 0;
  if (Math.abs(itemsSum - grossAmount) > 0.02) {
    divergences.push(
      `Soma dos itens (R$ ${itemsSum.toFixed(2)}) difere do Valor Bruto da nota (R$ ${grossAmount.toFixed(2)}).`
    );
  }

  // 2. grossAmount - discounts + taxesAmount vs totalAmount
  const discounts = Number(data.discounts) || 0;
  const taxesAmount = Number(data.taxesAmount) || 0;
  const totalAmount = Number(data.totalAmount) || 0;

  const expectedTotal1 = grossAmount - discounts;
  const expectedTotal2 = grossAmount - discounts + taxesAmount;

  if (Math.abs(expectedTotal1 - totalAmount) > 0.02 && Math.abs(expectedTotal2 - totalAmount) > 0.02) {
    divergences.push(
      `Cálculo da nota (Bruto R$ ${grossAmount.toFixed(2)} - Descontos R$ ${discounts.toFixed(2)}) = R$ ${expectedTotal1.toFixed(2)} difere do Total Líquido declarado (R$ ${totalAmount.toFixed(2)}).`
    );
  }

  // 3. quantity * unitPrice - discount vs totalPrice por item
  items.forEach((item: any, idx: number) => {
    const q = Number(item.quantity) || 0;
    const up = Number(item.unitPrice) || 0;
    const disc = Number(item.discount) || 0;
    const tp = Number(item.totalPrice) || 0;
    const calc = (q * up) - disc;

    if (Math.abs(calc - tp) > 0.02 && q > 0 && up > 0) {
      divergences.push(
        `Item ${item.sequence || idx + 1} (${item.originalDescription || 'Produto'}): Qtd (${q}) × Preço Un. (R$ ${up.toFixed(2)}) - Desc. (R$ ${disc.toFixed(2)}) = R$ ${calc.toFixed(2)}, mas o Total informado é R$ ${tp.toFixed(2)}.`
      );
    }
  });

  return {
    requiresReview: divergences.length > 0,
    divergences
  };
}

// ------------------------------------------------------------------
// API ROUTES
// ------------------------------------------------------------------

// Auth Endpoints
app.post('/api/auth/register', (req, res) => {
  const { name, email, password } = req.body;
  if (!email || !name) {
    return res.status(400).json({ error: 'Nome e e-mail são obrigatórios.' });
  }

  const db = readDB();
  let user = db.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (!user) {
    user = {
      id: `usr-${Date.now()}`,
      name,
      email,
      avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}`
    };
    db.users.push(user);
    writeDB(db);
  }

  res.json({ success: true, user });
});

app.post('/api/auth/login', (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'E-mail é obrigatório.' });
  }

  const db = readDB();
  let user = db.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (!user) {
    user = {
      id: `usr-${Date.now()}`,
      name: email.split('@')[0],
      email,
      avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(email)}`
    };
    db.users.push(user);
    writeDB(db);
  }

  res.json({ success: true, user });
});

// Process Receipt Endpoint (Gemini AI Multimodal Extraction)
app.post('/api/process-receipt', async (req, res) => {
  try {
    const { images, readingMode, source } = req.body;

    if (!images || !Array.isArray(images) || images.length === 0) {
      return res.status(400).json({ error: 'Nenhuma imagem foi enviada para processamento.' });
    }

    // Build multimodal image parts
    const parts: any[] = [];

    images.forEach((imgBase64: string) => {
      let cleanData = imgBase64;
      let mimeType = 'image/jpeg';

      if (imgBase64.includes(';base64,')) {
        const partsSplit = imgBase64.split(';base64,');
        mimeType = partsSplit[0].replace('data:', '');
        cleanData = partsSplit[1];
      }

      parts.push({
        inlineData: {
          mimeType: mimeType,
          data: cleanData
        }
      });
    });

    const isIntensive = readingMode === 'intensive' || images.length > 1;

    const systemInstruction = isIntensive
      ? `Você é o especialista em inteligência fiscal brasileira da FiscalAI.
Esta solicitação contém MÚLTIPLAS FOTOS SEQUENCIAIS ou PÁGINAS do mesmo cupom/nota fiscal longo (Modo Intensivo).
Sua missão:
1. Examine TODAS as imagens em conjunto como uma única nota fiscal contínua.
2. Consolide os itens em ordem de sequência exata sem pular nenhum.
3. Mantenha APENAS UM cabeçalho e totalizador (evite duplicar CNPJ, emitente, impostos ou totais).
4. Retorne o resultado em JSON estrito obedecendo o esquema definido. Se a imagem estiver borrada em algum trecho, infira os dados fiscais visíveis com máxima atenção aos valores numéricos.`
      : `Você é o especialista em inteligência fiscal brasileira da FiscalAI.
Examine a nota fiscal, cupom fiscal (NFC-e, SAT, recibo) fornecido e extraia todos os dados com extrema precisão numérica.
Retorne o JSON estrito conforme o esquema. Mantenha os nomes originais dos produtos em originalDescription e uma versão limpa sem abreviações em normalizedDescription.`;

    parts.push({
      text: "Extraia todos os dados fiscais do documento, incluindo emitente, CNPJ, totais, forma de pagamento e todos os itens discriminados em formato JSON estrito."
    });

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: { parts },
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: receiptSchema
      }
    });

    const rawText = response.text || '{}';
    let extractedData: any = {};

    try {
      extractedData = JSON.parse(rawText);
    } catch (parseErr) {
      console.error('Failed to parse Gemini JSON output:', rawText);
      return res.status(500).json({ error: 'Falha ao formatar o resultado da IA. Tente enviar uma foto mais nítida.' });
    }

    // Perform math checks on server
    const mathValidation = validateReceiptMath(extractedData);

    // Format output
    const receiptResult = {
      ...extractedData,
      readingMode: isIntensive ? 'intensive' : 'normal',
      source: source || 'upload',
      status: mathValidation.requiresReview ? 'revisao_pendente' : 'confirmada',
      requiresReview: mathValidation.requiresReview,
      divergences: mathValidation.divergences,
      imageUrl: images[0] // preview primary image
    };

    res.json({
      success: true,
      data: receiptResult,
      requiresReview: mathValidation.requiresReview,
      divergences: mathValidation.divergences
    });

  } catch (error: any) {
    console.error('Error in /api/process-receipt:', error);
    res.status(500).json({
      error: error?.message || 'Erro no gateway de inteligência artificial. Verifique se o documento é legível e tente novamente.'
    });
  }
});

// QR Code Fetch Endpoint
app.post('/api/qr-fetch', async (req, res) => {
  try {
    const { qrUrl } = req.body;
    if (!qrUrl || !qrUrl.startsWith('http')) {
      return res.status(400).json({ error: 'URL do QR Code inválida.' });
    }

    let pageHtml = '';
    try {
      const response = await fetch(qrUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });
      pageHtml = await response.text();
    } catch (fetchErr) {
      console.warn('Failed to fetch SEFAZ URL directly:', fetchErr);
      return res.json({
        fallbackToOcr: true,
        message: 'O portal da SEFAZ não respondeu ou bloqueou o acesso automático. Por favor, tire uma foto do cupom para extração por OCR.'
      });
    }

    // Strip heavy script tags
    const cleanContent = pageHtml.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ').substring(0, 30000);

    const prompt = `Analise o texto HTML do cupom fiscal NFC-e da SEFAZ a seguir e extraia os dados fiscais em formato JSON estrito conforme o esquema fornecido:\n\n${cleanContent}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: receiptSchema
      }
    });

    const extractedData = JSON.parse(response.text || '{}');
    const mathValidation = validateReceiptMath(extractedData);

    res.json({
      success: true,
      data: {
        ...extractedData,
        source: 'qr',
        status: mathValidation.requiresReview ? 'revisao_pendente' : 'confirmada',
        requiresReview: mathValidation.requiresReview,
        divergences: mathValidation.divergences
      }
    });

  } catch (err: any) {
    console.error('Error in /api/qr-fetch:', err);
    res.json({
      fallbackToOcr: true,
      message: 'Não foi possível extrair a nota diretamente do site. Por favor utilize a foto da nota.'
    });
  }
});

// Receipts Data Persistence Endpoints
app.get('/api/receipts', (req, res) => {
  const { userId } = req.query;
  const db = readDB();
  const filtered = userId 
    ? db.receipts.filter(r => r.userId === userId)
    : db.receipts;
  
  res.json({ success: true, receipts: filtered });
});

app.get('/api/receipts/:id', (req, res) => {
  const { id } = req.params;
  const db = readDB();
  const receipt = db.receipts.find(r => r.id === id);
  if (!receipt) {
    return res.status(404).json({ error: 'Nota fiscal não encontrada.' });
  }
  res.json({ success: true, receipt });
});

app.post('/api/receipts', (req, res) => {
  const newReceipt = req.body;
  if (!newReceipt.issuerName || !newReceipt.totalAmount) {
    return res.status(400).json({ error: 'Dados incompletos da nota fiscal.' });
  }

  const db = readDB();
  const receiptToSave = {
    ...newReceipt,
    id: newReceipt.id || `rec-${Date.now()}`,
    createdAt: newReceipt.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  db.receipts.unshift(receiptToSave);
  writeDB(db);

  res.json({ success: true, receipt: receiptToSave });
});

app.put('/api/receipts/:id', (req, res) => {
  const { id } = req.params;
  const updatedData = req.body;

  const db = readDB();
  const index = db.receipts.findIndex(r => r.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Nota fiscal não encontrada para atualização.' });
  }

  // Re-run math check on update
  const mathValidation = validateReceiptMath(updatedData);

  db.receipts[index] = {
    ...db.receipts[index],
    ...updatedData,
    requiresReview: mathValidation.requiresReview,
    divergences: mathValidation.divergences,
    status: mathValidation.requiresReview ? 'revisao_pendente' : 'confirmada',
    updatedAt: new Date().toISOString()
  };

  writeDB(db);

  res.json({ success: true, receipt: db.receipts[index] });
});

app.delete('/api/receipts/:id', (req, res) => {
  const { id } = req.params;
  const db = readDB();
  db.receipts = db.receipts.filter(r => r.id !== id);
  writeDB(db);
  res.json({ success: true, message: 'Nota fiscal removida com sucesso.' });
});

// ------------------------------------------------------------------
// VITE / STATIC SERVING PIPELINE
// ------------------------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`FiscalAI Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
