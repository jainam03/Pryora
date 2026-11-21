/**
 * PRYORA Smart Transaction Categorization Service
 *
 * Strategy:
 * 1. Fast, deterministic keyword heuristics covering Indian & international merchants
 *    (UPI/food delivery, quick commerce, transit, utilities, OTT, SIPs, retail).
 * 2. Optional server-side Gemini fallback (when GEMINI_API_KEY is configured and
 *    heuristic confidence is low) with strict JSON schema validation and timeout.
 */

import { GoogleGenAI, Type } from '@google/genai';

const apiKey = process.env.GEMINI_API_KEY || '';

let aiClient: GoogleGenAI | null = null;
if (apiKey) {
  aiClient = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export interface CategoryCandidate {
  id: string;
  name: string;
}

export interface AutoCategoryResult {
  categoryId: string | null;
  categoryName: string;
  confidence: number; // 0.0 - 1.0
  reason: string;
  source: 'gemini' | 'heuristic';
}

/**
 * Deterministic keyword-based merchant categorization engine (India + global coverage).
 */
export function heuristicMatch(merchant: string, categories: CategoryCandidate[]): AutoCategoryResult {
  const norm = merchant.toLowerCase().trim();

  const rules: Array<{ keywords: string[]; targetName: string; fallbackNames?: string[]; reason: string }> = [
    {
      keywords: [
        'grocery', 'supermarket', 'market', 'trader joe', 'whole foods', 'costco',
        'kroger', 'safeway', 'aldi', 'walmart', 'target', 'instacart', 'groceries',
        'sprouts', 'provisions', 'mart', 'zepto', 'blinkit', 'instamart', 'bigbasket',
        'dmart', 'd-mart', 'jiomart', 'reliance fresh', 'more supermarket', 'nature basket',
        'milk', 'sabzi', 'kirana', 'vegetables', 'fruits',
      ],
      targetName: 'Groceries & Supplies',
      fallbackNames: ['Food & Dining', 'Shopping & Essentials'],
      reason: 'Matched grocery or quick-commerce essentials merchant',
    },
    {
      keywords: [
        'starbucks', 'coffee', 'cafe', 'mcdonald', 'burger', 'subway', 'chipotle',
        'swiggy', 'zomato', 'doordash', 'uber eats', 'grubhub', 'pizza', 'domino',
        'kfc', 'taco', 'bakery', 'restaurant', 'bistro', 'diner', 'sushi', 'bar',
        'pub', 'brewery', 'tea', 'chai', 'dunkin', 'wendy', 'dining', 'eatery',
        'kitchen', 'biryani', 'haldiram', 'third wave', 'blue tokai', 'chaayos',
        'eatclub', 'faasos', 'behrouz', 'canteen', 'mess', 'tiffin',
      ],
      targetName: 'Food & Dining',
      reason: 'Matched food delivery, cafe, or dining merchant',
    },
    {
      keywords: [
        'uber', 'lyft', 'ola', 'rapido', 'blu smart', 'blusmart', 'namma yatri',
        'grab', 'taxi', 'cab', 'auto', 'rickshaw', 'shell', 'chevron', 'bp', 'hpcl',
        'bpcl', 'indian oil', 'iocl', 'exxon', 'mobil', 'petrol', 'diesel', 'gas station',
        'fuel', 'metro', 'transit', 'train', 'irctc', 'bus', 'redbus', 'parking',
        'toll', 'fastag', 'rail', 'flight', 'airline', 'delta', 'united', 'indigo',
        'air india', 'vistara', 'akasa', 'airasia',
      ],
      targetName: 'Transportation',
      reason: 'Matched commute, rideshare, transit, or fuel expense',
    },
    {
      keywords: [
        'netflix', 'spotify', 'youtube', 'disney', 'hotstar', 'jiohotstar', 'sonyliv',
        'zee5', 'jiocinema', 'hulu', 'hbo', 'apple music', 'prime video', 'audible',
        'patreon', 'substack', 'subscription', 'icloud', 'google one', 'chatgpt',
        'openai', 'claude', 'notion', 'canva', 'linkedin premium', 'swiggy one',
        'zomato gold',
      ],
      targetName: 'Subscriptions',
      reason: 'Matched recurring OTT, music, or digital subscription',
    },
    {
      keywords: [
        'steam', 'playstation', 'nintendo', 'xbox', 'cinema', 'movie', 'pvr', 'inox',
        'bookmyshow', 'amc', 'theatre', 'concert', 'ticketmaster', 'bowling', 'arcade',
        'game', 'entertainment', 'amusement', 'turf', 'badminton',
      ],
      targetName: 'Entertainment & Leisure',
      reason: 'Matched cinema, gaming, or leisure activity',
    },
    {
      keywords: [
        'amazon', 'ebay', 'aliexpress', 'zara', 'h&m', 'uniqlo', 'nike', 'adidas',
        'shein', 'asos', 'nordstrom', 'best buy', 'flipkart', 'myntra', 'ajio',
        'meesho', 'nykaa', 'croma', 'decathlon', 'westside', 'zudio', 'pantaloons',
        'shopping', 'mall', 'clothing', 'apparel', 'shoes', 'ikea',
      ],
      targetName: 'Shopping & Essentials',
      reason: 'Matched retail, apparel, or e-commerce merchant',
    },
    {
      keywords: [
        'electricity', 'electric', 'bescom', 'msedcl', 'tata power', 'adani electricity',
        'bses', 'water', 'gas utility', 'indane', 'hp gas', 'bharat gas', 'igl', 'mgl',
        'internet', 'broadband', 'wifi', 'verizon', 'at&t', 't-mobile', 'comcast',
        'spectrum', 'airtel', 'jio', 'jiofiber', 'vi ', 'vodafone', 'bsnl',
        'act fibernet', 'hathway', 'recharge', 'mobile bill', 'dth', 'utility',
        'power bill', 'energy',
      ],
      targetName: 'Utilities & Bills',
      reason: 'Matched electricity, telecom, broadband, or utility bill',
    },
    {
      keywords: [
        'cvs', 'walgreens', 'pharmacy', 'chemist', 'apollo', '1mg', 'tata 1mg',
        'pharmeasy', 'netmeds', 'medplus', 'hospital', 'clinic', 'dental', 'dentist',
        'doctor', 'practo', 'optometry', 'lenskart', 'glasses', 'lens', 'gym',
        'cult.fit', 'cultfit', 'fitness', 'medication', 'physio', 'therapy', 'health',
      ],
      targetName: 'Health & Medical',
      reason: 'Matched pharmacy, healthcare, or fitness expense',
    },
    {
      keywords: [
        'rent', 'landlord', 'pg rent', 'hostel', 'nobroker', 'cred rent', 'mortgage',
        'housing', 'hoa', 'apartment', 'flat', 'society maintenance', 'property',
        'maintenance', 'leasing', 'maid', 'cook', 'househelp',
      ],
      targetName: 'Housing & Rent',
      reason: 'Matched rent, PG/hostel, or housing cost',
    },
    {
      keywords: [
        'udemy', 'coursera', 'tuition', 'school', 'university', 'college', 'course',
        'bookstore', 'library', 'training', 'education', 'exam fee', 'coaching',
        'unacademy', 'scaler', 'books', 'stationery',
      ],
      targetName: 'Education & Learning',
      reason: 'Matched tuition, books, or learning platform',
    },
    {
      keywords: [
        'zerodha', 'groww', 'kuvera', 'upstox', 'angel one', 'coin by zerodha',
        'mutual fund', 'sip', 'nps', 'ppf', 'rd ', 'recurring deposit', 'fixed deposit',
        'investment', 'savings transfer', 'etf', 'smallcase',
      ],
      targetName: 'Investments & Savings',
      reason: 'Matched SIP, mutual fund, or savings allocation',
    },
    {
      keywords: [
        'hotel', 'airbnb', 'booking.com', 'makemytrip', 'mmt', 'goibibo', 'oyo',
        'zostel', 'hostel', 'resort', 'vacation', 'holiday', 'expedia', 'tripadvisor',
        'travel', 'cleartrip', 'yatra',
      ],
      targetName: 'Travel & Holidays',
      reason: 'Matched hotel, travel booking, or holiday expense',
    },
    {
      keywords: ['salary', 'payroll', 'stipend', 'wages', 'paycheck', 'ctc'],
      targetName: 'Salary',
      reason: 'Matched salary or stipend credit',
    },
    {
      keywords: ['freelance', 'consulting', 'client payment', 'invoice', 'upwork', 'fiverr'],
      targetName: 'Freelance & Consulting',
      reason: 'Matched freelance or client payment',
    },
  ];

  for (const rule of rules) {
    const isMatch = rule.keywords.some(kw => norm.includes(kw));
    if (isMatch) {
      const targetNames = [rule.targetName, ...(rule.fallbackNames || [])];
      for (const target of targetNames) {
        const exactCategory = categories.find(c => c.name.toLowerCase() === target.toLowerCase());
        if (exactCategory) {
          return {
            categoryId: exactCategory.id,
            categoryName: exactCategory.name,
            confidence: target === rule.targetName ? 0.92 : 0.85,
            reason: rule.reason,
            source: 'heuristic',
          };
        }

        const partialCategory = categories.find(
          c =>
            c.name.toLowerCase().includes(target.toLowerCase()) ||
            target.toLowerCase().includes(c.name.toLowerCase())
        );
        if (partialCategory) {
          return {
            categoryId: partialCategory.id,
            categoryName: partialCategory.name,
            confidence: 0.82,
            reason: rule.reason,
            source: 'heuristic',
          };
        }
      }
    }
  }

  // Fallback: Check if merchant name directly resembles any category name
  for (const cat of categories) {
    const catNorm = cat.name.toLowerCase();
    if (norm.includes(catNorm) || (norm.length >= 3 && catNorm.includes(norm))) {
      return {
        categoryId: cat.id,
        categoryName: cat.name,
        confidence: 0.75,
        reason: `Matched category keyword in "${cat.name}"`,
        source: 'heuristic',
      };
    }
  }

  const otherCat = categories.find(c => c.name.toLowerCase().includes('other')) || categories[0];
  return {
    categoryId: otherCat ? otherCat.id : null,
    categoryName: otherCat ? otherCat.name : 'Other Expense',
    confidence: 0.4,
    reason: 'General fallback — select a more specific category if needed',
    source: 'heuristic',
  };
}

/**
 * Suggests the best matching category for a merchant.
 * Uses instant keyword heuristics first, and optionally calls Gemini when
 * GEMINI_API_KEY is configured and heuristic confidence is below 0.75.
 */
export async function suggestCategoryForMerchant(
  merchant: string,
  categories: CategoryCandidate[]
): Promise<AutoCategoryResult> {
  const cleanMerchant = merchant.trim().slice(0, 140);
  if (!cleanMerchant || categories.length === 0) {
    return {
      categoryId: null,
      categoryName: 'Uncategorized',
      confidence: 0,
      reason: 'No merchant name provided',
      source: 'heuristic',
    };
  }

  const heuristic = heuristicMatch(cleanMerchant, categories);

  // If deterministic match is high confidence, or Gemini is not configured / running tests, return immediately
  if (heuristic.confidence >= 0.75 || !aiClient || process.env.NODE_ENV === 'test') {
    return heuristic;
  }

  try {
    const categoryNames = categories.map(c => c.name);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    try {
      const response = await aiClient.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Categorize this personal finance merchant/description into exactly one of the provided categories.
Merchant: "${cleanMerchant}"
Allowed categories: ${JSON.stringify(categoryNames)}`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              categoryName: { type: Type.STRING },
              confidence: { type: Type.NUMBER },
              reason: { type: Type.STRING },
            },
            required: ['categoryName', 'confidence', 'reason'],
          },
          abortSignal: controller.signal,
        },
      });

      const text = response.text;
      if (text) {
        const parsed = JSON.parse(text);
        const matched = categories.find(
          c => c.name.toLowerCase() === String(parsed.categoryName || '').toLowerCase()
        );
        if (matched) {
          return {
            categoryId: matched.id,
            categoryName: matched.name,
            confidence: Math.min(0.98, Math.max(0.5, Number(parsed.confidence) || 0.8)),
            reason: String(parsed.reason || 'Suggested based on merchant name').slice(0, 140),
            source: 'gemini',
          };
        }
      }
    } finally {
      clearTimeout(timeout);
    }
  } catch (err: any) {
    console.warn('Gemini categorization fallback to heuristics:', err?.message || err);
  }

  return heuristic;
}
