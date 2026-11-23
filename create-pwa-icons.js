// Simple PWA Icon Creator using Canvas
// Run with: node create-pwa-icons.js

const fs = require('fs');
const { createCanvas } = require('canvas');

function createIcon(size, isMaskable, filename) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  
  // Background - Blue gradient
  const gradient = ctx.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, '#3B82F6');
  gradient.addColorStop(1, '#2563EB');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  
  // Calculate padding (safe zone for maskable)
  const padding = isMaskable ? size * 0.15 : size * 0.1;
  const contentSize = size - (padding * 2);
  
  // Draw coffee cup
  ctx.fillStyle = 'white';
  ctx.strokeStyle = 'white';
  
  // Cup body (trapezoid)
  const cupWidth = contentSize * 0.5;
  const cupHeight = contentSize * 0.4;
  const cupX = size / 2 - cupWidth / 2;
  const cupY = size / 2 - cupHeight / 2 + (isMaskable ? 0 : size * 0.05);
  
  ctx.beginPath();
  ctx.moveTo(cupX + cupWidth * 0.1, cupY);
  ctx.lineTo(cupX, cupY + cupHeight);
  ctx.lineTo(cupX + cupWidth, cupY + cupHeight);
  ctx.lineTo(cupX + cupWidth * 0.9, cupY);
  ctx.closePath();
  ctx.fill();
  
  // Handle
  const handleRadius = cupWidth * 0.2;
  const handleX = cupX + cupWidth + handleRadius * 0.5;
  const handleY = cupY + cupHeight / 2;
  
  ctx.beginPath();
  ctx.arc(handleX, handleY, handleRadius, -Math.PI / 3, Math.PI / 3);
  ctx.lineWidth = size * 0.025;
  ctx.stroke();
  
  // Steam lines
  ctx.lineWidth = size * 0.015;
  ctx.lineCap = 'round';
  
  for (let i = 0; i < 3; i++) {
    const steamX = cupX + cupWidth * (0.25 + i * 0.25);
    const steamBaseY = cupY - cupHeight * 0.1;
    const steamHeight = cupHeight * 0.5;
    
    ctx.beginPath();
    ctx.moveTo(steamX, steamBaseY);
    ctx.bezierCurveTo(
      steamX - cupWidth * 0.1, steamBaseY - steamHeight * 0.4,
      steamX + cupWidth * 0.1, steamBaseY - steamHeight * 0.7,
      steamX, steamBaseY - steamHeight
    );
    ctx.stroke();
  }
  
  // Add "CAFE" text for larger icons
  if (size >= 384) {
    ctx.fillStyle = 'white';
    ctx.font = `bold ${size * 0.08}px Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('CAFE', size / 2, cupY + cupHeight + cupHeight * 0.6);
  }
  
  // Save to file
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(`public/${filename}`, buffer);
  console.log(`✓ Created ${filename}`);
}

// Check if canvas is available
try {
  require.resolve('canvas');
} catch (e) {
  console.error('❌ Error: "canvas" package not found');
  console.log('\n📦 Install it with: npm install --save-dev canvas');
  console.log('\n⚠️  Alternative: Use online icon generator:');
  console.log('   https://www.pwabuilder.com/imageGenerator');
  process.exit(1);
}

// Create public folder if it doesn't exist
if (!fs.existsSync('public')) {
  fs.mkdirSync('public');
}

// Generate all required icons
console.log('🎨 Generating PWA icons...\n');
createIcon(192, false, 'pwa-192x192.png');
createIcon(512, false, 'pwa-512x512.png');
createIcon(192, true, 'pwa-maskable-192x192.png');
createIcon(512, true, 'pwa-maskable-512x512.png');
console.log('\n✅ All PWA icons created successfully!');
