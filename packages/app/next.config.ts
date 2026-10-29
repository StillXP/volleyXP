import type { NextConfig } from 'next'
import path from 'path'

const nextConfig: NextConfig = {
  compiler: {
    styledComponents: true,
  },
  webpack(config) {
    config.resolve.alias['@design-system/components'] = path.resolve(__dirname, '../design-system/src/index.ts')
    config.resolve.alias['@'] = path.resolve(__dirname, '../design-system/src')
    // @lockin/* are symlinked from the Lock In repo; resolve them (and their React)
    // through this workspace's node_modules so there is a single React instance.
    config.resolve.symlinks = false
    return config
  },
}

export default nextConfig
