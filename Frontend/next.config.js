module.exports = {
  output: 'standalone',
  outputFileTracingRoot: __dirname,
  turbopack: {
    root: __dirname,
  },
  async headers() {
    return [
      {
        // Disable edge caching on all HTML pages — static assets (_next/) stay cached
        source: '/((?!_next/static|_next/image|favicon\\.ico|brand/).*)',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate' },
        ],
      },
    ]
  },
}
