/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // PWA相关配置
  output: 'standalone', // 生成独立的应用包，适合PWA部署
  images: {
    unoptimized: true, // 禁用Next.js的图像优化，使用原始图像
  },
  // 配置静态资源缓存策略
  headers: async () => {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, stale-while-revalidate=5184000',
          },
        ],
      },
      {
        source: '/service-worker.js',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache',
          },
        ],
      },
    ];
  },
}

module.exports = nextConfig
