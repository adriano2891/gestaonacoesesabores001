export type DocumentType = 'NFC-e' | 'NF-e' | 'SAT' | 'Cupom Fiscal' | 'Recibo' | 'Outro';
export type TaxIdType = 'CNPJ' | 'CPF' | 'OUTRO';
export type PaymentMethod = 'Dinheiro' | 'Cartão de Crédito' | 'Cartão de Débito' | 'PIX' | 'Boleto' | 'Outro';
export type Currency = 'BRL' | 'USD' | 'EUR';
export type ReadingMode = 'normal' | 'intensive';
export type ReceiptSource = 'upload' | 'camera' | 'qr' | 'xml';
export type ReceiptStatus = 'revisao_pendente' | 'confirmada';

export type Category = 
  | 'Alimentação'
  | 'Supermercado'
  | 'Transporte'
  | 'Combustível'
  | 'Saúde'
  | 'Serviços'
  | 'Escritório'
  | 'Outros';

export interface ReceiptItem {
  id?: string;
  sequence: number;
  originalDescription: string;
  normalizedDescription: string;
  category: Category;
  quantity: number;
  unit: string;
  unitPrice: number;
  discount: number;
  totalPrice: number;
  taxInfo?: string;
}

export interface Receipt {
  id: string;
  userId: string;
  issuerName: string;
  fantasyName: string;
  taxId: string;
  taxIdType: TaxIdType;
  documentType: DocumentType;
  documentNumber: string;
  date: string;
  time: string;
  paymentMethod: PaymentMethod;
  currency: Currency;
  grossAmount: number;
  discounts: number;
  taxesAmount: number;
  totalAmount: number;
  confidence: number;
  readingMode: ReadingMode;
  source: ReceiptSource;
  status: ReceiptStatus;
  requiresReview: boolean;
  divergences: string[];
  items: ReceiptItem[];
  imageUrl?: string;
  originalFileName?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
}

export interface ExtractionResponse {
  success: boolean;
  data?: Omit<Receipt, 'id' | 'userId' | 'createdAt'>;
  error?: string;
  divergences?: string[];
  requiresReview?: boolean;
}

export interface FilterOptions {
  search: string;
  startDate: string;
  endDate: string;
  supplier: string;
  currency: string;
  category: string;
  status: string;
}
