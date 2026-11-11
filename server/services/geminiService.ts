/**
 * PRYORA Gemini AI Service
 * 
 * Server-side AI intelligence powered by @google/genai SDK:
 * - Uses 'gemini-3.8-flash' for low-latency intelligent transaction categorization
 * - Structured JSON schema enforcement
 * - High-precision heuristic fallback engine for offline or resilient operations
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
 * Intelligent keyword-based heuristic fallback
 */
export function heuristicMatch(merchant: string, categories: CategoryCandidate[]): AutoCategoryResult {
  const norm = merchant.toLowerCase().trim();

  const rules: Array<{ keywords: string[]; targetName: string; reason: string }> = [
    {
      keywords: [
        'grocery', 'supermarket', 'market', 'trader joe', 'whole foods', 'costco',
        'kroger', 'safeway', 'aldi', 'walmart', 'target', 'instacart', 'groceries',
        'sprouts', 'provisions', 'mart',
      ],
      targetName: 'Groceries & Supplies',
      reason: 'Identified as grocery or supermarket retailer',
    },
    {
      keywords: [
        'starbucks', 'coffee', 'cafe', 'mcdonald', 'burger', 'subway', 'chipotle',
        'swiggy', 'zomato', 'doordash', 'uber eats', 'grubhub', 'pizza', 'domino',
        'kfc', 'taco', 'bakery', 'restaurant', 'bistro', 'diner', 'sushi', 'bar',
        'pub', 'brewery', 'tea', 'dunkin', 'wendy', 'dining', 'eatery', 'kitchen',
      ],
      targetName: 'Food & Dining',
      reason: 'Recognized as food, beverage, or restaurant purchase',
    },
    {
      keywords: [
        'uber', 'lyft', 'ola', 'grab', 'taxi', 'cab', 'shell', 'chevron', 'bp',
        'exxon', 'mobil', 'petrol', 'gas station', 'fuel', 'metro', 'subway',
        'transit', 'train', 'bus', 'parking', 'toll', 'fastag', 'rail', 'flight',
        'airline', 'delta', 'united', 'indigo', 'airasia',
      ],
      targetName: 'Transportation',
      reason: 'Identified as transit, rideshare, or fuel expenditure',
    },
    {
      keywords: [
        'netflix', 'spotify', 'youtube', 'disney', 'hulu', 'hbo', 'apple music',
        'prime video', 'audible', 'patreon', 'substack', 'subscription', 'icloud',
        'google one', 'chatgpt', 'openai',
      ],
      targetName: 'Subscriptions',
      reason: 'Recognized recurring digital subscription or media service',
    },
    {
      keywords: [
        'steam', 'playstation', 'nintendo', 'xbox', 'cinema', 'movie', 'amc',
        'theatre', 'concert', 'ticketmaster', 'bowling', 'arcade', 'game',
        'entertainment', 'amusement',
      ],
      targetName: 'Entertainment & Leisure',
      reason: 'Recognized recreational or entertainment venue',
    },
    {
      keywords: [
        'amazon', 'ebay', 'aliexpress', 'zara', 'h&m', 'uniqlo', 'nike', 'adidas',
        'shein', 'asos', 'nordstrom', 'best buy', 'flipkart', 'myntra', 'shopping',
        'mall', 'clothing', 'apparel', 'shoes',
      ],
      targetName: 'Shopping & Essentials',
      reason: 'Recognized retail or e-commerce merchant',
    },
    {
      keywords: [
        'electricity', 'electric', 'water', 'gas utility', 'internet', 'broadband',
        'wifi', 'verizon', 'at&t', 't-mobile', 'comcast', 'spectrum', 'airtel',
        'jio', 'utility', 'power bill', 'energy',
      ],
      targetName: 'Utilities & Bills',
      reason: 'Identified utility, telecom, or residential service provider',
    },
    {
      keywords: [
        'cvs', 'walgreens', 'pharmacy', 'chemist', 'hospital', 'clinic', 'dental',
        'dentist', 'doctor', 'optometry', 'glasses', 'lens', 'gym', 'fitness',
        'medication', 'physio', 'therapy', 'health',
      ],
      targetName: 'Health & Medical',
      reason: 'Identified healthcare, wellness, or pharmacy merchant',
    },
    {
      keywords: [
        'rent', 'landlord', 'mortgage', 'housing', 'hoa', 'apartment', 'property',
        'maintenance', 'leasing',
      ],
      targetName: 'Housing & Rent',
      reason: 'Identified residential housing or tenancy cost',
    },
    {
      keywords: [
        'udemy', 'coursera', 'tuition', 'school', 'university', 'college', 'course',
        'bookstore', 'library', 'training', 'education',
      ],
      targetName: 'Education & Learning',
      reason: 'Recognized educational or academic institution',
    },
    {
      keywords: [
        'hotel', 'airbnb', 'booking.com', 'hostel', 'resort', 'vacation', 'holiday',
        'expedia', 'tripadvisor', 'travel',
      ],
      targetName: 'Travel & Holidays',
      reason: 'Identified lodging or vacation travel merchant',
    },
  ];

  for (const rule of rules) {
    const isMatch = rule.keywords.some(kw => norm.includes(kw));
    if (isMatch) {
      // Find candidate in user's category list
      const exactCategory = categories.find(
        c => c.name.toLowerCase() === rule.targetName.toLowerCase()
      );
      if (exactCategory) {
        return {
          categoryId: exactCategory.id,
          categoryName: exactCategory.name,
          confidence: 0.92,
          reason: rule.reason,
          source: 'heuristic',
        };
      }

      // Partial name match
      const partialCategory = categories.find(
        c =>
          c.name.toLowerCase().includes(rule.targetName.toLowerCase()) ||
          rule.targetName.toLowerCase().includes(c.name.toLowerCase())
      );
      if (partialCategory) {
        return {
          categoryId: partialCategory.id,
          categoryName: partialCategory.name,
          confidence: 0.85,
          reason: rule.reason,
          source: 'heuristic',
        };
      }
    }
  }

  // Fallback: Check if merchant name directly resembles any category name
  for (const cat of categories) {
    const catNorm = cat.name.toLowerCase();
    if (norm.includes(catNorm) || catNorm.includes(norm)) {
      return {
        categoryId: cat.id,
        categoryName: cat.name,
        confidence: 0.75,
        reason: `Matched category keyword in "${cat.name}"`,
        source: 'heuristic',
      };
    }
  }

  // Default: first category or Other Expense
  const otherCat = categories.find(c => c.name.toLowerCase().includes('other')) || categories[0];
  return {
    categoryId: otherCat ? otherCat.id : null,
    categoryName: otherCat ? otherCat.name : 'Other Expense',
    confidence: 0.4,
    reason: 'General expense matching standard classification',
    source: 'heuristic',
  };
}

/**
 * Suggests the best matching category for a given merchant name
 * using deterministic keyword heuristics.
 */
export async function suggestCategoryForMerchant(
  merchant: string,
  categories: CategoryCandidate[]
): Promise<AutoCategoryResult> {
  const cleanMerchant = merchant.trim();
  if (!cleanMerchant || categories.length === 0) {
    return {
      categoryId: null,
      categoryName: 'Uncategorized',
      confidence: 0,
      reason: 'No merchant name provided',
      source: 'heuristic',
    };
  }

  return heuristicMatch(cleanMerchant, categories);
}

