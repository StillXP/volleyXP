import type { NextConfig } from 'next'
import path from 'path'

const nextConfig: NextConfig = {
  compiler: {
    styledComponents: true,
  },
  webpack(config) {
    config.resolve.alias['@volley/bracket'] = path.resolve(__dirname, '../bracket/src/index.ts')
    config.resolve.alias['@volley/bracket-model'] = path.resolve(__dirname, '../bracket/src/bracket-model/index.ts')
    // @lockin/* are symlinked from the Lock In repo; resolve them (and their React)
    // through this workspace's node_modules so there is a single React instance.
    config.resolve.symlinks = false
    return config
  },
}

export default nextConfig
