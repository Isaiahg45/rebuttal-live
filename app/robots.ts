import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/profile', '/create-challenge'],
    },
    sitemap: 'https://www.rebuttal.live/sitemap.xml',
  }
}