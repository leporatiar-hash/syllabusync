const { withSentryConfig } = require('@sentry/nextjs')

const nextConfig = {
  turbopack: {
    root: __dirname,
  },
  images: {
    qualities: [75, 95],
  },
}

module.exports = withSentryConfig(nextConfig, {
  silent: true,
  org: 'classmate-ed',
  project: 'javascript-nextjs',
  disableSourceMapUpload: !process.env.SENTRY_AUTH_TOKEN,
})
