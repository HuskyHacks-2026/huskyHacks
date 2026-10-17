import type { Category } from './types'

// Deterministic fallback classifier. The shopping agent's own category label is never trusted.
const KEYWORDS: Record<Category, string[]> = {
  grocery: ['milk', 'eggs', 'bread', 'loaf', 'butter', 'cheese', 'apple', 'banana', 'orange', 'rice', 'pasta', 'chicken',
    'thigh', 'beef', 'salmon', 'tofu', 'spinach', 'lettuce', 'tomato', 'potato', 'onion', 'cereal', 'yogurt', 'coffee',
    'tea', 'flour', 'sugar', 'olive oil', 'beans', 'carrot', 'grapes', 'berries', 'juice', 'produce', 'grocer'],
  dining: ['restaurant', 'pizza', 'burger', 'takeout', 'sushi', 'doordash'],
  gas: ['gasoline', 'unleaded', 'diesel', 'fuel'],
  utilities: ['electric bill', 'water bill', 'internet bill', 'utility'],
  pharmacy: ['ibuprofen', 'vitamins', 'prescription', 'bandages', 'aspirin'],
  household: ['paper towel', 'detergent', 'dish soap', 'sponge', 'trash bag', 'toilet paper', 'light bulb', 'batteries'],
  clothing: ['shirt', 'jacket', 'jeans', 'shoes', 'socks', 'hoodie'],
  electronics: ['tv', 'television', 'laptop', 'phone', 'headphones', 'tablet', 'console', 'monitor', 'camera', 'speaker'],
  entertainment: ['movie', 'cinema', 'netflix', 'concert', 'game pass', 'streaming', 'tickets'],
  travel: ['flight', 'hotel', 'airbnb', 'rental car'],
  marine: ['boat', 'yacht', 'bayliner', 'outboard', 'kayak', 'marina'],
  luxury: ['watch', 'jewelry', 'handbag'],
  gambling: ['casino', 'poker', 'sportsbook', 'bet', 'lottery'],
  crypto: ['bitcoin', 'ethereum', 'crypto', 'token'],
  gift_card: ['gift card', 'giftcard', 'prepaid card', 'steam card'],
}

export const ALL_CATEGORIES = Object.keys(KEYWORDS) as Category[]

export function isCategory(v: string): v is Category {
  return (ALL_CATEGORIES as string[]).includes(v)
}

/** Every category an item name matches. Callers require ALL to be allowed; empty = unrecognized (fail closed). */
export function classifyItem(name: string): Category[] {
  const n = ` ${name.toLowerCase().replace(/[^a-z0-9 ]/g, ' ')} `
  return ALL_CATEGORIES.filter(cat =>
    KEYWORDS[cat].some(kw => n.includes(` ${kw} `) || n.includes(` ${kw}s `) || (kw.length > 4 && n.includes(kw))),
  )
}
