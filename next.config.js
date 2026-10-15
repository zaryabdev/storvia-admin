/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    loader: "custom",
    loaderFile: "./lib/image-loader.ts",
    deviceSizes: [640, 828, 1080, 1600],
    imageSizes: [96, 128, 256, 384],
  }
}

module.exports = nextConfig
