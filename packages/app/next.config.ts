import type { NextConfig } from 'next'
import path from 'path'

const nextConfig: NextConfig = {
  compiler: {
    styledComponents: true,
  },
  webpack(config) {
    config.resolve.alias['@design-system/components'] = path.resolve(__dirname, '../design-system/src/index.ts')
    config.resolve.alias['@'] = path.resolve(__dirname, '../design-system/src')
    return config
  },
}

export default nextConfig
