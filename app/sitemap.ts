import { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://www.rebuttal.live'
  const now = new Date()

  return [
    { url: base, lastModified: now, changeFrequency: 'daily', priority: 1 },
    { url: `${base}/rebut`, lastModified: now, changeFrequency: 'always', priority: 0.9 },
    { url: `${base}/rankings`, lastModified: now, changeFrequency: 'hourly', priority: 0.8 },
    { url: `${base}/topic`, lastModified: now, changeFrequency: 'always', priority: 0.8 },
    { url: `${base}/shop`, lastModified: now, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${base}/help`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${base}/login`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/signup`, lastModified: now, changeFrequency: 'yearly', priority: 0.5 },
    { url: `${base}/tos`, lastModified: now, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${base}/privacy`, lastModified: now, changeFrequency: 'yearly', priority: 0.2 },
  ]
}