/** @type {import('@vite-pwa/assets-generator').GeneratePWAAssetsConfig} */
module.exports = {
  preset: 'minimal',
  images: ['src/assets/tak.svg'],
  sharpOptions: {
    background: 'transparent',
    quality: 100,
    compressionLevel: 9,
    density: 600,
    withoutEnlargement: false,
    fit: 'contain'
  },
  apple: {
    background: '#ffffff',
    padding: 20,
    quality: 100
  }
} 